#!/bin/bash
# deploy.sh - Build viewer shell + required MFEs and deploy via Terraform
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"


build_app() {
  local app_path="$1"
  echo "==> Building ${app_path}"
  cd "$REPO_ROOT/$app_path"

  # CRITICAL: Remove old build artifacts to prevent stale files
  # This ensures Terraform only sees current files via fileset()
  if [ -d "dist" ]; then
    echo "    Cleaning old dist directory..."
    rm -rf dist
  fi

  npm install
  npm run build

  sanity_check_dist "$app_path"
}

sanity_check_dist() {
  local app_path="$1"
  local dist_dir="$REPO_ROOT/$app_path/dist"

  if [ ! -d "$dist_dir" ]; then
    echo "    ERROR: Missing dist directory after build: ${dist_dir}"
    exit 1
  fi

  local index_hits
  index_hits=$(grep -n -E "@vite/client|/@react-refresh" "$dist_dir/index.html" 2>/dev/null || true)
  if [ -n "$index_hits" ]; then
    echo "    ERROR: Dev server markers found in index.html for ${app_path}"
    echo "$index_hits"
    exit 1
  fi

  local js_hits
  js_hits=$(grep -R -n -I -E "react-refresh|jsx-dev-runtime|@vite/client" "$dist_dir" --include='*.js' 2>/dev/null || true)
  if [ -n "$js_hits" ]; then
    echo "    ERROR: Dev-only runtime markers found in JS bundle for ${app_path}"
    echo "$js_hits" | head -n 20
    exit 1
  fi
}

# Build remotes first, then the shell
build_app "apps/archivist/webui"
build_app "apps/chronicler/webui"
build_app "apps/viewer/webui"

# Deploy with Terraform
# Terraform will:
# 1. Upload all files to S3 with proper cache-control headers
# 2. Automatically trigger CloudFront invalidation via action_trigger
cd "$SCRIPT_DIR"
terraform init
terraform apply

# Optimize S3 image variants (raw -> webp/thumb) based on manifest
IMAGE_BUCKET=$(terraform output -raw image_bucket_name 2>/dev/null || true)
IMAGE_PREFIX="${IMAGE_PREFIX:-}"
if [ -n "$IMAGE_BUCKET" ]; then
  REGION_OUTPUT=$(terraform output -raw aws_region 2>/dev/null || true)
  REGION="${AWS_REGION:-${AWS_DEFAULT_REGION:-$REGION_OUTPUT}}"
  if [ -z "$REGION" ]; then
    REGION="us-east-1"
  fi
  export AWS_REGION="$REGION"
  export AWS_DEFAULT_REGION="$REGION"
  MANIFEST_KEY="${IMAGE_MANIFEST_KEY:-${IMAGE_PREFIX%/}/image-manifest.json}"
  MANIFEST_KEY="${MANIFEST_KEY#/}"
  echo "==> Optimizing image variants in s3://${IMAGE_BUCKET}/${MANIFEST_KEY}"
  node "$REPO_ROOT/apps/viewer/webui/scripts/optimize-s3-images.mjs" --bucket "$IMAGE_BUCKET" --manifest-key "$MANIFEST_KEY" --region "$REGION"
fi

echo ""
echo "==> Deployment complete!"
terraform output website_url
