pub mod handlers;
pub mod models;

use axum::{
    routing::{delete, get, post},
    Router,
};
use sqlx::SqlitePool;
use std::sync::Arc;
use tower_http::cors::{Any, CorsLayer};
use tower_http::trace::TraceLayer;

use crate::config::Config;

#[derive(Clone)]
pub struct AppState {
    pub db: Arc<SqlitePool>,
    pub redis: redis::aio::MultiplexedConnection,
    pub config: Arc<Config>,
}

pub fn create_router(state: AppState) -> Router {
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    Router::new()
        .route("/api/scrape", post(handlers::submit_scrape))
        .route("/api/scrape", get(handlers::list_scrapes))
        .route("/api/scrape/{task_id}", get(handlers::get_scrape))
        .route("/api/scrape/{task_id}", delete(handlers::delete_scrape))
        .route("/api/pdf-images/{task_id}/{filename}", get(handlers::serve_pdf_image))
        .route("/api/stats", get(handlers::get_stats))
        .route("/api/queue/status", get(handlers::get_queue_status))
        .route("/api/system", get(handlers::get_system_info))
        .route("/api/cleanup", post(handlers::cleanup_storage))
        .route("/api/health", get(handlers::health_check))
        .layer(cors)
        .layer(TraceLayer::new_for_http())
        .with_state(state)
}
