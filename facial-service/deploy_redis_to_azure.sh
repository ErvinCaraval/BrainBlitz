#!/usr/bin/env bash
set -euo pipefail

# Deploy the redis image present in ./redis to Azure Container Instances.
# This script supports two flows:
# 1) Build & push to Azure Container Registry (ACR) then create an ACI using that image.
# 2) Use an image already on Docker Hub (IMAGE_NAME) and create an ACI from it.
#
# Required tools: az (Azure CLI). For flow 1 you must be logged in `az login` and have permission
# to create resources. For flow 2 you must have pushed the image to Docker Hub already.

# Configuration (override via env vars)
# Load .env if present (export variables)
if [ -f ".env" ]; then
  set -a
  # shellcheck source=/dev/null
  source .env
  set +a
fi

RESOURCE_GROUP="${RESOURCE_GROUP:-facial-service-rg}"
LOCATION="${LOCATION:-brazilsouth}"
ACR_NAME="${ACR_NAME:-}"            # if provided, use ACR build flow
IMAGE_NAME="${IMAGE_NAME:-ervincaravaliibarra/facial-service-redis:latest}"        # docker hub image (if not using ACR)
DOCKERHUB_USER="${DOCKERHUB_USER:-ervincaravaliibarra}"
DOCKERHUB_PASS="${DOCKERHUB_PASS:-}"
CONTAINER_NAME="${CONTAINER_NAME:-facial-service-redis}"
DNS_NAME_LABEL="${DNS_NAME_LABEL:-facial-service-redis-$(date +%s)}"
CPU="${CPU:-1}"
MEMORY="${MEMORY:-1}"

echo "Deploy Redis to Azure Container Instances"

if ! command -v az &> /dev/null; then
  echo "❌ Azure CLI (az) not found. Install it and authenticate with 'az login'." >&2
  exit 1
fi

# Ensure resource group exists
if ! az group show --name "$RESOURCE_GROUP" &> /dev/null; then
  echo "Creating resource group $RESOURCE_GROUP in $LOCATION..."
  az group create --name "$RESOURCE_GROUP" --location "$LOCATION"
fi

if [ -n "$ACR_NAME" ]; then
  # Build in ACR from local ./redis context
  echo "Using ACR build flow with registry: $ACR_NAME"
  echo "Building image in ACR from ./redis (this may take a while)..."
  az acr build --registry "$ACR_NAME" -g "$RESOURCE_GROUP" -t "${CONTAINER_NAME}:latest" ./redis

  # Image reference
  REGISTRY_LOGIN_SERVER=$(az acr show -n "$ACR_NAME" -g "$RESOURCE_GROUP" --query loginServer -o tsv)
  IMAGE_REF="$REGISTRY_LOGIN_SERVER/${CONTAINER_NAME}:latest"
else
  if [ -z "$IMAGE_NAME" ]; then
    echo "ERROR: Either set ACR_NAME to use ACR build, or set IMAGE_NAME to an existing Docker Hub image." >&2
    echo "Example usage (Docker Hub): IMAGE_NAME=youruser/facial-service-redis:latest ./deploy_redis_to_azure.sh" >&2
    exit 1
  fi
  IMAGE_REF="$IMAGE_NAME"
fi

echo "Creating container instance $CONTAINER_NAME using image $IMAGE_REF"

# If image is on a private registry (ACR), provide registry credentials automatically using --registry-login-server and service principal is not required when using ACR with the same subscription.
if [ -n "$ACR_NAME" ]; then
  REGISTRY_USER=$(az acr credential show -n "$ACR_NAME" -g "$RESOURCE_GROUP" --query username -o tsv || true)
  REGISTRY_PASS=$(az acr credential show -n "$ACR_NAME" -g "$RESOURCE_GROUP" --query passwords[0].value -o tsv || true)
  az container create \
    --resource-group "$RESOURCE_GROUP" \
    --name "$CONTAINER_NAME" \
    --image "$IMAGE_REF" \
    --cpu "$CPU" --memory "$MEMORY" \
    --dns-name-label "$DNS_NAME_LABEL" \
    --ports 6379 \
    --registry-login-server "$REGISTRY_LOGIN_SERVER" \
    --registry-username "$REGISTRY_USER" \
    --registry-password "$REGISTRY_PASS" \
    --restart-policy Always
