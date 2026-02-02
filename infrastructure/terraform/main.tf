# main.tf - S3 bucket and CloudFront distribution for canonry full suite

data "aws_caller_identity" "current" {}

locals {
  bucket_name  = "${var.prefix}-static-${data.aws_caller_identity.current.account_id}"
  s3_origin_id = "S3-${local.bucket_name}"

  # App build outputs and URL prefixes
  apps = {
    canonry = {
      path = "" # root
      dist = "${path.module}/../../apps/canonry/webui/dist"
    }
    name_forge = {
      path = "name-forge"
      dist = "${path.module}/../../apps/name-forge/webui/dist"
    }
    cosmographer = {
      path = "cosmographer"
      dist = "${path.module}/../../apps/cosmographer/webui/dist"
    }
    coherence_engine = {
      path = "coherence-engine"
      dist = "${path.module}/../../apps/coherence-engine/webui/dist"
    }
    lore_weave = {
      path = "lore-weave"
      dist = "${path.module}/../../apps/lore-weave/webui/dist"
    }
    illuminator = {
      path = "illuminator"
      dist = "${path.module}/../../apps/illuminator/webui/dist"
    }
    archivist = {
      path = "archivist"
      dist = "${path.module}/../../apps/archivist/webui/dist"
    }
    chronicler = {
      path = "chronicler"
      dist = "${path.module}/../../apps/chronicler/webui/dist"
    }
  }

}

# -----------------------------------------------------------------------------
# Route53 Hosted Zone (data source - zone must already exist)
# -----------------------------------------------------------------------------

data "aws_route53_zone" "main" {
  name = var.domain_name
}

# -----------------------------------------------------------------------------
# ACM Certificate
# -----------------------------------------------------------------------------

resource "aws_acm_certificate" "main" {
  domain_name               = var.domain_name
  subject_alternative_names = ["www.${var.domain_name}"]
  validation_method         = "DNS"

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_route53_record" "cert_validation" {
  for_each = {
    for dvo in aws_acm_certificate.main.domain_validation_options : dvo.domain_name => {
      name   = dvo.resource_record_name
      record = dvo.resource_record_value
      type   = dvo.resource_record_type
    }
  }

  allow_overwrite = true
  name            = each.value.name
  records         = [each.value.record]
  ttl             = 60
  type            = each.value.type
  zone_id         = data.aws_route53_zone.main.zone_id
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
# S3 Objects - Canonry Shell + All MFEs
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

  # Critical: Proper cache headers to prevent stale content
  # - HTML files: no-cache (always fetch fresh)
  # - remoteEntry.js: no-cache (Module Federation entry points must be fresh)
  # - Other assets: immutable with long cache (hashed filenames)
  cache_control = (
    can(regex("\\.html$", each.value.key)) ? "no-cache, no-store, must-revalidate" :
    can(regex("remoteEntry\\.js$", each.value.key)) ? "no-cache, no-store, must-revalidate" :
    can(regex("mf-manifest\\.json$", each.value.key)) ? "public, max-age=60" :
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
  description                       = "OAC for ${var.domain_name}"
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
  comment             = "${var.prefix} distribution for ${var.domain_name}"
  default_root_object = "index.html"
  price_class         = "PriceClass_100"
  aliases             = [var.domain_name, "www.${var.domain_name}"]

  origin {
    domain_name              = aws_s3_bucket.static_site.bucket_regional_domain_name
    origin_id                = local.s3_origin_id
    origin_access_control_id = aws_cloudfront_origin_access_control.static_site.id
  }

  # Default behavior - serves canonry shell from root
  # Respects Cache-Control headers from S3 (min_ttl=0 allows S3 to control caching)
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
    min_ttl                = 0     # Allow S3 Cache-Control to set minimum
    default_ttl            = 86400 # Used only if S3 doesn't send Cache-Control
    max_ttl                = 31536000
    compress               = true
  }

  # Behaviors for MFE remotes - respect S3 Cache-Control headers
  ordered_cache_behavior {
    path_pattern     = "/name-forge/*"
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
    min_ttl                = 0
    default_ttl            = 86400
    max_ttl                = 31536000
    compress               = true
  }

  ordered_cache_behavior {
    path_pattern     = "/cosmographer/*"
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
    min_ttl                = 0
    default_ttl            = 86400
    max_ttl                = 31536000
    compress               = true
  }

  ordered_cache_behavior {
    path_pattern     = "/coherence-engine/*"
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
    min_ttl                = 0
    default_ttl            = 86400
    max_ttl                = 31536000
    compress               = true
  }

  ordered_cache_behavior {
    path_pattern     = "/lore-weave/*"
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
    min_ttl                = 0
    default_ttl            = 86400
    max_ttl                = 31536000
    compress               = true
  }

  ordered_cache_behavior {
    path_pattern     = "/archivist/*"
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
    min_ttl                = 0
    default_ttl            = 86400
    max_ttl                = 31536000
    compress               = true
  }

  ordered_cache_behavior {
    path_pattern     = "/illuminator/*"
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
    min_ttl                = 0
    default_ttl            = 86400
    max_ttl                = 31536000
    compress               = true
  }

  ordered_cache_behavior {
    path_pattern     = "/chronicler/*"
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
    min_ttl                = 0
    default_ttl            = 86400
    max_ttl                = 31536000
    compress               = true
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
  zone_id = data.aws_route53_zone.main.zone_id
  name    = var.domain_name
  type    = "A"

  alias {
    name                   = aws_cloudfront_distribution.static_site.domain_name
    zone_id                = aws_cloudfront_distribution.static_site.hosted_zone_id
    evaluate_target_health = false
  }
}

resource "aws_route53_record" "www" {
  zone_id = data.aws_route53_zone.main.zone_id
  name    = "www.${var.domain_name}"
  type    = "A"

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
