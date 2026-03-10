use sqlx::sqlite::{SqlitePool, SqlitePoolOptions};

use crate::error::CrawlError;

pub async fn init_pool(database_url: &str) -> Result<SqlitePool, CrawlError> {
    let url = if database_url.starts_with("sqlite://") {
        database_url.to_string()
    } else {
        format!("sqlite://{}", database_url)
    };

    // Ensure the file exists for SQLite
    let path = url
        .strip_prefix("sqlite://")
        .or_else(|| url.strip_prefix("sqlite:"))
        .unwrap_or("spider.db");
    if path != ":memory:" {
        if let Some(parent) = std::path::Path::new(path).parent() {
            std::fs::create_dir_all(parent).ok();
        }
        if !std::path::Path::new(path).exists() {
            std::fs::File::create(path).ok();
        }
    }

    let pool = SqlitePoolOptions::new()
        .max_connections(5)
        .connect(&format!("{}?mode=rwc", url))
        .await?;

    // Run migrations (split into individual statements for SQLite)
    let migration = include_str!("../migrations/001_init.sql");
    for statement in migration.split(';') {
        let stmt = statement.trim();
        if !stmt.is_empty() {
            sqlx::query(stmt).execute(&pool).await.ok();
        }
    }

    // Enable WAL mode and foreign keys
    sqlx::query("PRAGMA journal_mode=WAL")
        .execute(&pool)
        .await
        .ok();
    sqlx::query("PRAGMA foreign_keys=ON")
        .execute(&pool)
        .await
        .ok();

    Ok(pool)
}

#[derive(Debug, sqlx::FromRow, serde::Serialize)]
pub struct Job {
    pub id: String,
    pub url: String,
    pub mode: String,
    pub page_limit: Option<i32>,
    pub wait_seconds: Option<i32>,
    pub status: String,
    pub error: Option<String>,
    pub pages_crawled: Option<i32>,
    pub created_at: String,
    pub started_at: Option<String>,
    pub completed_at: Option<String>,
}

#[derive(Debug, sqlx::FromRow, serde::Serialize)]
pub struct JobResult {
    pub id: i64,
    pub job_id: String,
    pub url: String,
    pub markdown: String,
    pub title: Option<String>,
    pub description: Option<String>,
    pub language: Option<String>,
    pub canonical_url: Option<String>,
    pub og_image: Option<String>,
    pub favicon: Option<String>,
    pub word_count: Option<i32>,
    pub links_internal: Option<i32>,
    pub links_external: Option<i32>,
    pub images_count: Option<i32>,
    pub headings: Option<String>,
    pub response_time_ms: Option<i32>,
    pub used_proxy: Option<bool>,
    pub crawled_at: String,
}

pub async fn create_job(
    pool: &SqlitePool,
    id: &str,
    url: &str,
    mode: &str,
    page_limit: i32,
    wait_seconds: i32,
) -> Result<Job, CrawlError> {
    let now = chrono::Utc::now().to_rfc3339();
    sqlx::query(
        "INSERT INTO jobs (id, url, mode, page_limit, wait_seconds, status, created_at) VALUES (?, ?, ?, ?, ?, 'queued', ?)"
    )
    .bind(id)
    .bind(url)
    .bind(mode)
    .bind(page_limit)
    .bind(wait_seconds)
    .bind(&now)
    .execute(pool)
    .await?;

    get_job(pool, id).await
}

pub async fn get_job(pool: &SqlitePool, id: &str) -> Result<Job, CrawlError> {
    sqlx::query_as::<_, Job>("SELECT * FROM jobs WHERE id = ?")
        .bind(id)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| CrawlError::NotFound(format!("Job {} not found", id)))
}

pub async fn list_jobs(
    pool: &SqlitePool,
    limit: i32,
    offset: i32,
) -> Result<Vec<Job>, CrawlError> {
    Ok(
        sqlx::query_as::<_, Job>("SELECT * FROM jobs ORDER BY created_at DESC LIMIT ? OFFSET ?")
            .bind(limit)
            .bind(offset)
            .fetch_all(pool)
            .await?,
    )
}

pub async fn count_jobs(pool: &SqlitePool) -> Result<i64, CrawlError> {
    let row: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM jobs")
        .fetch_one(pool)
        .await?;
    Ok(row.0)
}

pub async fn update_job_status(
    pool: &SqlitePool,
    id: &str,
    status: &str,
    error: Option<&str>,
) -> Result<(), CrawlError> {
    let now = chrono::Utc::now().to_rfc3339();
    match status {
        "running" => {
            sqlx::query("UPDATE jobs SET status = 'running', started_at = ? WHERE id = ?")
                .bind(&now)
                .bind(id)
                .execute(pool)
                .await?;
        }
        "completed" => {
            sqlx::query(
                "UPDATE jobs SET status = 'completed', completed_at = ? WHERE id = ?",
            )
            .bind(&now)
            .bind(id)
            .execute(pool)
            .await?;
        }
        "failed" => {
            sqlx::query(
                "UPDATE jobs SET status = 'failed', error = ?, completed_at = ? WHERE id = ?",
            )
            .bind(error)
            .bind(&now)
            .bind(id)
            .execute(pool)
            .await?;
        }
        _ => {}
    }
    Ok(())
}

