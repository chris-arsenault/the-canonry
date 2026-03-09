# main.tf - S3 + CloudFront for pics.theiceremembers.com
#
# Serves the pics React app from its own S3 bucket and reads images
# from the EXISTING shared image bucket (same one Canonry uploads to).

data "aws_caller_identity" "current" {}

locals {
  bucket_name    = "${var.prefix}-static-${data.aws_caller_identity.current.account_id}"
  s3_origin_id   = "S3-${local.bucket_name}"
  image_origin_id = "S3-${var.image_bucket_name}"
  image_prefix    = trimsuffix(trimprefix(var.image_prefix, "/"), "/")
  image_path_patterns = local.image_prefix != "" ? [
    "${local.image_prefix}/webp/*",
    "${local.image_prefix}/thumb/*",
    "${local.image_prefix}/catalog.json"
  ] : [
    "webp/*",
    "thumb/*",
    "catalog.json"
  ]

  all_aliases = [var.domain]
  dist_path   = "${path.module}/../../apps/pics/webui/dist"
}

# -----------------------------------------------------------------------------
# Route53 Hosted Zone (data source - parent zone must already exist)
# -----------------------------------------------------------------------------

data "aws_route53_zone" "parent" {
  name = var.parent_domain
}

# -----------------------------------------------------------------------------
# ACM Certificate
# -----------------------------------------------------------------------------

resource "aws_acm_certificate" "main" {
  domain_name       = var.domain
  validation_method = "DNS"

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
  zone_id         = data.aws_route53_zone.parent.zone_id
}

resource "aws_acm_certificate_validation" "main" {
  certificate_arn         = aws_acm_certificate.main.arn
  validation_record_fqdns = [for record in aws_route53_record.cert_validation : record.fqdn]
}

# -----------------------------------------------------------------------------
# S3 Bucket for Static Content (pics app shell)
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
# Reference to Existing Image Bucket
# -----------------------------------------------------------------------------

data "aws_s3_bucket" "image_assets" {
  bucket = var.image_bucket_name
}

# -----------------------------------------------------------------------------
# S3 Objects - Pics App Shell
# -----------------------------------------------------------------------------

resource "aws_s3_object" "app_assets" {
  for_each = {
    for file in fileset(local.dist_path, "**/*") : file => {
      key    = file
      source = "${local.dist_path}/${file}"
      ext    = regex("\\.[^.]+$", file)
    }
  }

  bucket      = aws_s3_bucket.static_site.id
  key         = each.value.key
  source      = each.value.source
  source_hash = filemd5(each.value.source)
  content_type = lookup({
    ".html" = "text/html"
    ".css"  = "text/css"
    ".js"   = "application/javascript"
    ".json" = "application/json"
    ".svg"  = "image/svg+xml"
    ".png"  = "image/png"
    ".jpg"  = "image/jpeg"
    ".ico"  = "image/x-icon"
    ".webp" = "image/webp"
    ".woff2" = "font/woff2"
    ".map"  = "application/json"
  }, each.value.ext, "application/octet-stream")

  cache_control = (
    can(regex("\\.html$", each.value.key)) ? "public, max-age=120" :
    "public, max-age=31536000, immutable"
  )

  lifecycle {
    create_before_destroy = true
  }
}

# -----------------------------------------------------------------------------
# Deployment Marker
# -----------------------------------------------------------------------------

resource "terraform_data" "deployment_marker" {
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
  description                       = "OAC for ${var.domain}"
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
            "AWS:SourceArn" = aws_cloudfront_distribution.pics.arn
          }
        }
      }
    ]
  })
}

# -----------------------------------------------------------------------------
# CloudFront Distribution
# -----------------------------------------------------------------------------

resource "aws_cloudfront_distribution" "pics" {
  enabled             = true
  is_ipv6_enabled     = true
  comment             = "${var.prefix} distribution for ${var.domain}"
  default_root_object = "index.html"
  price_class         = "PriceClass_100"
  aliases             = local.all_aliases

  origin {
    domain_name              = aws_s3_bucket.static_site.bucket_regional_domain_name
    origin_id                = local.s3_origin_id
    origin_access_control_id = aws_cloudfront_origin_access_control.static_site.id
  }

  origin {
    domain_name              = data.aws_s3_bucket.image_assets.bucket_regional_domain_name
    origin_id                = local.image_origin_id
    origin_access_control_id = aws_cloudfront_origin_access_control.static_site.id
  }

  # Default behavior - serves pics app from static bucket
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
    min_ttl                = 31536000
    default_ttl            = 31536000
    max_ttl                = 31536000
    compress               = true
  }

  # Image paths served from shared image bucket
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

  # SPA routing fallback
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
# Route53 DNS Record
# -----------------------------------------------------------------------------

resource "aws_route53_record" "pics" {
  zone_id = data.aws_route53_zone.parent.zone_id
  name    = var.domain
  type    = "A"

  alias {
    name                   = aws_cloudfront_distribution.pics.domain_name
    zone_id                = aws_cloudfront_distribution.pics.hosted_zone_id
    evaluate_target_health = false
  }
}

# -----------------------------------------------------------------------------
# CloudFront Cache Invalidation
# -----------------------------------------------------------------------------

action "aws_cloudfront_create_invalidation" "invalidate_all" {
  config {
    distribution_id = aws_cloudfront_distribution.pics.id
    paths           = ["/*"]
  }
}
