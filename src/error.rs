use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};

#[derive(thiserror::Error, Debug)]
pub enum CrawlError {
    #[error("Database error: {0}")]
    Database(#[from] sqlx::Error),

    #[error("Redis error: {0}")]
    Redis(#[from] redis::RedisError),

    #[error("Browser error: {0}")]
    Browser(String),

    #[error("Blocked by site: {0}")]
    Blocked(String),

    #[error("Not found: {0}")]
    NotFound(String),

    #[error("Invalid request: {0}")]
    BadRequest(String),
}

impl IntoResponse for CrawlError {
    fn into_response(self) -> Response {
        let (status, message) = match &self {
            CrawlError::NotFound(_) => (StatusCode::NOT_FOUND, self.to_string()),
            CrawlError::BadRequest(_) => (StatusCode::BAD_REQUEST, self.to_string()),
            other => {
                tracing::error!("Internal error: {:?}", other);
                (StatusCode::INTERNAL_SERVER_ERROR, self.to_string())
            }
        };

        let body = serde_json::json!({ "error": message });
        (status, axum::Json(body)).into_response()
    }
}
