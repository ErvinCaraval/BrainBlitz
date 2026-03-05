#!/usr/bin/env bash
set -euo pipefail

# Push the Docker image for the facial-service to Docker Hub.
# Usage: set env DOCKERHUB_USER and DOCKERHUB_PASS or run interactively.

# Load .env if present (export variables)
if [ -f ".env" ]; then
  set -a
  # shellcheck source=/dev/null
  source .env
  set +a
fi

IMAGE_NAME="${IMAGE_NAME:-${DOCKERHUB_USER:-ervincaravaliibarra}/facial-service:latest}"
BUILD_CONTEXT_DIR="."

# Docker Hub credentials (can be provided via env vars or .env)
DOCKERHUB_USER="${DOCKERHUB_USER:-ervincaravaliibarra}"
DOCKERHUB_PASS="${DOCKERHUB_PASS:-}"

echo "Push facial-service image to Docker Hub"

if ! command -v docker &> /dev/null; then
  echo "❌ docker is not installed. Install Docker and try again." >&2
  exit 1
fi

if [ -z "${DOCKERHUB_USER:-}" ]; then
  read -p "Docker Hub username: " DOCKERHUB_USER
fi

if [ -z "${DOCKERHUB_PASS:-}" ]; then
  read -s -p "Docker Hub password (will not be echoed): " DOCKERHUB_PASS
  echo
fi

echo "Building image $IMAGE_NAME from $BUILD_CONTEXT_DIR..."
docker build -t "$IMAGE_NAME" "$BUILD_CONTEXT_DIR"

echo "Logging in to Docker Hub as $DOCKERHUB_USER..."
echo "$DOCKERHUB_PASS" | docker login --username "$DOCKERHUB_USER" --password-stdin

echo "Pushing image $IMAGE_NAME..."
docker push "$IMAGE_NAME"

echo "✅ Image pushed: $IMAGE_NAME"
echo "Tip: set IMAGE_NAME env to customize the repository: export IMAGE_NAME=youruser/yourrepo:tag"
