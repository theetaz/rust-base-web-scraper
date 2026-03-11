use regex::Regex;
use std::path::{Path, PathBuf};
use std::time::Instant;
use std::{fs, io::Write};
use tempfile::NamedTempFile;
use url::Url;

use crate::crawler::{Asset, CrawlResult};
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

/// API path: images saved under data/pdf_images/{task_id}/, assets get API URLs.
pub async fn scrape_pdf(url: &str, task_id: &str) -> Result<Vec<CrawlResult>, String> {
    let start = Instant::now();
    let bytes = download_pdf(url).await?;

    let image_dir = PathBuf::from(PDF_IMAGES_DIR).join(task_id);
    let api_prefix = format!("/api/pdf-images/{}", task_id);
    let ParseResult { markdown, assets, images_count } =
        parse_pdf_to_markdown(&bytes, &image_dir, &api_prefix)?;

    let word_count = markdown.split_whitespace().count() as i32;
    let elapsed = start.elapsed().as_millis() as i32;

    let title = markdown
        .lines()
        .find(|l| l.starts_with("# "))
        .map(|l| l.trim_start_matches("# ").to_string());

    Ok(vec![CrawlResult {
        url: url.to_string(),
        html: String::new(),
        markdown,
        metadata: PageMetadata {
            title,
            word_count,
            images_count,
            ..Default::default()
        },
        response_time_ms: elapsed,
        used_proxy: false,
        assets,
    }])
}

/// CLI path: images saved in {output_dir}/images/, assets get local file paths.
pub async fn scrape_pdf_cli(url: &str, output_dir: &str) -> Result<Vec<CrawlResult>, String> {
    let start = Instant::now();
    let bytes = download_pdf(url).await?;

    let image_dir = PathBuf::from(output_dir).join("images");
    let ParseResult { markdown, assets, images_count } =
        parse_pdf_to_markdown(&bytes, &image_dir, "images")?;

    let word_count = markdown.split_whitespace().count() as i32;
    let elapsed = start.elapsed().as_millis() as i32;

    let title = markdown
        .lines()
        .find(|l| l.starts_with("# "))
        .map(|l| l.trim_start_matches("# ").to_string());

    Ok(vec![CrawlResult {
        url: url.to_string(),
        html: String::new(),
        markdown,
        metadata: PageMetadata {
            title,
            word_count,
            images_count,
            ..Default::default()
        },
        response_time_ms: elapsed,
        used_proxy: false,
        assets,
    }])
}

pub fn cleanup_images(task_id: &str) {
    let dir = PathBuf::from(PDF_IMAGES_DIR).join(task_id);
    if dir.exists() {
        fs::remove_dir_all(&dir).ok();
    }
}

#[derive(Debug, serde::Serialize)]
pub struct CleanupResult {
    pub removed_count: u32,
    pub freed_bytes: u64,
}

fn dir_size(path: &Path) -> u64 {
    fs::read_dir(path)
        .map(|entries| {
            entries
                .filter_map(|e| e.ok())
                .map(|e| {
                    let p = e.path();
                    if p.is_dir() {
                        dir_size(&p)
                    } else {
                        p.metadata().map(|m| m.len()).unwrap_or(0)
                    }
                })
                .sum::<u64>()
        })
        .unwrap_or(0)
}

pub async fn cleanup_orphaned_images(
    pool: &sqlx::SqlitePool,
) -> Result<CleanupResult, String> {
    let base = PathBuf::from(PDF_IMAGES_DIR);
    if !base.exists() {
        return Ok(CleanupResult { removed_count: 0, freed_bytes: 0 });
    }

    let entries = fs::read_dir(&base).map_err(|e| format!("Read dir: {}", e))?;
    let mut removed = 0u32;
    let mut freed = 0u64;

    for e in entries.filter_map(|e| e.ok()) {
        let path = e.path();
        if !path.is_dir() {
            continue;
        }
        let task_id = path
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("");
        if task_id.is_empty() {
            continue;
        }

        let exists: Option<i32> = sqlx::query_scalar("SELECT 1 FROM jobs WHERE id = ?")
            .bind(task_id)
            .fetch_optional(pool)
            .await
            .map_err(|e| format!("DB query: {}", e))?;

        if exists.is_none() {
            let size = dir_size(&path);
            if fs::remove_dir_all(&path).is_ok() {
                removed += 1;
                freed += size;
            }
        }
    }

    Ok(CleanupResult { removed_count: removed, freed_bytes: freed })
}

pub fn cleanup_all_images() -> Result<CleanupResult, String> {
    let base = PathBuf::from(PDF_IMAGES_DIR);
    if !base.exists() {
        return Ok(CleanupResult { removed_count: 0, freed_bytes: 0 });
    }

    let total_size = dir_size(&base);
    let count = fs::read_dir(&base)
        .map(|e| e.filter_map(|x| x.ok()).count())
        .unwrap_or(0);

    fs::remove_dir_all(&base).map_err(|e| format!("Remove dir: {}", e))?;
    fs::create_dir_all(&base).map_err(|e| format!("Create dir: {}", e))?;

    Ok(CleanupResult {
        removed_count: count as u32,
        freed_bytes: total_size,
    })
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

struct ParseResult {
    markdown: String,
    assets: Vec<Asset>,
    images_count: i32,
}

fn content_type_for(ext: &str) -> &'static str {
    match ext {
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "gif" => "image/gif",
        "webp" => "image/webp",
        _ => "application/octet-stream",
    }
}

fn parse_pdf_to_markdown(
    bytes: &[u8],
    image_dir: &Path,
    url_prefix: &str,
) -> Result<ParseResult, String> {
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
        fs::remove_dir_all(image_dir).ok();
        return Err("No extractable text in PDF".into());
    }

    let raw_markdown = parts.join("\n\n---\n\n");

    // Collect extracted image files as assets
    let image_files: Vec<String> = fs::read_dir(image_dir)
        .map(|entries| {
            let mut files: Vec<String> = entries
                .filter_map(|e| e.ok())
                .filter_map(|e| {
                    let p = e.path();
                    let ext = p.extension()?.to_str()?;
                    if matches!(ext, "png" | "jpg" | "jpeg" | "gif" | "webp") {
                        Some(e.file_name().to_string_lossy().to_string())
                    } else {
                        None
                    }
                })
                .collect();
            files.sort();
            files
        })
        .unwrap_or_default();

    let assets: Vec<Asset> = image_files
        .iter()
        .map(|name| {
            let ext = Path::new(name)
                .extension()
                .and_then(|e| e.to_str())
                .unwrap_or("png");
            Asset {
                filename: name.clone(),
                url: format!("{}/{}", url_prefix, name),
                content_type: content_type_for(ext).to_string(),
            }
        })
        .collect();

    let images_count = assets.len() as i32;

    // Replace ![alt](path) with <image: filename - alt> for LLM-clean markdown
    let img_re = Regex::new(r"!\[([^\]]*)\]\([^\)]*?([^/\\\)]+)\)").unwrap();
    let markdown = img_re.replace_all(&raw_markdown, |caps: &regex::Captures| {
        let alt = caps.get(1).map_or("", |m| m.as_str()).trim();
        let filename = caps.get(2).map_or("image", |m| m.as_str());
        if alt.is_empty() {
            format!("<image: {}>", filename)
        } else {
            format!("<image: {} - {}>", filename, alt)
        }
    });

    // Clean up empty image dir
    if images_count == 0 {
        fs::remove_dir_all(image_dir).ok();
    }

    Ok(ParseResult {
        markdown: markdown.into_owned(),
        assets,
        images_count,
    })
}
