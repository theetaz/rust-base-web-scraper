use scraper::{Html, Selector};
use spider::page::Page;
use spider_transformations::transformation::content::{
    transform_content, ReturnFormat, TransformConfig,
};
use std::collections::{HashSet, VecDeque};
use std::time::{Duration, Instant};
use url::Url;

use crate::config::{ProxyMode, RetryConfig};
use crate::metadata::{self, PageMetadata};
use crate::proxy;
use crate::stealth::{self, StealthConfig};

pub struct CrawlResult {
    pub url: String,
    pub html: String,
    pub markdown: String,
    pub metadata: PageMetadata,
    pub response_time_ms: i32,
    pub used_proxy: bool,
}

fn try_direct(url: &str, wait_secs: u64) -> Result<String, String> {
    let config = StealthConfig::default();
    let browser = stealth::launch_stealth_browser(&config)?;
    let tab = browser.new_tab().map_err(|e| format!("New tab: {}", e))?;
    stealth::apply_stealth(&tab, &config)?;
    stealth::navigate_stealth(&tab, url, wait_secs, &config)
}

fn try_proxy(url: &str, wait_secs: u64, proxy_url: &str) -> Result<String, String> {
    let config = StealthConfig::default().with_proxy(Some(proxy_url.to_string()));
    let browser = stealth::launch_stealth_browser(&config)?;
    let tab = browser.new_tab().map_err(|e| format!("New tab (proxy): {}", e))?;
    stealth::apply_stealth(&tab, &config)?;
    stealth::navigate_stealth(&tab, url, wait_secs, &config)
}

pub fn scrape_single(
    url: &str,
    wait_secs: u64,
    proxy_url: Option<&str>,
    proxy_mode: &ProxyMode,
    retry: &RetryConfig,
) -> Result<Vec<CrawlResult>, String> {
    let start = Instant::now();
    let used_proxy;
    let html;
    let delay = Duration::from_secs(retry.retry_delay_secs);

    if *proxy_mode == ProxyMode::Always && proxy_url.is_some() {
        let p = proxy_url.unwrap();
        let mut last_err = String::new();
        let mut result_html = None;
        for attempt in 1..=retry.proxy_retries {
            match try_proxy(url, wait_secs, p) {
                Ok(h) if !proxy::is_blocked(&h, None) => {
                    result_html = Some(h);
                    break;
                }
                Ok(_) => last_err = format!("Blocked via proxy on attempt {}", attempt),
                Err(e) => last_err = format!("Proxy attempt {} failed: {}", attempt, e),
            }
            if attempt < retry.proxy_retries {
                tracing::info!("Proxy retry {}/{} for {} in {}s", attempt, retry.proxy_retries, url, retry.retry_delay_secs);
                std::thread::sleep(delay);
            }
        }
        html = result_html.ok_or_else(|| format!("All {} proxy attempts failed for {}: {}", retry.proxy_retries, url, last_err))?;
        used_proxy = true;
    } else {
        let mut direct_ok = None;
        let mut last_err = String::new();
        for attempt in 1..=retry.direct_retries {
            match try_direct(url, wait_secs) {
                Ok(h) if !proxy::is_blocked(&h, None) => {
                    direct_ok = Some(h);
                    break;
                }
                Ok(_) => last_err = format!("Blocked on direct attempt {}", attempt),
                Err(e) => last_err = format!("Direct attempt {} failed: {}", attempt, e),
            }
            if attempt < retry.direct_retries {
                tracing::info!("Direct retry {}/{} for {} in {}s", attempt, retry.direct_retries, url, retry.retry_delay_secs);
                std::thread::sleep(delay);
            }
        }

        if let Some(h) = direct_ok {
            html = h;
            used_proxy = false;
        } else if *proxy_mode == ProxyMode::Fallback {
            tracing::warn!("All {} direct attempts failed for {}: {}. Falling back to proxy.", retry.direct_retries, url, last_err);
            if let Some(p) = proxy_url {
                let mut proxy_ok = None;
                let mut proxy_err = String::new();
                for attempt in 1..=retry.proxy_retries {
                    match try_proxy(url, wait_secs, p) {
                        Ok(h) if !proxy::is_blocked(&h, None) => {
                            proxy_ok = Some(h);
                            break;
                        }
                        Ok(_) => proxy_err = format!("Blocked via proxy on attempt {}", attempt),
                        Err(e) => proxy_err = format!("Proxy attempt {} failed: {}", attempt, e),
                    }
                    if attempt < retry.proxy_retries {
                        tracing::info!("Proxy retry {}/{} for {} in {}s", attempt, retry.proxy_retries, url, retry.retry_delay_secs);
                        std::thread::sleep(delay);
                    }
                }
                html = proxy_ok.ok_or_else(|| format!("All {} proxy attempts also failed for {}: {}", retry.proxy_retries, url, proxy_err))?;
                used_proxy = true;
            } else {
                return Err("Blocked and no proxy configured".into());
            }
        } else {
            return Err(format!("Blocked on {} after {} attempts (proxy mode: never)", url, retry.direct_retries));
        }
    }

    let elapsed = start.elapsed().as_millis() as i32;
    let meta = metadata::extract_metadata(&html, url);

    let mut page = Page::default();
    page.set_url(url.to_string());
    page.set_html_bytes(Some(html.clone().into_bytes()));
    if let Ok(parsed) = Url::parse(url) {
        page.set_url_parsed(parsed);
    }

    let conf = TransformConfig {
        return_format: ReturnFormat::Markdown,
        ..Default::default()
    };
    let markdown = transform_content(&page, &conf, &None, &None, &None);

    Ok(vec![CrawlResult {
        url: url.to_string(),
        html,
        markdown,
        metadata: meta,
        response_time_ms: elapsed,
        used_proxy,
    }])
}

