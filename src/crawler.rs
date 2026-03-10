use scraper::{Html, Selector};
use spider::page::Page;
use spider_transformations::transformation::content::{
    transform_content, ReturnFormat, TransformConfig,
};
use std::collections::{HashSet, VecDeque};
use std::time::Instant;
use url::Url;

use crate::config::ProxyMode;
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

pub fn scrape_single(
    url: &str,
    wait_secs: u64,
    proxy_url: Option<&str>,
    proxy_mode: &ProxyMode,
) -> Result<Vec<CrawlResult>, String> {
    let start = Instant::now();
    let used_proxy;
    let html;

    let use_proxy_directly = *proxy_mode == ProxyMode::Always && proxy_url.is_some();

    if use_proxy_directly {
        // Always mode: go straight through proxy
        let p = proxy_url.unwrap();
        let config = StealthConfig::default().with_proxy(Some(p.to_string()));
        let browser = stealth::launch_stealth_browser(&config)?;
        let tab = browser.new_tab().map_err(|e| format!("New tab (proxy): {}", e))?;
        stealth::apply_stealth(&tab, &config)?;
        html = stealth::navigate_stealth(&tab, url, wait_secs, &config)?;
        used_proxy = true;
    } else {
        // Direct attempt first (fallback or never mode)
        let config = StealthConfig::default();
        let browser = stealth::launch_stealth_browser(&config)?;
        let tab = browser.new_tab().map_err(|e| format!("New tab: {}", e))?;
        stealth::apply_stealth(&tab, &config)?;
        let direct_html = stealth::navigate_stealth(&tab, url, wait_secs, &config)?;

        if !proxy::is_blocked(&direct_html, None) {
            html = direct_html;
            used_proxy = false;
        } else if *proxy_mode == ProxyMode::Fallback {
            drop(tab);
            drop(browser);
            tracing::warn!("Blocked on direct attempt for {}", url);
            if let Some(p) = proxy_url {
                let config = StealthConfig::default().with_proxy(Some(p.to_string()));
                let browser = stealth::launch_stealth_browser(&config)?;
                let tab = browser.new_tab().map_err(|e| format!("New tab (proxy): {}", e))?;
                stealth::apply_stealth(&tab, &config)?;
                let proxy_html = stealth::navigate_stealth(&tab, url, wait_secs, &config)?;
                if proxy::is_blocked(&proxy_html, None) {
                    return Err(format!("Still blocked after proxy retry for {}", url));
                }
                html = proxy_html;
                used_proxy = true;
            } else {
                return Err("Blocked and no proxy configured".into());
            }
        } else {
            // Never mode: don't retry with proxy
            return Err(format!("Blocked on {} (proxy mode: never)", url));
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

        // Check for blocking (skip fallback in always mode since we're already using proxy)
        if proxy::is_blocked(&html, None) && !use_proxy_directly {
            tracing::warn!("Blocked on {}", url);
            if *proxy_mode == ProxyMode::Fallback {
                if let Some(p) = proxy_url {
                    match proxy::scrape_with_fallback(&url, wait_secs, Some(p)) {
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

        // Extract links for further crawling
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

        // Random delay
        let delay_ms = 1000 + (rand::random::<u64>() % 2000);
        std::thread::sleep(std::time::Duration::from_millis(delay_ms));
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
