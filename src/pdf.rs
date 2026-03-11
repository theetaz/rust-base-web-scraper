use std::path::{Path, PathBuf};
use std::time::Instant;
use std::{fs, io::Write};
use tempfile::NamedTempFile;
use url::Url;

use crate::crawler::CrawlResult;
use crate::metadata::PageMetadata;

const PDF_IMAGES_DIR: &str = "data/pdf_images";

pub fn is_pdf_url(url: &str) -> bool {
    Url::parse(url)
        .map(|u| u.path().to_lowercase().ends_with(".pdf"))
        .unwrap_or(false)
}

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

/// Download PDF, extract clean LLM-optimized markdown with images as files.
/// `task_id` determines the image output directory; images are referenced as API URLs.
pub async fn scrape_pdf(url: &str, task_id: &str) -> Result<Vec<CrawlResult>, String> {
    let start = Instant::now();
    let bytes = download_pdf(url).await?;

    let image_dir = PathBuf::from(PDF_IMAGES_DIR).join(task_id);
    let (markdown, images_count) = parse_pdf_to_markdown(&bytes, &image_dir, task_id)?;

    let word_count = markdown.split_whitespace().count() as i32;
    let elapsed = start.elapsed().as_millis() as i32;

    let title = markdown
        .lines()
        .find(|l| l.starts_with("# "))
        .map(|l| l.trim_start_matches("# ").to_string());

    let metadata = PageMetadata {
        title,
        word_count,
        images_count,
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

/// CLI variant: images saved alongside markdown in the output directory.
pub async fn scrape_pdf_cli(url: &str, output_dir: &str) -> Result<Vec<CrawlResult>, String> {
    let start = Instant::now();
    let bytes = download_pdf(url).await?;

    let image_dir = PathBuf::from(output_dir).join("images");
    let (markdown, images_count) = parse_pdf_to_markdown(&bytes, &image_dir, "")?;

    let word_count = markdown.split_whitespace().count() as i32;
    let elapsed = start.elapsed().as_millis() as i32;

    let title = markdown
        .lines()
        .find(|l| l.starts_with("# "))
        .map(|l| l.trim_start_matches("# ").to_string());

    let metadata = PageMetadata {
        title,
        word_count,
        images_count,
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

/// Remove extracted images for a given task.
pub fn cleanup_images(task_id: &str) {
    let dir = PathBuf::from(PDF_IMAGES_DIR).join(task_id);
    if dir.exists() {
        fs::remove_dir_all(&dir).ok();
    }
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

fn parse_pdf_to_markdown(
    bytes: &[u8],
    image_dir: &Path,
    task_id: &str,
) -> Result<(String, i32), String> {
    let mut tmp = NamedTempFile::new().map_err(|e| format!("Temp file error: {}", e))?;
    tmp.write_all(bytes)
        .map_err(|e| format!("Write temp file: {}", e))?;
    tmp.flush().map_err(|e| format!("Flush temp: {}", e))?;

    let path = tmp.path().to_str().ok_or("Invalid temp path")?;
    let mut doc =
        pdf_oxide::PdfDocument::open(path).map_err(|e| format!("PDF parse error: {}", e))?;

    fs::create_dir_all(image_dir).map_err(|e| format!("Create image dir: {}", e))?;

    let options = pdf_oxide::converters::ConversionOptions {
        detect_headings: true,
        include_images: true,
        embed_images: false,
        image_output_dir: Some(image_dir.to_string_lossy().to_string()),
        ..Default::default()
    };

    let page_count = doc
        .page_count()
        .map_err(|e| format!("Page count error: {}", e))?;

    let mut parts = Vec::with_capacity(page_count);
    for i in 0..page_count {
        match doc.to_markdown(i, &options) {
            Ok(md) if !md.trim().is_empty() => parts.push(md),
            Ok(_) => {}
            Err(e) => tracing::warn!("PDF page {} markdown error: {}", i, e),
        }
    }

    if parts.is_empty() {
        return Err("No extractable text in PDF".into());
    }

    let mut markdown = parts.join("\n\n---\n\n");

    // Count extracted images
    let images_count = fs::read_dir(image_dir)
        .map(|entries| {
            entries
                .filter_map(|e| e.ok())
                .filter(|e| {
                    e.path()
                        .extension()
                        .map(|ext| matches!(ext.to_str(), Some("png" | "jpg" | "jpeg" | "gif" | "webp")))
                        .unwrap_or(false)
                })
                .count() as i32
        })
        .unwrap_or(0);

    // Rewrite image paths: local filesystem paths → API URLs
    if !task_id.is_empty() && images_count > 0 {
        let dir_str = image_dir.to_string_lossy();
        markdown = markdown.replace(
            &format!("]({}/" , dir_str),
            &format!("](/api/pdf-images/{}/", task_id),
        );
        markdown = markdown.replace(
            &format!("]({}\\", dir_str),
            &format!("](/api/pdf-images/{}/", task_id),
        );
    }

    // Clean up empty image dir
    if images_count == 0 {
        fs::remove_dir_all(image_dir).ok();
    }

    Ok((markdown, images_count))
}
