# Penguin Tales Viewer Infrastructure

Terraform + AWS CLI configuration for deploying the Penguin Tales viewer (Archivist + Chronicler) to AWS S3 + CloudFront.

## Architecture

```
                    ┌─────────────────────────────────────┐
                    │          CloudFront CDN             │
                    │  ┌─────────────────────────────┐    │
User Request ──────▶│  │ /            ──▶ viewer     │    │
                    │  │ /archivist/* ──▶ S3        │    │
                    │  │ /chronicler/* ─▶ S3        │    │
                    │  └─────────────────────────────┘    │
                    └─────────────────────────────────────┘
                                    │
                                    ▼
                    ┌─────────────────────────────────────┐
                    │            S3 Bucket                │
                    │  ┌───────────────────────────────┐  │
                    │  │ / (viewer shell)              │  │
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
- **Route53 A Records** for apex and www subdomain

## Quick Start

```bash
cd infrastructure/terraform-viewer
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars if needed

./deploy.sh
```

## How It Works

The `deploy.sh` script performs the following steps:

### 1. Build Phase
- Cleans all existing `dist/` directories to remove stale artifacts
- Runs `npm install && npm run build` for each app:
  - archivist, chronicler (MFE remotes)
  - viewer (shell application)

### 2. Terraform Apply
- Runs `terraform apply` to:
  - Create/update infrastructure (S3, CloudFront, ACM, Route53)
  - Upload all files to S3 via `aws_s3_object` resources with proper cache headers
  - Automatically trigger CloudFront invalidation when S3 objects are updated via `action_trigger`

## Configuration

### Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `aws_region` | AWS region | `us-east-1` |
| `prefix` | Project prefix for namespacing resources | `pt-viewer` |
| `domain_name` | Domain name | `penguin-tales.com` |

Resource names are derived from the prefix:
- S3 bucket: `{prefix}-static-{account_id}`
- CloudFront OAC: `{prefix}-oac`

## Outputs

- `website_url` - Full URL to access the site
- `cloudfront_distribution_id` - Distribution ID
- `bucket_name` - S3 bucket name
- `s3_bucket_name` - S3 bucket name (deprecated alias)
- `s3_bucket_arn` - S3 bucket ARN
- `acm_certificate_arn` - Certificate ARN
- `route53_zone_id` - Hosted zone ID
