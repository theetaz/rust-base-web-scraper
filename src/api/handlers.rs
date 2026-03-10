use axum::extract::{Path, Query, State};
use axum::http::StatusCode;
use axum::Json;
use uuid::Uuid;

use crate::api::models::*;
use crate::db;
use crate::error::CrawlError;
use crate::queue;
use crate::api::AppState;

pub async fn submit_scrape(
    State(state): State<AppState>,
    Json(req): Json<ScrapeRequest>,
) -> Result<(StatusCode, Json<ScrapeResponse>), CrawlError> {
    // Validate mode
    if !["scrape", "crawl", "http"].contains(&req.mode.as_str()) {
        return Err(CrawlError::BadRequest(
            "mode must be 'scrape', 'crawl', or 'http'".into(),
        ));
    }

    // Validate URL
    if url::Url::parse(&req.url).is_err() {
        return Err(CrawlError::BadRequest("Invalid URL".into()));
    }

    let task_id = Uuid::new_v4().to_string();

    let job = db::create_job(
        &state.db,
        &task_id,
        &req.url,
        &req.mode,
        req.limit,
        req.wait_seconds,
        req.main_content,
    )
    .await?;

    // Enqueue to Redis
    let mut conn = state.redis.clone();
    queue::enqueue(&mut conn, &task_id).await?;

    Ok((
        StatusCode::ACCEPTED,
        Json(ScrapeResponse {
            task_id: job.id,
            status: job.status,
            created_at: job.created_at,
        }),
    ))
}

pub async fn get_scrape(
    State(state): State<AppState>,
    Path(task_id): Path<String>,
) -> Result<Json<JobDetailResponse>, CrawlError> {
    let job = db::get_job(&state.db, &task_id).await?;
    let results = db::get_results(&state.db, &task_id).await?;
    Ok(Json(JobDetailResponse::from_job_and_results(job, results)))
}

pub async fn list_scrapes(
    State(state): State<AppState>,
    Query(params): Query<ListQuery>,
) -> Result<Json<JobListResponse>, CrawlError> {
    let limit = params.limit.unwrap_or(50);
    let offset = params.offset.unwrap_or(0);
    let jobs = db::list_jobs(&state.db, limit, offset).await?;
    let total = db::count_jobs(&state.db).await?;
    Ok(Json(JobListResponse {
        jobs,
        total,
        limit,
        offset,
    }))
}

pub async fn delete_scrape(
    State(state): State<AppState>,
    Path(task_id): Path<String>,
) -> Result<StatusCode, CrawlError> {
    db::delete_job(&state.db, &task_id).await?;
    Ok(StatusCode::NO_CONTENT)
}

pub async fn get_stats(
    State(state): State<AppState>,
) -> Result<Json<StatsResponse>, CrawlError> {
    let stats = db::get_stats(&state.db).await?;
    let mut conn = state.redis.clone();
    let queue_depth = queue::queue_length(&mut conn).await.unwrap_or(0);
    Ok(Json(StatsResponse {
        jobs: stats,
        queue_depth,
        max_workers: state.config.max_workers,
    }))
}

pub async fn get_queue_status(
    State(state): State<AppState>,
) -> Result<Json<QueueStatusResponse>, CrawlError> {
    let stats = db::get_stats(&state.db).await?;
    let mut conn = state.redis.clone();
    let queue_depth = queue::queue_length(&mut conn).await.unwrap_or(0);
    let recent = db::get_recent_activity(&state.db, 30).await?;
    Ok(Json(QueueStatusResponse {
        queue_depth,
        max_workers: state.config.max_workers,
        running_jobs: stats.running,
        queued_jobs: stats.queued,
        recent_activity: recent,
    }))
}

pub async fn get_system_info(
    State(state): State<AppState>,
) -> Result<Json<SystemInfoResponse>, CrawlError> {
    let sqlite_ok = sqlx::query("SELECT 1")
        .execute(&*state.db)
        .await
        .is_ok();

    let mut conn = state.redis.clone();
    let redis_ok = queue::ping(&mut conn).await.unwrap_or(false);

    let health = HealthResponse {
        status: if sqlite_ok && redis_ok {
            "ok".into()
        } else {
            "degraded".into()
        },
        redis: if redis_ok {
            "connected".into()
        } else {
            "disconnected".into()
        },
        sqlite: if sqlite_ok {
            "connected".into()
        } else {
            "disconnected".into()
        },
    };

    let config = SystemConfig {
        port: state.config.port,
        max_workers: state.config.max_workers,
        proxy_configured: state.config.is_proxy_configured(),
        proxy_mode: state.config.proxy_mode.to_string(),
        database_url: state.config.safe_database_url(),
        redis_url: state.config.safe_redis_url(),
    };

    let recent_errors = db::get_failed_jobs(&state.db, 20).await?;

    Ok(Json(SystemInfoResponse {
        health,
        config,
        recent_errors,
    }))
}

pub async fn health_check(
    State(state): State<AppState>,
) -> Json<HealthResponse> {
    let sqlite_ok = sqlx::query("SELECT 1")
        .execute(&*state.db)
        .await
        .is_ok();

    let mut conn = state.redis.clone();
    let redis_ok = queue::ping(&mut conn).await.unwrap_or(false);

    Json(HealthResponse {
        status: if sqlite_ok && redis_ok {
            "ok".into()
        } else {
            "degraded".into()
        },
        redis: if redis_ok {
            "connected".into()
        } else {
            "disconnected".into()
        },
        sqlite: if sqlite_ok {
            "connected".into()
        } else {
            "disconnected".into()
        },
    })
}
