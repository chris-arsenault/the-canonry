# Canonry Infrastructure

Terraform + AWS CLI configuration for deploying the Canonry full suite to AWS S3 + CloudFront.

Viewer-only deployment lives in `infrastructure/terraform-viewer`.

## Architecture

```
                    ┌─────────────────────────────────────┐
                    │          CloudFront CDN             │
                    │  ┌─────────────────────────────┐    │
User Request ──────▶│  │ /            ──▶ canonry    │    │
                    │  │ /name-forge/* ──▶ S3        │    │
                    │  │ /cosmographer/* ─▶ S3       │    │
                    │  │ /coherence-engine/* ─▶ S3   │    │
                    │  │ /lore-weave/* ───▶ S3       │    │
                    │  │ /illuminator/* ─▶ S3        │    │
                    │  │ /archivist/* ────▶ S3       │    │
                    │  │ /chronicler/* ──▶ S3        │    │
                    │  └─────────────────────────────┘    │
                    └─────────────────────────────────────┘
                                    │
                                    ▼
                    ┌─────────────────────────────────────┐
                    │            S3 Bucket                │
                    │  ┌───────────────────────────────┐  │
                    │  │ / (canonry shell)             │  │
                    │  │ /name-forge/                  │  │
                    │  │ /cosmographer/                │  │
                    │  │ /coherence-engine/            │  │
                    │  │ /lore-weave/                  │  │
                    │  │ /illuminator/                 │  │
                    │  │ /archivist/                   │  │
                    │  │ /chronicler/                  │  │
                    │  └───────────────────────────────┘  │
                    └─────────────────────────────────────┘
```

## Prerequisites

1. AWS CLI configured with appropriate credentials
2. Terraform >= 1.5
3. Node.js and npm (for building the webui)
4. Route53 hosted zone for your domain (must already exist)

## Resources Created

- **ACM Certificate** with DNS validation via Route53
- **S3 Bucket** with versioning, encryption, and private access
- **CloudFront Distribution** with Origin Access Control
- **CloudFront Response Headers Policy** for cache control
- **Route53 A Records** for apex and www subdomain

## Quick Start

```bash
cd infrastructure/terraform
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars if needed

./deploy.sh
```

## How It Works

The `deploy.sh` script performs the following steps:

### 1. Build Phase
- Cleans all existing `dist/` directories to remove stale artifacts
- Runs `npm install && npm run build` for each app:
  - name-forge, cosmographer, coherence-engine, lore-weave, illuminator, archivist, chronicler (MFE remotes)
  - canonry (shell application)

### 2. Terraform Apply
- Runs `terraform apply` to:
  - Create/update infrastructure (S3, CloudFront, ACM, Route53)
  - Upload all files to S3 via `aws_s3_object` resources with proper cache headers:
    - **Static assets** (hashed JS/CSS): `max-age=31536000, immutable` (1 year cache)
    - **HTML files**: `no-cache, no-store, must-revalidate` (never cached)
    - **remoteEntry.js**: `no-cache, no-store, must-revalidate` (Module Federation entry points)
    - **JSON manifests**: `max-age=60` (1 minute cache)
  - Automatically trigger CloudFront invalidation when S3 objects are updated via `action_trigger`

## Configuration

### Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `aws_region` | AWS region | `us-east-1` |
| `prefix` | Project prefix for namespacing resources | `canonry` |
| `domain_name` | Domain name | `the-canonry.com` |

Resource names are derived from the prefix:
- S3 bucket: `{prefix}-static-{account_id}`
- CloudFront OAC: `{prefix}-oac`

Tags are applied automatically via provider `default_tags`.

## Outputs

- `website_url` - Full URL to access the site
- `cloudfront_distribution_id` - Distribution ID (used by deploy.sh)
- `bucket_name` - S3 bucket name (used by deploy.sh)
- `s3_bucket_name` - S3 bucket name (deprecated alias)
- `s3_bucket_arn` - S3 bucket ARN
- `acm_certificate_arn` - Certificate ARN
- `route53_zone_id` - Hosted zone ID

## Cache Strategy

### Why This Approach Works

**Problem Solved:**
- HTML files could reference new JS files before proper cache headers were set → 404 errors
- CloudFront cache invalidation wasn't triggered automatically → users saw old content
- No proper cache-control headers → browsers and CDN cached everything the same way
- Stale files accumulated in dist directories → Terraform saw old and new files

**Solution:**
1. **Clean builds**: Remove all `dist/` directories before building to prevent Terraform from seeing stale files
2. **Proper cache headers in Terraform**:
   - Hashed assets cached for 1 year (immutable)
   - HTML/entry points never cached (always fresh)
   - Manifests cached briefly (60s) for federation coordination
3. **Automatic invalidation**: `action_trigger` in lifecycle block triggers CloudFront invalidation after S3 updates
4. **create_before_destroy lifecycle**: Ensures new files are uploaded before old ones are replaced

### CloudFront Behavior

CloudFront respects S3 `Cache-Control` headers when `min_ttl=0`:
- Assets with `immutable`: Cached for 1 year at edge
- HTML with `no-cache`: Always fetched from S3 (bypasses edge cache)
- This prevents the "new HTML → old JS" race condition

## Cache Invalidation

Cache invalidation happens automatically during `terraform apply` via the `action_trigger` lifecycle hook. When S3 objects are updated, Terraform triggers the CloudFront invalidation action.

If you need to manually invalidate cache outside of deployment:
```bash
DIST_ID=$(terraform output -raw cloudfront_distribution_id)
aws cloudfront create-invalidation --distribution-id "$DIST_ID" --paths "/*"
```

## Troubleshooting

### Site Not Loading After Deployment

1. Check CloudFront invalidation completed:
```bash
aws cloudfront list-invalidations --distribution-id $(terraform output -raw cloudfront_distribution_id)
```

2. Verify S3 files have correct cache headers:
```bash
aws s3api head-object --bucket $(terraform output -raw bucket_name) --key index.html
```

3. Check browser cache - use hard refresh (Ctrl+Shift+R)

### Stale Files in S3

Terraform tracks files via `fileset()` which scans the dist directories. If you see stale files:

1. Clean all dist directories and rebuild:
```bash
for app in apps/*/webui; do rm -rf "$app/dist"; done
./deploy.sh
```

2. Alternatively, manually remove stale files from S3:
```bash
aws s3 rm s3://$(terraform output -raw bucket_name)/path/to/stale-file.js
```

3. To force Terraform to re-upload everything:
```bash
terraform taint 'aws_s3_object.app_assets["canonry:index.html"]'
terraform apply
```
