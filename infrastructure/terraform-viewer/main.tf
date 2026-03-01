# main.tf - S3 bucket and CloudFront distribution for the-canonry viewer

data "aws_caller_identity" "current" {}

locals {
  bucket_name  = "${var.prefix}-static-${data.aws_caller_identity.current.account_id}"
  s3_origin_id = "S3-${local.bucket_name}"
  image_bucket_name = "${var.prefix}-canonry-images-${data.aws_caller_identity.current.account_id}"
  image_origin_id = "S3-${local.image_bucket_name}"
  image_prefix = trimsuffix(trimprefix(var.image_prefix, "/"), "/")
  image_path_patterns = local.image_prefix != "" ? [
    "${local.image_prefix}/raw/*",
    "${local.image_prefix}/webp/*",
    "${local.image_prefix}/thumb/*"
  ] : [
    "raw/*",
    "webp/*",
    "thumb/*"
  ]

  # Domains
  all_domains = distinct([for d in var.domains : trimspace(d)])
  primary_domain = local.all_domains[0]
  all_domain_aliases = distinct(concat(
    local.all_domains,
    [for d in local.all_domains : "www.${d}"]
  ))

  # App build outputs and URL prefixes
  apps = {
    viewer = {
      path = "" # root
      dist = "${path.module}/../../apps/viewer/webui/dist"
    }
  }

}

# -----------------------------------------------------------------------------
# Route53 Hosted Zone (data source - zone must already exist)
# -----------------------------------------------------------------------------

data "aws_route53_zone" "zones" {
  for_each = toset(local.all_domains)
  name     = each.value
}

# -----------------------------------------------------------------------------
# ACM Certificate
# -----------------------------------------------------------------------------

resource "aws_acm_certificate" "main" {
  domain_name               = local.primary_domain
  subject_alternative_names = [for d in local.all_domain_aliases : d if d != local.primary_domain]
  validation_method         = "DNS"

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_route53_record" "cert_validation" {
  for_each = {
    for dvo in aws_acm_certificate.main.domain_validation_options : dvo.domain_name => {
      name    = dvo.resource_record_name
      record  = dvo.resource_record_value
      type    = dvo.resource_record_type
      zone_id = data.aws_route53_zone.zones[trimprefix(dvo.domain_name, "www.")].zone_id
    }
  }

  allow_overwrite = true
  name            = each.value.name
  records         = [each.value.record]
  ttl             = 60
  type            = each.value.type
  zone_id         = each.value.zone_id
}

resource "aws_acm_certificate_validation" "main" {
  certificate_arn         = aws_acm_certificate.main.arn
  validation_record_fqdns = [for record in aws_route53_record.cert_validation : record.fqdn]
}

# -----------------------------------------------------------------------------
# S3 Bucket for Static Content
# -----------------------------------------------------------------------------

resource "aws_s3_bucket" "static_site" {
  bucket = local.bucket_name
}

# -----------------------------------------------------------------------------
# S3 Bucket for Image Storage (raw/webp/thumb)
# -----------------------------------------------------------------------------

resource "aws_s3_bucket" "image_assets" {
  bucket = local.image_bucket_name
}

resource "aws_s3_bucket_versioning" "image_assets" {
  bucket = aws_s3_bucket.image_assets.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "image_assets" {
  bucket = aws_s3_bucket.image_assets.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "image_assets" {
  bucket = aws_s3_bucket.image_assets.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_policy" "image_assets" {
  bucket = aws_s3_bucket.image_assets.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowCloudFrontServicePrincipal"
        Effect = "Allow"
        Principal = {
          Service = "cloudfront.amazonaws.com"
        }
        Action   = "s3:GetObject"
        Resource = [
          "${aws_s3_bucket.image_assets.arn}/*"
        ]
        Condition = {
          StringEquals = {
            "AWS:SourceArn" = aws_cloudfront_distribution.static_site.arn
          }
        }
      }
    ]
  })
}

# -----------------------------------------------------------------------------
# CORS for Image Bucket (Canonry browser uploads)
# -----------------------------------------------------------------------------