else
  # If using Docker Hub public image (or already logged in), create ACI without registry creds
  # If Docker Hub credentials are provided, pass them to ACI so private images work
  if [ -n "$DOCKERHUB_USER" ] && [ -n "$DOCKERHUB_PASS" ]; then
    echo "Using Docker Hub credentials to pull private image from Docker Hub"
    az container create \
      --resource-group "$RESOURCE_GROUP" \
      --name "$CONTAINER_NAME" \
      --image "$IMAGE_REF" \
      --cpu "$CPU" --memory "$MEMORY" \
      --dns-name-label "$DNS_NAME_LABEL" \
      --ports 6379 \
      --registry-login-server docker.io \
      --registry-username "$DOCKERHUB_USER" \
      --registry-password "$DOCKERHUB_PASS" \
      --restart-policy Always
  else
    az container create \
      --resource-group "$RESOURCE_GROUP" \
      --name "$CONTAINER_NAME" \
      --image "$IMAGE_REF" \
      --cpu "$CPU" --memory "$MEMORY" \
      --dns-name-label "$DNS_NAME_LABEL" \
      --ports 6379 \
      --restart-policy Always
  fi
fi

echo "Waiting 10s for container instance to initialize..."
sleep 10

FQDN=$(az container show -g "$RESOURCE_GROUP" -n "$CONTAINER_NAME" --query ipAddress.fqdn -o tsv || true)
IP_ADDRESS=$(az container show -g "$RESOURCE_GROUP" -n "$CONTAINER_NAME" --query ipAddress.ip -o tsv || true)

echo "Deployed:"
echo "  Container: $CONTAINER_NAME"
echo "  Image: $IMAGE_REF"
echo "  FQDN: $FQDN"
echo "  IP: $IP_ADDRESS"

echo "⚠️ Note: This deployment runs Redis as a container in ACI and does NOT provide managed Redis features (persistence, backups, auth, high availability)."
echo "For production use prefer Azure Cache for Redis (managed) and configure your facial-service to use that endpoint via REDIS_URL."

# Construct REDIS_URL and write/update .env so other scripts (deploy_to_azure.sh) can pick it up
if [ -n "$FQDN" ] && [ "$FQDN" != "None" ]; then
  REDIS_HOST="$FQDN"
elif [ -n "$IP_ADDRESS" ]; then
  REDIS_HOST="$IP_ADDRESS"
else
  REDIS_HOST=""
fi

if [ -n "$REDIS_HOST" ]; then
  # If a password is provided via REDIS_PASSWORD or REDIS_PASS, include it
  REDIS_PASSWORD_VAL="${REDIS_PASSWORD:-${REDIS_PASS:-}}"
  if [ -n "$REDIS_PASSWORD_VAL" ]; then
    REDIS_URL_VAL="redis://:${REDIS_PASSWORD_VAL}@${REDIS_HOST}:6379/0"
  else
    REDIS_URL_VAL="redis://${REDIS_HOST}:6379/0"
  fi

  echo "Detected Redis endpoint: $REDIS_URL_VAL"

  # Update or append to .env
  ENVFILE=.env
  if [ ! -f "$ENVFILE" ]; then
    echo "# Generated by deploy_redis_to_azure.sh" > "$ENVFILE"
  fi

  if grep -qE '^REDIS_URL=' "$ENVFILE"; then
    # replace existing line
    sed -i.bak -E "s|^REDIS_URL=.*|REDIS_URL=${REDIS_URL_VAL}|" "$ENVFILE" && rm -f "${ENVFILE}.bak"
  else
    echo "REDIS_URL=${REDIS_URL_VAL}" >> "$ENVFILE"
  fi

  # Export for current shell (so later commands in this script can use it)
  export REDIS_URL="$REDIS_URL_VAL"
else
  echo "Warning: could not determine Redis host (no FQDN/IP). REDIS_URL not written to .env"
fi
