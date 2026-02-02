#!/bin/bash
# deploy.sh - Build Canonry shell + all MFEs and deploy via Terraform
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
build_app "apps/name-forge/webui"
build_app "apps/cosmographer/webui"
build_app "apps/coherence-engine/webui"
build_app "apps/lore-weave/webui"
build_app "apps/illuminator/webui"
build_app "apps/archivist/webui"
build_app "apps/chronicler/webui"
build_app "apps/canonry/webui"

# Deploy with Terraform
# Terraform will:
# 1. Upload all files to S3 with proper cache-control headers
# 2. Automatically trigger CloudFront invalidation via action_trigger
cd "$SCRIPT_DIR"
terraform init
terraform apply

echo ""
echo "==> Deployment complete!"
terraform output website_url
