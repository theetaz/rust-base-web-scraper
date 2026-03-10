FROM rust:latest AS builder

RUN apt-get update && apt-get install -y pkg-config libssl-dev && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY Cargo.toml Cargo.lock ./
COPY src/ ./src/
COPY migrations/ ./migrations/

RUN cargo build --release

FROM debian:trixie-slim

RUN apt-get update && apt-get install -y ca-certificates chromium && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/target/release/spider-web-crawler /usr/local/bin/

ENV CHROME_PATH=/usr/bin/chromium
EXPOSE 9000
ENTRYPOINT ["spider-web-crawler", "serve"]
