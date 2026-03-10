#!/bin/bash
set -e

IMAGE_NAME="spider-web-crawler"
OUTPUT_DIR="./test-output"

echo "=== Spider Web Crawler Test ==="

# Clean previous output
rm -rf "$OUTPUT_DIR"
mkdir -p "$OUTPUT_DIR"

# Build Docker image
echo ""
echo "1. Building Docker image..."
docker build -t "$IMAGE_NAME" .

# Run crawl test (choosealicense.com is lightweight and reliable)
echo ""
echo "2. Crawling https://choosealicense.com (limit: 5 pages)..."
docker run --rm \
    --security-opt seccomp=unconfined \
    -v "$(cd "$OUTPUT_DIR" && pwd):/output" \
    "$IMAGE_NAME" \
    --url https://choosealicense.com --limit 5 --output /output

# Verify output
echo ""
echo "3. Verifying output..."

FILE_COUNT=$(ls -1 "$OUTPUT_DIR"/*.md 2>/dev/null | wc -l | tr -d ' ')

if [ "$FILE_COUNT" -gt 0 ]; then
    echo "SUCCESS: Found $FILE_COUNT markdown file(s) in $OUTPUT_DIR"
    echo ""
    echo "--- Files ---"
    ls -la "$OUTPUT_DIR"/*.md
    echo ""
    echo "--- Content preview (first file) ---"
    FIRST_FILE=$(ls "$OUTPUT_DIR"/*.md | head -1)
    head -30 "$FIRST_FILE"
else
    echo "FAIL: No markdown files found in $OUTPUT_DIR"
    exit 1
fi

echo ""
echo "=== Test Complete ==="
