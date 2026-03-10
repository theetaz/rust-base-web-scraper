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
) -> Result<String, String> {
    // Attempt 1: no proxy
    let config = StealthConfig::default();
    let browser = stealth::launch_stealth_browser(&config)?;
    let tab = browser.new_tab().map_err(|e| format!("New tab: {}", e))?;
    stealth::apply_stealth(&tab, &config)?;
    let html = stealth::navigate_stealth(&tab, url, wait_secs, &config)?;

    if !is_blocked(&html, None) {
        return Ok(html);
    }

    tracing::warn!("Blocked on first attempt for {}, trying proxy fallback", url);
    drop(tab);
    drop(browser);

    // Attempt 2: with proxy
    let proxy = proxy_url.ok_or_else(|| {
        "Blocked by site and no PROXY_URL configured".to_string()
    })?;

    let config = StealthConfig::default().with_proxy(Some(proxy.to_string()));
    let browser = stealth::launch_stealth_browser(&config)?;
    let tab = browser.new_tab().map_err(|e| format!("New tab (proxy): {}", e))?;
    stealth::apply_stealth(&tab, &config)?;
    let html = stealth::navigate_stealth(&tab, url, wait_secs, &config)?;

    if is_blocked(&html, None) {
        return Err(format!("Still blocked after proxy retry for {}", url));
    }

    Ok(html)
}
