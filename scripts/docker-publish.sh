#!/usr/bin/env bash
set -euo pipefail

# Docker Hub multi-platform build & push script
# Usage: ./scripts/docker-publish.sh [--tag v1.0.0] [--registry theetaz]

REGISTRY="${DOCKER_REGISTRY:-theetaz}"
TAG="${1:-latest}"
PLATFORMS="linux/amd64,linux/arm64"

# Parse args
while [[ $# -gt 0 ]]; do
    case $1 in
        --tag) TAG="$2"; shift 2 ;;
        --registry) REGISTRY="$2"; shift 2 ;;
        *) shift ;;
    esac
done

API_IMAGE="${REGISTRY}/spider-web-crawler-api"
WEB_IMAGE="${REGISTRY}/spider-web-crawler-web"

echo "=== Spider Web Crawler - Docker Publish ==="
echo "Registry:  ${REGISTRY}"
echo "Tag:       ${TAG}"
echo "Platforms: ${PLATFORMS}"
echo ""

# Ensure buildx builder exists
if ! docker buildx inspect spider-builder &>/dev/null; then
    echo "Creating buildx builder..."
    docker buildx create --name spider-builder --use --bootstrap
else
    docker buildx use spider-builder
fi

# Build and push API image
echo ""
echo "--- Building API image: ${API_IMAGE}:${TAG} ---"
docker buildx build \
    --platform "${PLATFORMS}" \
    --tag "${API_IMAGE}:${TAG}" \
    --tag "${API_IMAGE}:latest" \
    --file Dockerfile \
    --push \
    .

# Build and push Web image
echo ""
echo "--- Building Web image: ${WEB_IMAGE}:${TAG} ---"
docker buildx build \
    --platform "${PLATFORMS}" \
    --tag "${WEB_IMAGE}:${TAG}" \
    --tag "${WEB_IMAGE}:latest" \
    --file web/Dockerfile \
    --build-arg API_URL=http://api:9000 \
    --push \
    ./web

echo ""
echo "=== Published ==="
echo "  ${API_IMAGE}:${TAG}"
echo "  ${WEB_IMAGE}:${TAG}"
echo ""
echo "Pull with:"
echo "  docker pull ${API_IMAGE}:${TAG}"
echo "  docker pull ${WEB_IMAGE}:${TAG}"
