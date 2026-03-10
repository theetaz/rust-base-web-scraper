use std::time::Duration;

use crate::config::RetryConfig;
use crate::stealth::{self, StealthConfig};

pub fn is_blocked(html: &str, status_hint: Option<u16>) -> bool {
    if let Some(code) = status_hint {
        if code == 403 || code == 429 || code == 503 {
            return true;
        }
    }

    if html.len() < 500 && !html.is_empty() {
        return true;
    }

    let lower = html.to_lowercase();
    let patterns = [
        "access denied",
        "verify you are a human",
        "enable javascript and cookies",
        "cf-browser-verification",
        "<div id=\"cf-wrapper\">",
        "attention required",
        "just a moment...",
        "checking your browser",
        "ray id:",
        "captcha-delivery",
    ];
    patterns.iter().any(|p| lower.contains(p))
}

pub fn scrape_with_fallback(
    url: &str,
    wait_secs: u64,
    proxy_url: Option<&str>,
    retry: &RetryConfig,
) -> Result<String, String> {
    let delay = Duration::from_secs(retry.retry_delay_secs);

    // Direct attempts
    let mut last_err = String::new();
    for attempt in 1..=retry.direct_retries {
        let config = StealthConfig::default();
        let browser = stealth::launch_stealth_browser(&config)?;
        let tab = browser.new_tab().map_err(|e| format!("New tab: {}", e))?;
        stealth::apply_stealth(&tab, &config)?;
        match stealth::navigate_stealth(&tab, url, wait_secs, &config) {
            Ok(html) if !is_blocked(&html, None) => return Ok(html),
            Ok(_) => last_err = format!("Blocked on direct attempt {}", attempt),
            Err(e) => last_err = format!("Direct attempt {} failed: {}", attempt, e),
        }
        if attempt < retry.direct_retries {
            tracing::info!("Direct retry {}/{} for {} in {}s", attempt, retry.direct_retries, url, retry.retry_delay_secs);
            std::thread::sleep(delay);
        }
    }

    tracing::warn!("All {} direct attempts failed for {}: {}. Trying proxy.", retry.direct_retries, url, last_err);

    let proxy = proxy_url.ok_or_else(|| "Blocked by site and no PROXY_URL configured".to_string())?;

    // Proxy attempts
    for attempt in 1..=retry.proxy_retries {
        let config = StealthConfig::default().with_proxy(Some(proxy.to_string()));
        let browser = stealth::launch_stealth_browser(&config)?;
        let tab = browser.new_tab().map_err(|e| format!("New tab (proxy): {}", e))?;
        stealth::apply_stealth(&tab, &config)?;
        match stealth::navigate_stealth(&tab, url, wait_secs, &config) {
            Ok(html) if !is_blocked(&html, None) => return Ok(html),
            Ok(_) => last_err = format!("Blocked via proxy on attempt {}", attempt),
            Err(e) => last_err = format!("Proxy attempt {} failed: {}", attempt, e),
        }
        if attempt < retry.proxy_retries {
            tracing::info!("Proxy retry {}/{} for {} in {}s", attempt, retry.proxy_retries, url, retry.retry_delay_secs);
            std::thread::sleep(delay);
        }
    }

    Err(format!("All proxy attempts failed for {}: {}", url, last_err))
}