pub async fn update_pages_crawled(
    pool: &SqlitePool,
    id: &str,
    count: i32,
) -> Result<(), CrawlError> {
    sqlx::query("UPDATE jobs SET pages_crawled = ? WHERE id = ?")
        .bind(count)
        .bind(id)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn insert_result(
    pool: &SqlitePool,
    job_id: &str,
    url: &str,
    markdown: &str,
    meta: &crate::metadata::PageMetadata,
    response_time_ms: i32,
    used_proxy: bool,
) -> Result<(), CrawlError> {
    let now = chrono::Utc::now().to_rfc3339();
    let headings_json = serde_json::to_string(&meta.headings).unwrap_or_default();
    sqlx::query(
        "INSERT INTO results (job_id, url, markdown, title, description, language, canonical_url, og_image, favicon, word_count, links_internal, links_external, images_count, headings, response_time_ms, used_proxy, crawled_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    )
    .bind(job_id)
    .bind(url)
    .bind(markdown)
    .bind(&meta.title)
    .bind(&meta.description)
    .bind(&meta.language)
    .bind(&meta.canonical_url)
    .bind(&meta.og_image)
    .bind(&meta.favicon)
    .bind(meta.word_count)
    .bind(meta.links_internal)
    .bind(meta.links_external)
    .bind(meta.images_count)
    .bind(&headings_json)
    .bind(response_time_ms)
    .bind(used_proxy)
    .bind(&now)
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn get_results(pool: &SqlitePool, job_id: &str) -> Result<Vec<JobResult>, CrawlError> {
    Ok(
        sqlx::query_as::<_, JobResult>("SELECT * FROM results WHERE job_id = ?")
            .bind(job_id)
            .fetch_all(pool)
            .await?,
    )
}

#[derive(Debug, serde::Serialize)]
pub struct JobStats {
    pub total: i64,
    pub queued: i64,
    pub running: i64,
    pub completed: i64,
    pub failed: i64,
    pub total_pages_crawled: i64,
    pub avg_response_time_ms: f64,
    pub total_results: i64,
}

pub async fn get_stats(pool: &SqlitePool) -> Result<JobStats, CrawlError> {
    // Use a single query to get all job counts — COALESCE all SUMs to avoid NULL
    let row = sqlx::query_as::<_, (i64, i64, i64, i64, i64, i64)>(
        "SELECT \
            COUNT(*), \
            COALESCE(SUM(CASE WHEN status = 'queued' THEN 1 ELSE 0 END), 0), \
            COALESCE(SUM(CASE WHEN status = 'running' THEN 1 ELSE 0 END), 0), \
            COALESCE(SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END), 0), \
            COALESCE(SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END), 0), \
            COALESCE(SUM(pages_crawled), 0) \
         FROM jobs"
    )
    .fetch_one(pool)
    .await?;

    // Separate query for results stats — use CAST to ensure float type for sqlx
    let results_row = sqlx::query_as::<_, (i64, f64)>(
        "SELECT COUNT(*), CAST(COALESCE(AVG(CAST(response_time_ms AS REAL)), 0.0) AS REAL) FROM results"
    )
    .fetch_one(pool)
    .await
    .unwrap_or((0, 0.0));

    Ok(JobStats {
        total: row.0,
        queued: row.1,
        running: row.2,
        completed: row.3,
        failed: row.4,
        total_pages_crawled: row.5,
        avg_response_time_ms: results_row.1,
        total_results: results_row.0,
    })
}

#[derive(Debug, sqlx::FromRow, serde::Serialize)]
pub struct RecentActivity {
    pub id: String,
    pub url: String,
    pub status: String,
    pub mode: String,
    pub pages_crawled: Option<i32>,
    pub error: Option<String>,
    pub created_at: String,
    pub started_at: Option<String>,
    pub completed_at: Option<String>,
}

pub async fn get_recent_activity(
    pool: &SqlitePool,
    limit: i32,
) -> Result<Vec<RecentActivity>, CrawlError> {
    Ok(sqlx::query_as::<_, RecentActivity>(
        "SELECT id, url, status, mode, pages_crawled, error, created_at, started_at, completed_at FROM jobs ORDER BY created_at DESC LIMIT ?",
    )
    .bind(limit)
    .fetch_all(pool)
    .await?)
}

pub async fn get_failed_jobs(
    pool: &SqlitePool,
    limit: i32,
) -> Result<Vec<Job>, CrawlError> {
    Ok(sqlx::query_as::<_, Job>(
        "SELECT * FROM jobs WHERE status = 'failed' ORDER BY completed_at DESC LIMIT ?",
    )
    .bind(limit)
    .fetch_all(pool)
    .await?)
}

pub async fn delete_job(pool: &SqlitePool, id: &str) -> Result<(), CrawlError> {
    // Delete results first (or rely on CASCADE)
    sqlx::query("DELETE FROM results WHERE job_id = ?")
        .bind(id)
        .execute(pool)
        .await?;
    let result = sqlx::query("DELETE FROM jobs WHERE id = ?")
        .bind(id)
        .execute(pool)
        .await?;
    if result.rows_affected() == 0 {
        return Err(CrawlError::NotFound(format!("Job {} not found", id)));
    }
    Ok(())
}