pub fn crawl_browser(
    start_url: &str,
    limit: u32,
    wait_secs: u64,
    proxy_url: Option<&str>,
    proxy_mode: &ProxyMode,
    retry: &RetryConfig,
) -> Result<Vec<CrawlResult>, String> {
    let base_host = Url::parse(start_url)
        .ok()
        .and_then(|u| u.host_str().map(String::from));

    let use_proxy_directly = *proxy_mode == ProxyMode::Always && proxy_url.is_some();
    let config = if use_proxy_directly {
        StealthConfig::default().with_proxy(Some(proxy_url.unwrap().to_string()))
    } else {
        StealthConfig::default()
    };
    let browser = stealth::launch_stealth_browser(&config)?;
    let tab = browser.new_tab().map_err(|e| format!("New tab: {}", e))?;
    stealth::apply_stealth(&tab, &config)?;

    let mut visited = HashSet::new();
    let mut queue = VecDeque::from([start_url.to_string()]);
    let mut results = Vec::new();

    while let Some(url) = queue.pop_front() {
        if visited.contains(&url) || results.len() >= limit as usize {
            continue;
        }
        visited.insert(url.clone());

        tracing::info!("Fetching: {}", url);
        let start = Instant::now();
        let html = match stealth::navigate_stealth(&tab, &url, wait_secs, &config) {
            Ok(h) => h,
            Err(e) => {
                tracing::warn!("Skip {}: {}", url, e);
                continue;
            }
        };

        if proxy::is_blocked(&html, None) && !use_proxy_directly {
            tracing::warn!("Blocked on {}", url);
            if *proxy_mode == ProxyMode::Fallback {
                if let Some(p) = proxy_url {
                    match proxy::scrape_with_fallback(&url, wait_secs, Some(p), retry) {
                        Ok(proxy_html) => {
                            let elapsed = start.elapsed().as_millis() as i32;
                            let meta = metadata::extract_metadata(&proxy_html, &url);
                            let mut page = Page::default();
                            page.set_url(url.clone());
                            page.set_html_bytes(Some(proxy_html.clone().into_bytes()));
                            if let Ok(parsed) = Url::parse(&url) {
                                page.set_url_parsed(parsed);
                            }
                            let conf = TransformConfig {
                                return_format: ReturnFormat::Markdown,
                                ..Default::default()
                            };
                            let markdown = transform_content(&page, &conf, &None, &None, &None);
                            results.push(CrawlResult {
                                url: url.clone(),
                                html: proxy_html,
                                markdown,
                                metadata: meta,
                                response_time_ms: elapsed,
                                used_proxy: true,
                            });
                        }
                        Err(e) => {
                            tracing::warn!("Proxy fallback also failed for {}: {}", url, e);
                        }
                    }
                }
            }
            continue;
        }

        let elapsed = start.elapsed().as_millis() as i32;
        let meta = metadata::extract_metadata(&html, &url);

        let mut page = Page::default();
        page.set_url(url.clone());
        page.set_html_bytes(Some(html.clone().into_bytes()));
        if let Ok(parsed) = Url::parse(&url) {
            page.set_url_parsed(parsed);
        }

        let conf = TransformConfig {
            return_format: ReturnFormat::Markdown,
            ..Default::default()
        };
        let markdown = transform_content(&page, &conf, &None, &None, &None);

        let page_base = Url::parse(&url).ok();
        if let Some(ref base) = page_base {
            let doc = Html::parse_document(&html);
            if let Ok(selector) = Selector::parse("a[href]") {
                for el in doc.select(&selector) {
                    if let Some(href) = el.value().attr("href") {
                        if let Ok(absolute) = base.join(href) {
                            let s = absolute.as_str().to_string();
                            let same_host = base_host
                                .as_ref()
                                .map(|h| absolute.host_str() == Some(h))
                                .unwrap_or(true);
                            if same_host && !visited.contains(&s) {
                                queue.push_back(s);
                            }
                        }
                    }
                }
            }
        }

        results.push(CrawlResult {
            url: url.clone(),
            html,
            markdown,
            metadata: meta,
            response_time_ms: elapsed,
            used_proxy: false,
        });

        if results.len() >= limit as usize {
            break;
        }

        let delay_ms = 1000 + (rand::random::<u64>() % 2000);
        std::thread::sleep(Duration::from_millis(delay_ms));
    }

    Ok(results)
}

pub async fn crawl_http(start_url: &str, limit: u32) -> Vec<CrawlResult> {
    use spider::website::Website;

    let mut website = Website::new(start_url);
    website.with_limit(limit).with_respect_robots_txt(true);
    website.scrape().await;

    let pages = website
        .get_pages()
        .map(|p| p.to_vec())
        .unwrap_or_default();

    let conf = TransformConfig {
        return_format: ReturnFormat::Markdown,
        ..Default::default()
    };

    pages
        .iter()
        .map(|page| {
            let url = page.get_url().to_string();
            let markdown = transform_content(page, &conf, &None, &None, &None);
            let html_bytes = page.get_html_bytes_u8();
            let html = String::from_utf8_lossy(html_bytes).to_string();
            let meta = metadata::extract_metadata(&html, &url);

            CrawlResult {
                url,
                html,
                markdown,
                metadata: meta,
                response_time_ms: 0,
                used_proxy: false,
            }
        })
        .collect()
}
