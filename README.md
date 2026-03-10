# Spider Web Crawler

A production-grade, self-hosted web scraping API built in Rust with a Next.js dashboard. Features background job processing, stealth browser automation, proxy fallback, and real-time monitoring.

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│                     Docker Compose                        │
│                                                           │
│  ┌──────────────┐  ┌───────┐  ┌────────────────────────┐ │
│  │  Rust API    │──│ Redis │  │  Next.js Dashboard     │ │
│  │  (Axum)      │  │       │  │  (TanStack Query)      │ │
│  │  + Workers   │  └───────┘  │  :3400 → API :9000     │ │
│  │  + SQLite    │             └────────────────────────┘ │
│  │  :9000       │                                        │
│  └──────────────┘                                        │
└──────────────────────────────────────────────────────────┘
```

- **Axum API** (`:9000`) — REST endpoints for submitting/polling scrape jobs
- **Redis** — Job queue (LPUSH/BRPOP for worker coordination)
- **SQLite** — Persistent storage for jobs, results, and metadata
- **Background Workers** — Tokio tasks pulling from Redis, running stealth browser scrapes
- **Next.js Dashboard** (`:3400`) — Real-time monitoring, playground, queue visualization

## Features

- **Three scrape modes**: `scrape` (single page with browser), `crawl` (follow links with browser), `http` (fast, no browser)
- **Stealth browser automation**: UA rotation, viewport randomization, WebGL/Canvas fingerprint spoofing, CDP marker cleanup
- **Proxy fallback**: Auto-detects blocking (403, 429, Cloudflare challenges) and retries via configured proxy
- **Background job processing**: Redis-backed queue with configurable worker count
- **Rich metadata extraction**: Title, description, OG tags, word count, links, headings, response time
- **HTML to Markdown conversion**: Clean markdown output via spider_transformations
- **Real-time dashboard**: Live job monitoring, playground for testing, queue visualization, API tester
- **CLI mode**: Direct scraping without the API server

## Quick Start

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/) and Docker Compose

### Run with Docker Compose

```bash
# Clone the repository
git clone https://github.com/theetaz/rust-base-web-scraper.git
cd rust-base-web-scraper

# Copy environment config
cp .env.example .env

# Start all services
docker compose up --build
```

- **API**: http://localhost:9000
- **Dashboard**: http://localhost:3400
- **Health check**: http://localhost:9000/api/health

### Configure Proxy (Optional)

Edit `.env` to add proxy credentials:

```env
PROXY_HOST=proxy.example.com
PROXY_PORT=8080
PROXY_USERNAME=your_username
PROXY_PASSWORD=your_password
PROXY_PROTOCOL=http  # or socks5
```

#### Proxy Mode

Control when the proxy is used with the `PROXY_MODE` environment variable:

| Mode | Description |
|------|-------------|
| `fallback` | Try direct first, use proxy only when blocked (default) |
| `always` | Route all requests through the proxy |
| `never` | Never use proxy, even if configured |

```env
PROXY_MODE=fallback  # default
```

Restart the API container to apply:

```bash
docker compose up -d api
```

## API Endpoints

### Submit a scrape job

```bash
curl -X POST http://localhost:9000/api/scrape \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com", "mode": "scrape", "limit": 10, "wait_seconds": 3}'
```

**Response** (`202 Accepted`):
```json
{
  "task_id": "550e8400-...",
  "status": "queued",
  "created_at": "2026-03-10T12:00:00Z"
}
```

### Poll job status

```bash
curl http://localhost:9000/api/scrape/{task_id}
```

### Other endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/scrape` | List all jobs (with `?limit=50&offset=0`) |
| `GET` | `/api/scrape/:id` | Get job details and results |
| `DELETE` | `/api/scrape/:id` | Delete a job and its results |
| `GET` | `/api/stats` | Job statistics and metrics |
| `GET` | `/api/queue/status` | Queue depth and worker status |
| `GET` | `/api/system` | System health and configuration |
| `GET` | `/api/health` | Health check (Redis + SQLite) |

## Scrape Modes

| Mode | Description | Browser | Link Following |
|------|-------------|---------|----------------|
| `scrape` | Single page with full JS rendering | Yes | No |
| `crawl` | Follow internal links with browser | Yes | Yes |
| `http` | Fast HTTP crawl, no JS rendering | No | Yes |

## CLI Mode

Run scrapes directly without the API server:

```bash
# Single page scrape with browser
spider-web-crawler cli --url "https://example.com" --scrape --wait 5

# Crawl with browser (follow links)
spider-web-crawler cli --url "https://example.com" --browser --limit 10

# HTTP crawl (no browser, fastest)
spider-web-crawler cli --url "https://example.com" --limit 20
```

## Dashboard

The web dashboard at `http://localhost:3400` provides:

- **Dashboard** — Job list with real-time status updates, statistics cards
- **Playground** — Interactive URL scraper with live results, markdown preview
- **Queue Monitor** — Pipeline visualization, worker slots, throughput metrics
- **System** — Health indicators, configuration, API tester, error logs

## Project Structure

```
├── src/
│   ├── main.rs          # CLI/server entrypoint
│   ├── config.rs        # Environment configuration
│   ├── error.rs         # Error types
│   ├── db.rs            # SQLite schema and queries
│   ├── queue.rs         # Redis job queue
│   ├── worker.rs        # Background worker loop
│   ├── crawler.rs       # Crawl logic (browser + HTTP)
│   ├── stealth.rs       # Anti-detection browser automation
│   ├── proxy.rs         # Block detection and proxy fallback
│   ├── metadata.rs      # HTML metadata extraction
│   └── api/
│       ├── mod.rs       # Axum router
│       ├── handlers.rs  # Route handlers
│       └── models.rs    # Request/response types
├── migrations/
│   └── 001_init.sql     # SQLite schema
├── web/                 # Next.js dashboard
│   ├── app/             # App Router pages
│   ├── components/      # React components
│   └── lib/api.ts       # API client + TanStack Query hooks
├── scripts/
│   └── docker-publish.sh # Multi-platform Docker build & push
├── docker-compose.yml
├── Dockerfile           # API container
└── .env.example         # Environment template
```

## Development

### Local Rust development

```bash
# Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Build
cargo build

# Run API server (requires Redis)
REDIS_URL=redis://127.0.0.1:6379 cargo run -- serve

# Run CLI mode
cargo run -- cli --url "https://example.com" --scrape
```

### Local frontend development

```bash
cd web
npm install
npm run dev  # http://localhost:3000
```

## Docker Hub

### Pull pre-built images

```bash
docker pull theetaz/spider-web-crawler-api:latest
docker pull theetaz/spider-web-crawler-web:latest
```

### Build and push (maintainers)

```bash
# Login to Docker Hub
docker login

# Build and push multi-platform images
./scripts/docker-publish.sh --tag v1.0.0 --registry theetaz
```

## Tech Stack

### Backend (Rust)
- **axum** — Web framework
- **tokio** — Async runtime
- **sqlx** — SQLite async driver
- **redis** — Job queue
- **headless_chrome** — Browser automation
- **spider** — HTTP crawling
- **scraper** — HTML parsing

### Frontend (TypeScript)
- **Next.js 15** — React framework (App Router)
- **TanStack Query** — Server state management
- **Tailwind CSS v4** — Styling
- **react-markdown** — Markdown rendering

## License

[MIT](LICENSE)
