CREATE TABLE IF NOT EXISTS jobs (
    id TEXT PRIMARY KEY,
    url TEXT NOT NULL,
    mode TEXT NOT NULL DEFAULT 'scrape',
    page_limit INTEGER DEFAULT 10,
    wait_seconds INTEGER DEFAULT 3,
    status TEXT NOT NULL DEFAULT 'queued',
    error TEXT,
    pages_crawled INTEGER DEFAULT 0,
    created_at TEXT NOT NULL,
    started_at TEXT,
    completed_at TEXT
);

CREATE TABLE IF NOT EXISTS results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    markdown TEXT NOT NULL,
    title TEXT,
    description TEXT,
    language TEXT,
    canonical_url TEXT,
    og_image TEXT,
    favicon TEXT,
    word_count INTEGER DEFAULT 0,
    links_internal INTEGER DEFAULT 0,
    links_external INTEGER DEFAULT 0,
    images_count INTEGER DEFAULT 0,
    headings TEXT,
    response_time_ms INTEGER,
    used_proxy BOOLEAN DEFAULT FALSE,
    crawled_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_created ON jobs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_results_job ON results(job_id);
