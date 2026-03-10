use std::env;

#[derive(Clone, Debug)]
pub struct Config {
    pub port: u16,
    pub redis_url: String,
    pub database_url: String,
    pub proxy_url: Option<String>,
    pub max_workers: usize,
}

impl Config {
    pub fn from_env() -> Self {
        let proxy_url = Self::build_proxy_url();

        Self {
            port: env::var("PORT")
                .ok()
                .and_then(|v| v.parse().ok())
                .unwrap_or(9000),
            redis_url: env::var("REDIS_URL").unwrap_or_else(|_| "redis://127.0.0.1:6379".into()),
            database_url: env::var("DATABASE_URL")
                .unwrap_or_else(|_| "sqlite://spider.db".into()),
            proxy_url,
            max_workers: env::var("MAX_WORKERS")
                .ok()
                .and_then(|v| v.parse().ok())
                .unwrap_or(3),
        }
    }

    fn build_proxy_url() -> Option<String> {
        // First check for a full PROXY_URL (backwards compatible)
        if let Ok(url) = env::var("PROXY_URL") {
            if !url.is_empty() {
                return Some(url);
            }
        }

        // Build from individual components
        let host = env::var("PROXY_HOST").ok().filter(|s| !s.is_empty())?;
        let port = env::var("PROXY_PORT").ok().filter(|s| !s.is_empty())?;
        let protocol = env::var("PROXY_PROTOCOL")
            .ok()
            .filter(|s| !s.is_empty())
            .unwrap_or_else(|| "http".into());

        let username = env::var("PROXY_USERNAME").ok().filter(|s| !s.is_empty());
        let password = env::var("PROXY_PASSWORD").ok().filter(|s| !s.is_empty());

        let url = match (username, password) {
            (Some(user), Some(pass)) => {
                format!("{}://{}:{}@{}:{}", protocol, user, pass, host, port)
            }
            _ => format!("{}://{}:{}", protocol, host, port),
        };

        Some(url)
    }

    pub fn is_proxy_configured(&self) -> bool {
        self.proxy_url.is_some()
    }

    /// Returns a sanitized version of the database URL for display (no credentials)
    pub fn safe_database_url(&self) -> String {
        Self::redact_url(&self.database_url)
    }

    /// Returns a sanitized version of the Redis URL for display (no credentials)
    pub fn safe_redis_url(&self) -> String {
        Self::redact_url(&self.redis_url)
    }

    fn redact_url(url: &str) -> String {
        if let Ok(mut parsed) = url::Url::parse(url) {
            if !parsed.username().is_empty() || parsed.password().is_some() {
                parsed.set_username("***").ok();
                parsed.set_password(Some("***")).ok();
            }
            parsed.to_string()
        } else {
            url.to_string()
        }
    }
}
