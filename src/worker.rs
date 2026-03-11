use sqlx::SqlitePool;
use std::sync::Arc;

use crate::config::Config;
use crate::crawler;
use crate::db;
use crate::pdf;
use crate::queue;

pub async fn start_workers(pool: Arc<SqlitePool>, config: Arc<Config>) {
    for i in 0..config.max_workers {
        let pool = pool.clone();
        let config = config.clone();
        tokio::spawn(async move {
            tracing::info!("Worker {} started", i);
            worker_loop(pool, config, i).await;
        });
    }
}

async fn worker_loop(pool: Arc<SqlitePool>, config: Arc<Config>, worker_id: usize) {
    loop {
        let task_id = match queue::dequeue(&config.redis_url).await {
            Ok(id) => id,
            Err(e) => {
                tracing::error!("Worker {} dequeue error: {}", worker_id, e);
                tokio::time::sleep(std::time::Duration::from_secs(5)).await;
                continue;
            }
        };

        tracing::info!("Worker {} picked up job {}", worker_id, task_id);

        // Get job details
        let job = match db::get_job(&pool, &task_id).await {
            Ok(j) => j,
            Err(e) => {
                tracing::error!("Worker {} job fetch error: {}", worker_id, e);
                continue;
            }
        };

        // Update status to running
        if let Err(e) = db::update_job_status(&pool, &task_id, "running", None).await {
            tracing::error!("Failed to update job status: {}", e);
        }

        let url = job.url.clone();
        let mode = job.mode.clone();
        let limit = job.page_limit.unwrap_or(10) as u32;
        let wait = job.wait_seconds.unwrap_or(3) as u64;
        let proxy = config.proxy_url.clone();
        let proxy_mode = config.proxy_mode.clone();
        let retry = config.retry.clone();
        let main_content = job.main_content.unwrap_or(false);

        let is_pdf = pdf::is_pdf_url(&url) || pdf::is_pdf_content_type(&url).await;

        let result = if is_pdf {
            tracing::info!("Detected PDF URL, using pdf_oxide: {}", url);
            Ok(pdf::scrape_pdf(&url, &task_id).await)
        } else {
            match mode.as_str() {
                "scrape" => {
                    let proxy_ref = proxy.as_deref().map(String::from);
                    tokio::task::spawn_blocking(move || {
                        crawler::scrape_single(&url, wait, proxy_ref.as_deref(), &proxy_mode, &retry, main_content)
                    })
                    .await
                }
                "crawl" => {
                    let proxy_ref = proxy.as_deref().map(String::from);
                    tokio::task::spawn_blocking(move || {
                        crawler::crawl_browser(&url, limit, wait, proxy_ref.as_deref(), &proxy_mode, &retry, main_content)
                    })
                    .await
                }
                "http" => Ok(Ok(crawler::crawl_http(&url, limit, main_content).await)),
                _ => Ok(Err("Unknown mode".to_string())),
            }
        };

        match result {
            Ok(Ok(crawl_results)) => {
                let count = crawl_results.len() as i32;
                for cr in &crawl_results {
                    let assets_json = if cr.assets.is_empty() {
                        None
                    } else {
                        Some(serde_json::to_string(&cr.assets).unwrap_or_default())
                    };
                    if let Err(e) = db::insert_result(
                        &pool,
                        &task_id,
                        &cr.url,
                        &cr.markdown,
                        &cr.metadata,
                        cr.response_time_ms,
                        cr.used_proxy,
                        assets_json.as_deref(),
                    )
                    .await
                    {
                        tracing::error!("Failed to insert result: {}", e);
                    }
                }
                db::update_pages_crawled(&pool, &task_id, count).await.ok();
                db::update_job_status(&pool, &task_id, "completed", None)
                    .await
                    .ok();
                tracing::info!("Job {} completed with {} pages", task_id, count);
            }
            Ok(Err(e)) => {
                tracing::error!("Job {} failed: {}", task_id, e);
                db::update_job_status(&pool, &task_id, "failed", Some(&e))
                    .await
                    .ok();
            }
            Err(e) => {
                let msg = format!("Task join error: {}", e);
                tracing::error!("Job {} failed: {}", task_id, msg);
                db::update_job_status(&pool, &task_id, "failed", Some(&msg))
                    .await
                    .ok();
            }
        }
    }
}
