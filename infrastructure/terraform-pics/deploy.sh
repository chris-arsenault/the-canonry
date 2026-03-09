#!/bin/bash
# deploy.sh - Build pics gallery app and deploy via Terraform
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

echo "==> Building pics app"
cd "$REPO_ROOT/apps/pics/webui"

if [ -d "dist" ]; then
  echo "    Cleaning old dist directory..."
  rm -rf dist
fi

pnpm install
pnpm run build

if [ ! -d "dist" ]; then
  echo "    ERROR: Missing dist directory after build"
  exit 1
fi

# Ensure remote state bucket exists
source "$REPO_ROOT/scripts/ensure-state-bucket.sh"

# Deploy with Terraform
cd "$SCRIPT_DIR"
terraform init \
  -backend-config="bucket=${STATE_BUCKET}" \
  -backend-config="region=${STATE_REGION}"
terraform apply

echo ""
echo "==> Deployment complete!"
terraform output website_url
