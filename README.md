# Spider Web Crawler

A production-grade, self-hosted web scraping API built in Rust with a Next.js dashboard. Features background job processing, stealth browser automation, proxy fallback, PDF support, and real-time monitoring.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Docker Compose                                │
│                                                                      │
│  ┌──────────────────┐  ┌─────────┐  ┌────────────────────────────┐ │
│  │  Rust API        │──│  Redis  │  │  Next.js Dashboard          │ │
│  │  (Axum)          │  │  Queue  │  │  (TanStack Query, shadcn)   │ │
│  │  + Workers       │  └─────────┘  │  :3400 → API :9000          │ │
│  │  + SQLite        │               └────────────────────────────┘ │
│  │  :9000           │                                               │
│  └──────────────────┘                                               │
└─────────────────────────────────────────────────────────────────────┘
```

- **Axum API** (`:9000`) — REST endpoints for submitting, polling, and managing scrape jobs
- **Redis** — Job queue (LPUSH/BRPOP) for worker coordination
- **SQLite** — Persistent storage for jobs, results, and metadata
- **Background Workers** — Tokio tasks pulling from Redis, running stealth browser scrapes
- **Next.js Dashboard** (`:3400`) — Real-time monitoring, playground, queue visualization, storage cleanup

## How It Works

1. **Submit Job** — Client POSTs a URL and mode to `/api/scrape`. The API creates a job record in SQLite, enqueues the task ID to Redis, and returns immediately with `task_id`.
2. **Worker Pickup** — Background workers block on Redis (BRPOP). When a task appears, a worker claims it and updates the job status to `running`.
3. **Scraping** — Depending on mode:
   - **scrape** — Launches headless Chrome, loads the page, waits for JS, extracts HTML → Markdown
   - **crawl** — Same as scrape but follows internal links up to `limit` pages
   - **http** — Fast HTTP fetch, no browser; uses spider for link following
4. **PDF Handling** — If the URL points to a PDF, the worker downloads it, converts to Markdown with embedded images, and stores images under `data/pdf_images/{task_id}/`.
5. **Completion** — Worker writes results to SQLite, updates job status to `completed` or `failed`, and loops back to Redis for the next task.
6. **Polling** — Clients GET `/api/scrape/{task_id}` to fetch job status and results.

---

## API Reference

Base URL: `http://localhost:9000` (or your deployed host)

### 1. Submit Scrape Job

**`POST /api/scrape`**

Creates a new scrape job and enqueues it for processing.

**Request Body:**

```json
{
  "url": "https://example.com/article",
  "mode": "scrape",
  "limit": 10,
  "wait_seconds": 3,
  "main_content": false
}
```

| Field          | Type    | Default    | Description                                     |
| -------------- | ------- | ---------- | ----------------------------------------------- |
| `url`          | string  | required   | URL to scrape                                   |
| `mode`         | string  | `"scrape"` | `scrape`, `crawl`, or `http`                    |
| `limit`        | number  | `10`       | Max pages to crawl (for crawl/http modes)       |
| `wait_seconds` | number  | `3`        | Seconds to wait for JS rendering (scrape/crawl) |
| `main_content` | boolean | `false`    | Extract only main article content               |

**Response** (`202 Accepted`):

```json
{
  "task_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "queued",
  "created_at": "2026-03-10T12:00:00Z"
}
```

---

### 2. List Jobs

**`GET /api/scrape?limit=50&offset=0`**

Returns a paginated list of all jobs.

**Query Parameters:**
| Param | Type | Default | Description |
|---------|--------|---------|--------------------|
| `limit`| number | `50` | Max jobs to return |
| `offset`| number| `0` | Pagination offset |

**Response** (`200 OK`):

```json
{
  "jobs": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "url": "https://example.com",
      "mode": "scrape",
      "page_limit": 10,
      "wait_seconds": 3,
      "status": "completed",
      "error": null,
      "pages_crawled": 1,
      "created_at": "2026-03-10T12:00:00Z",
      "started_at": "2026-03-10T12:00:01Z",
      "completed_at": "2026-03-10T12:00:05Z",
      "main_content": false
    }
  ],
  "total": 42,
  "limit": 50,
  "offset": 0
}
```

---

### 3. Get Job Detail

**`GET /api/scrape/{task_id}`**

Returns full job details including scraped results and metadata.

**Response** (`200 OK`):

```json
{
  "task_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "completed",
  "url": "https://example.com/article",
  "mode": "scrape",
  "pages_crawled": 1,
  "created_at": "2026-03-10T12:00:00Z",
  "started_at": "2026-03-10T12:00:01Z",
  "completed_at": "2026-03-10T12:00:05Z",
  "error": null,
  "results": [
    {
      "url": "https://example.com/article",
      "markdown": "# Article Title\n\nParagraph content...",
      "metadata": {
        "title": "Article Title",
        "description": "Meta description",
        "language": "en",
        "canonical_url": "https://example.com/article",
        "og_image": "https://example.com/og.jpg",
        "favicon": "https://example.com/favicon.ico",
        "word_count": 1250,
        "links_internal": 12,
        "links_external": 5,
        "images_count": 3,
        "headings": ["# Title", "## Section 1", "## Section 2"],
        "response_time_ms": 4200,
        "used_proxy": false,
        "crawled_at": "2026-03-10T12:00:04Z"
      },
      "assets": [
        {
          "filename": "page-1.png",
          "url": "/api/pdf-images/550e8400.../page-1.png",
          "content_type": "image/png"
        }
      ]
    }
  ]
}
```

**Error** (`404 Not Found`):

