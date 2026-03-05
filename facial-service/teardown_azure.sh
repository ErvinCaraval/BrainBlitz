#!/usr/bin/env bash
set -euo pipefail

# Teardown script for Azure resources created by deploy scripts.
# It can delete container instances (ACI) for facial-service and redis,
# optionally delete ACR repositories, or delete the whole resource group.
# Usage: ./teardown_azure.sh [--yes] [--rg RESOURCE_GROUP]

NONINTERACTIVE=0
RG_OVERRIDE=""

while [[ $# -gt 0 ]]; do
  case $1 in
    --yes|-y)
      NONINTERACTIVE=1; shift ;;
    --rg)
      RG_OVERRIDE="$2"; shift 2 ;;
    --help|-h)
      echo "Usage: $0 [--yes] [--rg RESOURCE_GROUP]"; exit 0 ;;
    *)
      echo "Unknown arg: $1"; exit 1 ;;
  esac
done

# Load .env if present
if [ -f ".env" ]; then
  set -a
  # shellcheck source=/dev/null
  source .env
  set +a
fi

RESOURCE_GROUP="${RG_OVERRIDE:-${RESOURCE_GROUP:-facial-service-rg}}"

echo "Using resource group: $RESOURCE_GROUP"

if ! command -v az &> /dev/null; then
  echo "Azure CLI (az) not found. Install and login with 'az login'." >&2
  exit 1
fi

if ! az group show --name "$RESOURCE_GROUP" &> /dev/null; then
  echo "Resource group '$RESOURCE_GROUP' not found." >&2
  exit 1
fi

# List container instances in the RG
echo
echo "Container instances in resource group $RESOURCE_GROUP:"
az container list --resource-group "$RESOURCE_GROUP" --query "[].name" -o tsv || true

read -r -p $'Would you like to delete the container instances matching "facial" and/or "redis"? [Y/n]: ' ans
ans=${ans:-Y}
if [[ "$ans" =~ ^[Yy] ]]; then
  # fetch names
  CONTAINERS=$(az container list --resource-group "$RESOURCE_GROUP" --query "[].name" -o tsv || true)
  for cname in $CONTAINERS; do
    if [[ "$cname" =~ facial ]] || [[ "$cname" =~ redis ]] || [[ "$cname" =~ facial-service ]]; then
      if [ $NONINTERACTIVE -eq 1 ]; then
        echo "Deleting container: $cname"
        az container delete --resource-group "$RESOURCE_GROUP" --name "$cname" --yes || true
      else
        read -r -p "Delete container '$cname'? [y/N]: " delc
        if [[ "$delc" =~ ^[Yy] ]]; then
          az container delete --resource-group "$RESOURCE_GROUP" --name "$cname" --yes || true
        else
          echo "Skipping $cname"
        fi
      fi
    fi
  done
else
  echo "Skipping container deletion." 
fi

# Optionally delete ACR repositories if ACR_NAME set
if [ -n "${ACR_NAME:-}" ]; then
  echo
  read -r -p $'ACR registry detected. Do you want to delete repository tags for "facial-service" and "facial-service-redis"? [y/N]: ' delacr
  if [[ "$delacr" =~ ^[Yy] ]]; then
    # Delete tags 'latest' for common repos
    for repo in facial-service facial-service-redis; do
      echo "Deleting repo '$repo:latest' in ACR $ACR_NAME (if exists)..."
      az acr repository delete --name "$ACR_NAME" --repository "$repo" --tag latest --yes || true
    done
    echo "You can also remove entire repositories with 'az acr repository delete --name $ACR_NAME --repository <repo> --yes'"
  else
    echo "Skipping ACR cleanup."
  fi
fi

# Option to delete the whole resource group
echo
read -r -p $'Do you want to DELETE the entire resource group and all resources inside it? This is irreversible. [y/N]: ' delrg
if [[ "$delrg" =~ ^[Yy] ]]; then
  if [ $NONINTERACTIVE -eq 1 ]; then
    az group delete --name "$RESOURCE_GROUP" --yes --no-wait
    echo "Deletion of resource group initiated." 
  else
    read -r -p "Please type the resource group name to confirm deletion: " confirm
    if [ "$confirm" = "$RESOURCE_GROUP" ]; then
      az group delete --name "$RESOURCE_GROUP" --yes
      echo "Resource group deleted." 
    else
      echo "Confirmation mismatch. Aborting resource group deletion." 
    fi
  fi
else
  echo "Skipping resource group deletion." 
fi

echo
echo "Teardown complete. Verify via 'az container list -g $RESOURCE_GROUP' and 'az group show -n $RESOURCE_GROUP'"
