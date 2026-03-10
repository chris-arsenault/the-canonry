#!/bin/bash
# deploy.sh - Build viewer + pics apps and deploy via Terraform
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

  pnpm install
  pnpm run build

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

# Build both apps
build_app "apps/viewer/webui"
build_app "apps/pics/webui"

# Ensure remote state bucket exists
source "$REPO_ROOT/scripts/ensure-state-bucket.sh"

# Initialize Terraform
cd "$SCRIPT_DIR"
terraform init \
  -backend-config="bucket=${STATE_BUCKET}" \
  -backend-config="region=${STATE_REGION}"

# Try to inject catalog into pics index.html (optional — requires prior image sync)
echo ""
echo "==> Injecting catalog into pics index.html"
IMAGE_BUCKET=$(terraform output -raw image_bucket_name 2>/dev/null || true)
if [ -n "$IMAGE_BUCKET" ]; then
  echo "    Image bucket: ${IMAGE_BUCKET}"
  echo "    Searching for catalog.json in bucket..."
  CATALOG_MATCHES=$(aws s3api list-objects-v2 --bucket "$IMAGE_BUCKET" \
    --query "Contents[?ends_with(Key, 'catalog.json')].{Key: Key, Size: Size}" \
    --output json 2>/dev/null || echo "[]")
  echo "    Found: ${CATALOG_MATCHES}"
  CATALOG_KEY=$(echo "$CATALOG_MATCHES" | jq -r '.[0].Key // empty')

  if [ -n "$CATALOG_KEY" ]; then
    echo "    Using: s3://${IMAGE_BUCKET}/${CATALOG_KEY}"
    aws s3 cp "s3://${IMAGE_BUCKET}/${CATALOG_KEY}" /tmp/pics-catalog.json
    echo "    Downloaded ($(wc -c < /tmp/pics-catalog.json) bytes, $(jq '.images | length' /tmp/pics-catalog.json) images)"

    # Patch baseUrl to viewer domain so pics app loads images cross-origin
    VIEWER_URL=$(terraform output -raw website_url 2>/dev/null | sed 's|/$||')
    if [ -n "$VIEWER_URL" ]; then
      echo "    Patching catalog baseUrl to: ${VIEWER_URL}"
      jq --arg url "$VIEWER_URL" '.baseUrl = $url' /tmp/pics-catalog.json > /tmp/pics-catalog-patched.json
      mv /tmp/pics-catalog-patched.json /tmp/pics-catalog.json
    fi

    # Inject first N images into HTML for instant render
    node "$REPO_ROOT/apps/pics/scripts/inject-catalog.mjs" /tmp/pics-catalog.json "$REPO_ROOT/apps/pics/webui/dist/index.html"
    # Copy full catalog to pics dist so it's served from the pics static bucket
    cp /tmp/pics-catalog.json "$REPO_ROOT/apps/pics/webui/dist/catalog.json"
    echo "    Copied catalog.json to pics dist (background fetch)"
    rm -f /tmp/pics-catalog.json
  else
    echo "    No catalog.json found in image bucket — skipping injection."
    echo "    Run S3 sync from Canonry to generate it, then re-deploy."
  fi
else
  echo "    No existing state — skipping catalog injection (first deployment)."
fi

# Deploy everything
terraform apply

echo ""
echo "==> Deployment complete!"
terraform output website_url
PICS_URL=$(terraform output -raw pics_website_url 2>/dev/null || true)
if [ -n "$PICS_URL" ]; then
  echo "Pics: ${PICS_URL}"
fi