```json
{
  "error": "Not found: Job 550e8400-... not found"
}
```

---

### 4. Delete Job

**`DELETE /api/scrape/{task_id}`**

Permanently deletes a job, its results, and associated PDF images.

**Response** (`204 No Content`) — Empty body.

**Error** (`404 Not Found`):

```json
{
  "error": "Not found: Job 550e8400-... not found"
}
```

---

### 5. Serve PDF Image

**`GET /api/pdf-images/{task_id}/{filename}`**

Serves an image file extracted from a PDF during scraping. Used when viewing job results that include PDF-derived assets.

**Response** (`200 OK`) — Binary image (PNG, JPEG, etc.) with appropriate `Content-Type`.

**Error** (`404 Not Found`) — File not found or invalid path.

---

### 6. Get Stats

**`GET /api/stats`**

Returns aggregate job statistics and queue depth.

**Response** (`200 OK`):

```json
{
  "jobs": {
    "total": 150,
    "queued": 2,
    "running": 1,
    "completed": 140,
    "failed": 7,
    "total_pages_crawled": 312,
    "avg_response_time_ms": 4523.5,
    "total_results": 312
  },
  "queue_depth": 2,
  "max_workers": 3
}
```

---

### 7. Get Queue Status

**`GET /api/queue/status`**

Returns queue metrics and recent activity for pipeline visualization.

**Response** (`200 OK`):

```json
{
  "queue_depth": 2,
  "max_workers": 3,
  "running_jobs": 1,
  "queued_jobs": 2,
  "recent_activity": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "url": "https://example.com",
      "status": "completed",
      "mode": "scrape",
      "pages_crawled": 1,
      "error": null,
      "created_at": "2026-03-10T12:00:00Z",
      "started_at": "2026-03-10T12:00:01Z",
      "completed_at": "2026-03-10T12:00:05Z"
    }
  ]
}
```

---

### 8. Get System Info

**`GET /api/system`**

Returns health status, configuration, and recent failed jobs.

**Response** (`200 OK`):

```json
{
  "health": {
    "status": "ok",
    "redis": "connected",
    "sqlite": "connected"
  },
  "config": {
    "port": 9000,
    "max_workers": 3,
    "proxy_configured": true,
    "proxy_mode": "fallback",
    "database_url": "sqlite:///data/spider.db",
    "redis_url": "redis://redis:6379"
  },
  "recent_errors": [
    {
      "id": "abc123...",
      "url": "https://blocked-site.com",
      "status": "failed",
      "error": "Blocked by site: Cloudflare challenge",
      "completed_at": "2026-03-10T12:05:00Z"
    }
  ]
}
```

---

### 9. Health Check

**`GET /api/health`**

Lightweight health check for Redis and SQLite connectivity.

**Response** (`200 OK`):

```json
{
  "status": "ok",
  "redis": "connected",
  "sqlite": "connected"
}
```

`status` is `"ok"` when both Redis and SQLite are connected; otherwise `"degraded"`.

---

### 10. Storage Cleanup

**`POST /api/cleanup?mode=orphaned`**

Removes PDF image directories to free disk space.

**Query Parameters:**
| Param | Type | Default | Description |
|--------|--------|------------|-----------------------------------------------------------------------------|
| `mode` | string | `"orphaned"` | `orphaned` — remove dirs for jobs no longer in DB; `all` — remove everything |

**Response** (`200 OK`):

```json
{
  "removed_count": 5,
  "freed_bytes": 15728640
}
```

`removed_count` is the number of directories removed; `freed_bytes` is total bytes freed.

---

## Scrape Modes

| Mode     | Description              | Browser | Link Following |
| -------- | ------------------------ | ------- | -------------- |
| `scrape` | Single page with full JS | Yes     | No             |
| `crawl`  | Follow internal links    | Yes     | Yes            |
| `http`   | Fast HTTP crawl, no JS   | No      | Yes            |

---

## Quick Start

### Docker Compose

```bash
cp .env.example .env
docker compose up --build
```

- **API**: http://localhost:9000
- **Dashboard**: http://localhost:3400
- **Health**: http://localhost:9000/api/health

### Local Development

**Terminal 1 — Backend:**

```bash
# Start Redis first: docker run -d -p 6379:6379 redis:7-alpine
cargo run -- serve
```

**Terminal 2 — Web:**

```bash
cd web
npm install
API_URL=http://localhost:9000 npm run dev
```

---

## Project Structure

```
├── src/
│   ├── main.rs          # CLI/server entrypoint
│   ├── config.rs        # Environment configuration
│   ├── db.rs            # SQLite schema and queries
│   ├── queue.rs         # Redis job queue
│   ├── worker.rs        # Background worker loop
│   ├── crawler.rs       # Crawl logic (browser + HTTP)
│   ├── pdf.rs           # PDF scraping and image cleanup
│   ├── stealth.rs       # Anti-detection browser automation
│   └── api/
│       ├── mod.rs       # Axum router
│       ├── handlers.rs  # Route handlers
│       └── models.rs    # Request/response types
├── web/                 # Next.js 16 dashboard
│   ├── app/             # App Router pages
│   ├── components/      # shadcn/ui components
│   └── lib/api.ts       # API client + TanStack Query hooks
├── migrations/
├── docker-compose.yml
└── Dockerfile
```

---

## Tech Stack

**Backend:** axum, tokio, sqlx, redis, headless_chrome, spider, pdf_oxide  
**Frontend:** Next.js 16, React 19, TanStack Query, Tailwind v4, shadcn/ui

---

## License

[MIT](LICENSE)
