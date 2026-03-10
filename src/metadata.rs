use scraper::{Html, Selector};
use url::Url;

#[derive(Debug, Clone, Default, serde::Serialize)]
pub struct PageMetadata {
    pub title: Option<String>,
    pub description: Option<String>,
    pub language: Option<String>,
    pub canonical_url: Option<String>,
    pub og_image: Option<String>,
    pub favicon: Option<String>,
    pub word_count: i32,
    pub links_internal: i32,
    pub links_external: i32,
    pub images_count: i32,
    pub headings: Vec<String>,
}

pub fn extract_metadata(html: &str, page_url: &str) -> PageMetadata {
    let doc = Html::parse_document(html);
    let base_host = Url::parse(page_url)
        .ok()
        .and_then(|u| u.host_str().map(String::from));

    let title = select_attr(&doc, "title", None)
        .or_else(|| select_attr(&doc, "meta[property='og:title']", Some("content")));

    let description = select_attr(&doc, "meta[name='description']", Some("content"))
        .or_else(|| select_attr(&doc, "meta[property='og:description']", Some("content")));

    let language = doc
        .root_element()
        .select(&Selector::parse("html").unwrap())
        .next()
        .and_then(|el| el.value().attr("lang").map(String::from));

    let canonical_url =
        select_attr(&doc, "link[rel='canonical']", Some("href"));

    let og_image =
        select_attr(&doc, "meta[property='og:image']", Some("content"));

    let favicon = select_attr(&doc, "link[rel='icon']", Some("href"))
        .or_else(|| select_attr(&doc, "link[rel='shortcut icon']", Some("href")));

    // Count words in body text
    let body_text = Selector::parse("body")
        .ok()
        .and_then(|sel| doc.select(&sel).next())
        .map(|el| el.text().collect::<Vec<_>>().join(" "))
        .unwrap_or_default();
    let word_count = body_text.split_whitespace().count() as i32;

    // Count links
    let mut links_internal = 0i32;
    let mut links_external = 0i32;
    if let Ok(sel) = Selector::parse("a[href]") {
        for el in doc.select(&sel) {
            if let Some(href) = el.value().attr("href") {
                if let Ok(abs) = Url::parse(page_url).and_then(|base| base.join(href)) {
                    let link_host = abs.host_str().map(String::from);
                    if link_host == base_host {
                        links_internal += 1;
                    } else {
                        links_external += 1;
                    }
                }
            }
        }
    }

    // Count images
    let images_count = Selector::parse("img")
        .map(|sel| doc.select(&sel).count() as i32)
        .unwrap_or(0);

    // Extract headings
    let mut headings = Vec::new();
    for tag in &["h1", "h2", "h3"] {
        if let Ok(sel) = Selector::parse(tag) {
            for el in doc.select(&sel) {
                let text = el.text().collect::<String>().trim().to_string();
                if !text.is_empty() {
                    headings.push(text);
                }
            }
        }
    }

    PageMetadata {
        title,
        description,
        language,
        canonical_url,
        og_image,
        favicon,
        word_count,
        links_internal,
        links_external,
        images_count,
        headings,
    }
}

fn select_attr(doc: &Html, selector: &str, attr: Option<&str>) -> Option<String> {
    let sel = Selector::parse(selector).ok()?;
    let el = doc.select(&sel).next()?;
    match attr {
        Some(a) => el.value().attr(a).map(String::from),
        None => Some(el.text().collect::<String>().trim().to_string()),
    }
}
