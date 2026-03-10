mod api;
mod config;
mod crawler;
mod db;
mod error;
mod metadata;
mod proxy;
mod queue;
mod stealth;
mod worker;

use clap::{Parser, Subcommand};
use std::sync::Arc;

#[derive(Parser)]
#[command(
    name = "spider-web-crawler",
    about = "Production-grade web scraping API & CLI"
)]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    /// Run as API server with background workers
    Serve,
    /// CLI mode: scrape/crawl a URL directly
    #[command(name = "cli")]
    CliMode {
        /// URL to crawl
        #[arg(short, long)]
        url: String,

        /// Maximum number of pages to crawl
        #[arg(short, long, default_value = "10")]
        limit: u32,

        /// Output directory for markdown files
        #[arg(short, long, default_value = "output")]
        output: String,

        /// Use headless browser (bypasses anti-bot, renders JS)
        #[arg(short, long)]
        browser: bool,

        /// Scrape a single page only (no link following), implies --browser
        #[arg(short, long)]
        scrape: bool,

        /// Extra wait time in seconds for JS-heavy pages
        #[arg(short, long, default_value = "3")]
        wait: u64,
    },
}

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "info".into()),
        )
        .init();

    let cli = Cli::parse();

    match cli.command {
        Commands::Serve => run_server().await,
        Commands::CliMode {
            url,
            limit,
            output,
            browser,
            scrape,
            wait,
        } => run_cli(url, limit, output, browser, scrape, wait).await,
    }
}

async fn run_server() {
    let cfg = config::Config::from_env();
    tracing::info!("Starting server on port {}", cfg.port);

    // Initialize SQLite
    let pool = db::init_pool(&cfg.database_url)
        .await
        .expect("Failed to initialize database");
    let pool = Arc::new(pool);

    // Connect to Redis
    let redis_client =
        redis::Client::open(cfg.redis_url.as_str()).expect("Invalid Redis URL");
    let redis_conn = redis_client
        .get_multiplexed_async_connection()
        .await
        .expect("Failed to connect to Redis");

    tracing::info!("Connected to Redis and SQLite");

    // Start background workers
    let cfg = Arc::new(cfg);
    worker::start_workers(pool.clone(), cfg.clone()).await;

    // Build API router
    let state = api::AppState {
        db: pool,
        redis: redis_conn,
        config: cfg.clone(),
    };
    let app = api::create_router(state);

    let addr = format!("0.0.0.0:{}", cfg.port);
    tracing::info!("API listening on {}", addr);
    let listener = tokio::net::TcpListener::bind(&addr)
        .await
        .expect("Failed to bind");
    axum::serve(listener, app).await.expect("Server error");
}

async fn run_cli(url: String, limit: u32, output: String, browser: bool, scrape: bool, wait: u64) {
    use std::fs;
    use std::path::Path;

    let output_dir = Path::new(&output);
    fs::create_dir_all(output_dir).expect("Failed to create output directory");

    println!("Crawling: {}", url);
    println!("Page limit: {}", limit);
    println!("Output dir: {}", output);
    println!("Browser mode: {}", browser || scrape);

    let results = if scrape {
        tokio::task::spawn_blocking(move || crawler::scrape_single(&url, wait, None))
            .await
            .expect("Task panicked")
            .expect("Scrape failed")
    } else if browser {
        tokio::task::spawn_blocking(move || crawler::crawl_browser(&url, limit, wait, None))
            .await
            .expect("Task panicked")
            .expect("Crawl failed")
    } else {
        crawler::crawl_http(&url, limit).await
    };

    println!("Crawled {} pages", results.len());

    for (i, result) in results.iter().enumerate() {
        let filename = format!("page_{}.md", i + 1);
        let filepath = output_dir.join(&filename);
        fs::write(&filepath, &result.markdown).expect("Failed to write markdown file");
        println!("[{}] {} -> {}", i + 1, result.url, filename);
    }

    println!("Done! Saved {} markdown files to {}", results.len(), output);
}
