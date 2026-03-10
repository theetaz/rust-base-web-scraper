use serde::{Deserialize, Serialize};

use crate::db::{Job, JobResult};

#[derive(Debug, Deserialize)]
pub struct ScrapeRequest {
    pub url: String,
    #[serde(default = "default_mode")]
    pub mode: String,
    #[serde(default = "default_limit")]
    pub limit: i32,
    #[serde(default = "default_wait")]
    pub wait_seconds: i32,
}

fn default_mode() -> String {
    "scrape".into()
}
fn default_limit() -> i32 {
    10
}
fn default_wait() -> i32 {
    3
}

#[derive(Debug, Serialize)]
pub struct ScrapeResponse {
    pub task_id: String,
    pub status: String,
    pub created_at: String,
}

#[derive(Debug, Serialize)]
pub struct JobDetailResponse {
    pub task_id: String,
    pub status: String,
    pub url: String,
    pub mode: String,
    pub pages_crawled: i32,
    pub created_at: String,
    pub started_at: Option<String>,
    pub completed_at: Option<String>,
    pub error: Option<String>,
    pub results: Vec<ResultItem>,
}

#[derive(Debug, Serialize)]
pub struct ResultItem {
    pub url: String,
    pub markdown: String,
    pub metadata: ResultMetadata,
}

#[derive(Debug, Serialize)]
pub struct ResultMetadata {
    pub title: Option<String>,
    pub description: Option<String>,
    pub language: Option<String>,
    pub canonical_url: Option<String>,
    pub og_image: Option<String>,
    pub favicon: Option<String>,
    pub word_count: i32,
    pub links_internal: i32,
    pub links_external: i32,
    pub images_count: i32,
    pub headings: Vec<String>,
    pub response_time_ms: i32,
    pub used_proxy: bool,
    pub crawled_at: String,
}

#[derive(Debug, Serialize)]
pub struct JobListResponse {
    pub jobs: Vec<Job>,
    pub total: i64,
    pub limit: i32,
    pub offset: i32,
}

#[derive(Debug, Deserialize)]
pub struct ListQuery {
    pub limit: Option<i32>,
    pub offset: Option<i32>,
}

#[derive(Debug, Serialize)]
pub struct HealthResponse {
    pub status: String,
    pub redis: String,
    pub sqlite: String,
}

#[derive(Debug, Serialize)]
pub struct StatsResponse {
    pub jobs: crate::db::JobStats,
    pub queue_depth: i64,
    pub max_workers: usize,
}

#[derive(Debug, Serialize)]
pub struct QueueStatusResponse {
    pub queue_depth: i64,
    pub max_workers: usize,
    pub running_jobs: i64,
    pub queued_jobs: i64,
    pub recent_activity: Vec<crate::db::RecentActivity>,
}

#[derive(Debug, Serialize)]
pub struct SystemInfoResponse {
    pub health: HealthResponse,
    pub config: SystemConfig,
    pub recent_errors: Vec<Job>,
}

#[derive(Debug, Serialize)]
pub struct SystemConfig {
    pub port: u16,
    pub max_workers: usize,
    pub proxy_configured: bool,
    pub proxy_mode: String,
    pub database_url: String,
    pub redis_url: String,
}

impl JobDetailResponse {
    pub fn from_job_and_results(job: Job, results: Vec<JobResult>) -> Self {
        let result_items: Vec<ResultItem> = results
            .into_iter()
            .map(|r| {
                let headings: Vec<String> = r
                    .headings
                    .as_deref()
                    .and_then(|h| serde_json::from_str(h).ok())
                    .unwrap_or_default();
                ResultItem {
                    url: r.url,
                    markdown: r.markdown,
                    metadata: ResultMetadata {
                        title: r.title,
                        description: r.description,
                        language: r.language,
                        canonical_url: r.canonical_url,
                        og_image: r.og_image,
                        favicon: r.favicon,
                        word_count: r.word_count.unwrap_or(0),
                        links_internal: r.links_internal.unwrap_or(0),
                        links_external: r.links_external.unwrap_or(0),
                        images_count: r.images_count.unwrap_or(0),
                        headings,
                        response_time_ms: r.response_time_ms.unwrap_or(0),
                        used_proxy: r.used_proxy.unwrap_or(false),
                        crawled_at: r.crawled_at,
                    },
                }
            })
            .collect();

        Self {
            task_id: job.id,
            status: job.status,
            url: job.url,
            mode: job.mode,
            pages_crawled: job.pages_crawled.unwrap_or(0),
            created_at: job.created_at,
            started_at: job.started_at,
            completed_at: job.completed_at,
            error: job.error,
            results: result_items,
        }
    }
}