resource "aws_s3_bucket_cors_configuration" "image_assets" {
  bucket = aws_s3_bucket.image_assets.id

  cors_rule {
    allowed_methods = ["GET", "PUT", "HEAD"]
    allowed_origins = ["*"]
    allowed_headers = ["*"]
    expose_headers  = ["ETag"]
    max_age_seconds = 3600
  }
}

resource "aws_s3_bucket_versioning" "static_site" {
  bucket = aws_s3_bucket.static_site.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "static_site" {
  bucket = aws_s3_bucket.static_site.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "static_site" {
  bucket = aws_s3_bucket.static_site.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# -----------------------------------------------------------------------------
# S3 Objects - Viewer Shell + Required MFEs
# -----------------------------------------------------------------------------

resource "aws_s3_object" "app_assets" {
  for_each = {
    for obj in flatten([
      for app_key, app in local.apps : [
        for file in fileset(app.dist, "**/*") : {
          app_key = app_key
          key     = app.path != "" ? "${app.path}/${file}" : file
          source  = "${app.dist}/${file}"
          ext     = regex("\\.[^.]+$", file)
        }
      ]
    ]) : "${obj.app_key}:${obj.key}" => obj
  }

  bucket      = aws_s3_bucket.static_site.id
  key         = each.value.key
  source      = each.value.source
  source_hash = filemd5(each.value.source)
  content_type = lookup({
    ".html"  = "text/html"
    ".css"   = "text/css"
    ".js"    = "application/javascript"
    ".json"  = "application/json"
    ".svg"   = "image/svg+xml"
    ".png"   = "image/png"
    ".jpg"   = "image/jpeg"
    ".jpeg"  = "image/jpeg"
    ".gif"   = "image/gif"
    ".ico"   = "image/x-icon"
    ".woff"  = "font/woff"
    ".woff2" = "font/woff2"
    ".ttf"   = "font/ttf"
    ".eot"   = "application/vnd.ms-fontobject"
    ".txt"   = "text/plain"
    ".xml"   = "application/xml"
    ".webp"  = "image/webp"
    ".map"   = "application/json"
  }, each.value.ext, "application/octet-stream")

  # Cache headers (browser-facing):
  # - HTML: short browser cache; CloudFront min_ttl keeps it cached at the edge
  #   until deploy invalidation clears it
  # - bundle.manifest.json: short browser cache (discovery file, no content hash)
  # - Content-hashed assets: immutable with 1-year cache
  cache_control = (
    can(regex("\\.html$", each.value.key)) ? "public, max-age=120" :
    can(regex("bundle\\.manifest\\.json$", each.value.key)) ? "public, max-age=120" :
    "public, max-age=31536000, immutable"
  )

  lifecycle {
    create_before_destroy = true
  }
}

# -----------------------------------------------------------------------------
# Deployment Marker - Triggers cache invalidation once per deployment
# -----------------------------------------------------------------------------

# This terraform_data resource tracks when any S3 object changes
# and triggers the CloudFront invalidation action exactly once per deployment
resource "terraform_data" "deployment_marker" {
  # This input combines hashes of all S3 objects, so it changes whenever any file changes
  input = sha256(jsonencode([
    for k, v in aws_s3_object.app_assets : v.source_hash
  ]))

  lifecycle {
    action_trigger {
      events  = [after_update]
      actions = [action.aws_cloudfront_create_invalidation.invalidate_all]
    }
  }
}

# -----------------------------------------------------------------------------
# CloudFront Origin Access Control
# -----------------------------------------------------------------------------

resource "aws_cloudfront_origin_access_control" "static_site" {
  name                              = "${var.prefix}-oac"
  description                       = "OAC for ${local.primary_domain}"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

# -----------------------------------------------------------------------------
# S3 Bucket Policy for CloudFront Access
# -----------------------------------------------------------------------------

resource "aws_s3_bucket_policy" "static_site" {
  bucket = aws_s3_bucket.static_site.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowCloudFrontServicePrincipal"
        Effect = "Allow"
        Principal = {
          Service = "cloudfront.amazonaws.com"
        }
        Action   = "s3:GetObject"
        Resource = "${aws_s3_bucket.static_site.arn}/*"
        Condition = {
          StringEquals = {
            "AWS:SourceArn" = aws_cloudfront_distribution.static_site.arn
          }
        }
      }
    ]
  })
}

