use std::time::Instant;
use tempfile::NamedTempFile;
use std::io::Write;
use url::Url;

use crate::crawler::CrawlResult;
use crate::metadata::PageMetadata;

/// Check if a URL points to a PDF (by extension or content-type header).
pub fn is_pdf_url(url: &str) -> bool {
    if let Ok(parsed) = Url::parse(url) {
        let path = parsed.path().to_lowercase();
        if path.ends_with(".pdf") {
            return true;
        }
    }
    false
}

/// HEAD request to confirm content-type when extension is ambiguous.
pub async fn is_pdf_content_type(url: &str) -> bool {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .unwrap_or_default();

    match client.head(url).send().await {
        Ok(resp) => resp
            .headers()
            .get(reqwest::header::CONTENT_TYPE)
            .and_then(|v| v.to_str().ok())
            .map(|ct| ct.contains("application/pdf"))
            .unwrap_or(false),
        Err(_) => false,
    }
}

/// Download PDF, parse all pages to markdown, return CrawlResult.
pub async fn scrape_pdf(url: &str) -> Result<Vec<CrawlResult>, String> {
    let start = Instant::now();

    let bytes = download_pdf(url).await?;
    let markdown = parse_pdf_to_markdown(&bytes)?;

    let word_count = markdown.split_whitespace().count() as i32;
    let elapsed = start.elapsed().as_millis() as i32;

    let title = markdown
        .lines()
        .find(|l| l.starts_with("# "))
        .map(|l| l.trim_start_matches("# ").to_string());

    let metadata = PageMetadata {
        title,
        word_count,
        ..Default::default()
    };

    Ok(vec![CrawlResult {
        url: url.to_string(),
        html: String::new(),
        markdown,
        metadata,
        response_time_ms: elapsed,
        used_proxy: false,
    }])
}

async fn download_pdf(url: &str) -> Result<Vec<u8>, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(120))
        .build()
        .map_err(|e| format!("HTTP client error: {}", e))?;

    let resp = client
        .get(url)
        .send()
        .await
        .map_err(|e| format!("PDF download failed: {}", e))?;

    if !resp.status().is_success() {
        return Err(format!("PDF download returned HTTP {}", resp.status()));
    }

    resp.bytes()
        .await
        .map(|b| b.to_vec())
        .map_err(|e| format!("Failed to read PDF bytes: {}", e))
}

fn parse_pdf_to_markdown(bytes: &[u8]) -> Result<String, String> {
    let mut tmp = NamedTempFile::new().map_err(|e| format!("Temp file error: {}", e))?;
    tmp.write_all(bytes)
        .map_err(|e| format!("Write temp file: {}", e))?;
    tmp.flush().map_err(|e| format!("Flush temp: {}", e))?;

    let path = tmp.path().to_str().ok_or("Invalid temp path")?;
    let mut doc =
        pdf_oxide::PdfDocument::open(path).map_err(|e| format!("PDF parse error: {}", e))?;

    let page_count = doc
        .page_count()
        .map_err(|e| format!("Page count error: {}", e))?;

    let mut parts = Vec::with_capacity(page_count);
    for i in 0..page_count {
        match doc.to_markdown(i, &Default::default()) {
            Ok(md) if !md.trim().is_empty() => parts.push(md),
            Ok(_) => {}
            Err(e) => tracing::warn!("PDF page {} markdown error: {}", i, e),
        }
    }

    if parts.is_empty() {
        return Err("No extractable text in PDF".into());
    }

    Ok(parts.join("\n\n---\n\n"))
}