# -----------------------------------------------------------------------------
# CloudFront Distribution
# -----------------------------------------------------------------------------

resource "aws_cloudfront_distribution" "static_site" {
  enabled             = true
  is_ipv6_enabled     = true
  comment             = "${var.prefix} distribution for ${local.primary_domain}"
  default_root_object = "index.html"
  price_class         = "PriceClass_100"
  aliases             = local.all_domain_aliases

  origin {
    domain_name              = aws_s3_bucket.static_site.bucket_regional_domain_name
    origin_id                = local.s3_origin_id
    origin_access_control_id = aws_cloudfront_origin_access_control.static_site.id
  }

  origin {
    domain_name              = aws_s3_bucket.image_assets.bucket_regional_domain_name
    origin_id                = local.image_origin_id
    origin_access_control_id = aws_cloudfront_origin_access_control.static_site.id
  }

  # Default behavior - serves viewer shell from root
  # min_ttl forces CloudFront to cache at the edge until deploy invalidation,
  # while the Cache-Control header (max-age=120 for HTML) controls browser caching.
  default_cache_behavior {
    allowed_methods  = ["GET", "HEAD", "OPTIONS"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = local.s3_origin_id

    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }

    viewer_protocol_policy = "redirect-to-https"
    min_ttl                = 31536000  # CloudFront caches until invalidation
    default_ttl            = 31536000
    max_ttl                = 31536000
    compress               = true
  }

  dynamic "ordered_cache_behavior" {
    for_each = local.image_path_patterns
    content {
      path_pattern     = "/${ordered_cache_behavior.value}"
      allowed_methods  = ["GET", "HEAD", "OPTIONS"]
      cached_methods   = ["GET", "HEAD"]
      target_origin_id = local.image_origin_id

      forwarded_values {
        query_string = false
        cookies {
          forward = "none"
        }
      }

      viewer_protocol_policy = "redirect-to-https"
      min_ttl                = 0
      default_ttl            = 86400
      max_ttl                = 31536000
      compress               = true
    }
  }

  # Custom error responses for SPA routing
  custom_error_response {
    error_code            = 403
    response_code         = 200
    response_page_path    = "/index.html"
    error_caching_min_ttl = 10
  }

  custom_error_response {
    error_code            = 404
    response_code         = 200
    response_page_path    = "/index.html"
    error_caching_min_ttl = 10
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    acm_certificate_arn      = aws_acm_certificate_validation.main.certificate_arn
    ssl_support_method       = "sni-only"
    minimum_protocol_version = "TLSv1.2_2021"
  }

  depends_on = [aws_acm_certificate_validation.main]
}

# -----------------------------------------------------------------------------
# Route53 DNS Records for CloudFront
# -----------------------------------------------------------------------------

resource "aws_route53_record" "apex" {
  for_each = data.aws_route53_zone.zones
  zone_id  = each.value.zone_id
  name     = each.key
  type     = "A"

  alias {
    name                   = aws_cloudfront_distribution.static_site.domain_name
    zone_id                = aws_cloudfront_distribution.static_site.hosted_zone_id
    evaluate_target_health = false
  }
}

resource "aws_route53_record" "www" {
  for_each = data.aws_route53_zone.zones
  zone_id  = each.value.zone_id
  name     = "www.${each.key}"
  type     = "A"

  alias {
    name                   = aws_cloudfront_distribution.static_site.domain_name
    zone_id                = aws_cloudfront_distribution.static_site.hosted_zone_id
    evaluate_target_health = false
  }
}

# -----------------------------------------------------------------------------
# CloudFront Cache Invalidation (Terraform 1.14+)
# -----------------------------------------------------------------------------

action "aws_cloudfront_create_invalidation" "invalidate_all" {
  config {
    distribution_id = aws_cloudfront_distribution.static_site.id
    paths           = ["/*"]
  }
}
