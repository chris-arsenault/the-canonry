# pics.tf - Pics gallery: S3, CloudFront, ACM, Route53
#
# Serves pics.theiceremembers.com (app shell only).
# Images are served cross-origin from theiceremembers.com (viewer CF).
# catalog.json is deployed to the pics static bucket with baseUrl pointing
# to the viewer domain so the pics app resolves image URLs correctly.

# -----------------------------------------------------------------------------
# ACM Certificate for Pics
# -----------------------------------------------------------------------------

resource "aws_acm_certificate" "pics" {
  domain_name       = var.pics_domain
  validation_method = "DNS"

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_route53_record" "pics_cert_validation" {
  for_each = {
    for dvo in aws_acm_certificate.pics.domain_validation_options : dvo.domain_name => {
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
  zone_id         = data.aws_route53_zone.zones[var.pics_parent_domain].zone_id
}

resource "aws_acm_certificate_validation" "pics" {
  certificate_arn         = aws_acm_certificate.pics.arn
  validation_record_fqdns = [for record in aws_route53_record.pics_cert_validation : record.fqdn]
}

# -----------------------------------------------------------------------------
# S3 Bucket for Pics Static Content
# -----------------------------------------------------------------------------

resource "aws_s3_bucket" "pics_static" {
  bucket = local.pics_bucket_name
}

resource "aws_s3_bucket_versioning" "pics_static" {
  bucket = aws_s3_bucket.pics_static.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "pics_static" {
  bucket = aws_s3_bucket.pics_static.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "pics_static" {
  bucket = aws_s3_bucket.pics_static.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# -----------------------------------------------------------------------------
# S3 Bucket Policy for Pics Static Content
# -----------------------------------------------------------------------------

resource "aws_s3_bucket_policy" "pics_static" {
  bucket = aws_s3_bucket.pics_static.id
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
        Resource = "${aws_s3_bucket.pics_static.arn}/*"
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
# S3 Objects - Pics App
# -----------------------------------------------------------------------------

resource "aws_s3_object" "pics_assets" {
  for_each = {
    for file in fileset(local.pics_dist_path, "**/*") : file => {
      key    = file
      source = "${local.pics_dist_path}/${file}"
      ext    = regex("\\.[^.]+$", file)
    }
  }

  bucket      = aws_s3_bucket.pics_static.id
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
    can(regex("catalog\\.json$", each.value.key)) ? "public, max-age=120" :
    "public, max-age=31536000, immutable"
  )

  lifecycle {
    create_before_destroy = true
  }
}

# -----------------------------------------------------------------------------
# Deployment Marker for Pics
# -----------------------------------------------------------------------------

resource "terraform_data" "pics_deployment_marker" {
  input = sha256(jsonencode([
    for k, v in aws_s3_object.pics_assets : v.source_hash
  ]))

  lifecycle {
    action_trigger {
      events  = [after_update]
      actions = [action.aws_cloudfront_create_invalidation.pics_invalidate_all]
    }
  }
}

# -----------------------------------------------------------------------------
# CloudFront Distribution for Pics
# -----------------------------------------------------------------------------

locals {
  pics_og_origin_id = "Lambda-${var.pics_prefix}-og"
  pics_og_domain    = replace(replace(aws_lambda_function_url.pics_og.function_url, "https://", ""), "/", "")
}

resource "aws_cloudfront_distribution" "pics" {
  enabled         = true
  is_ipv6_enabled = true
  comment         = "${var.pics_prefix} distribution for ${var.pics_domain}"
  price_class     = "PriceClass_100"
  aliases         = [var.pics_domain]

  # Origin 1: S3 for static assets (JS, CSS, catalog, images)
  origin {
    domain_name              = aws_s3_bucket.pics_static.bucket_regional_domain_name
    origin_id                = local.pics_s3_origin_id
    origin_access_control_id = aws_cloudfront_origin_access_control.static_site.id
  }

  # Origin 2: Lambda for HTML (dynamic OG tags)
  origin {
    domain_name = local.pics_og_domain
    origin_id   = local.pics_og_origin_id
    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "https-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }

  # Ordered behaviors: specific paths → S3, catch-all → Lambda

  # /assets/* → S3 (hashed Vite output, immutable)
  ordered_cache_behavior {
    path_pattern     = "/assets/*"
    allowed_methods  = ["GET", "HEAD", "OPTIONS"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = local.pics_s3_origin_id

    forwarded_values {
      query_string = false
      cookies { forward = "none" }
    }

    viewer_protocol_policy = "redirect-to-https"
    min_ttl                = 31536000
    default_ttl            = 31536000
    max_ttl                = 31536000
    compress               = true
  }

  # catalog.json → S3 (short cache, discovery file)
  ordered_cache_behavior {
    path_pattern     = "/catalog.json"
    allowed_methods  = ["GET", "HEAD"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = local.pics_s3_origin_id

    forwarded_values {
      query_string = false
      cookies { forward = "none" }
    }

    viewer_protocol_policy = "redirect-to-https"
    min_ttl                = 0
    default_ttl            = 120
    max_ttl                = 300
    compress               = true
  }

  # Static files by extension → S3
  ordered_cache_behavior {
    path_pattern     = "*.svg"
    allowed_methods  = ["GET", "HEAD"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = local.pics_s3_origin_id

    forwarded_values {
      query_string = false
      cookies { forward = "none" }
    }

    viewer_protocol_policy = "redirect-to-https"
    min_ttl                = 0
    default_ttl            = 86400
    max_ttl                = 31536000
    compress               = true
  }

  ordered_cache_behavior {
    path_pattern     = "*.png"
    allowed_methods  = ["GET", "HEAD"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = local.pics_s3_origin_id

    forwarded_values {
      query_string = false
      cookies { forward = "none" }
    }

    viewer_protocol_policy = "redirect-to-https"
    min_ttl                = 0
    default_ttl            = 86400
    max_ttl                = 31536000
    compress               = true
  }

  ordered_cache_behavior {
    path_pattern     = "*.ico"
    allowed_methods  = ["GET", "HEAD"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = local.pics_s3_origin_id

    forwarded_values {
      query_string = false
      cookies { forward = "none" }
    }

    viewer_protocol_policy = "redirect-to-https"
    min_ttl                = 0
    default_ttl            = 86400
    max_ttl                = 31536000
    compress               = true
  }

  # Default behavior → Lambda (HTML with dynamic OG tags)
  default_cache_behavior {
    allowed_methods  = ["GET", "HEAD", "OPTIONS"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = local.pics_og_origin_id

    forwarded_values {
      query_string = false
      cookies { forward = "none" }
    }

    viewer_protocol_policy = "redirect-to-https"
    min_ttl                = 0
    default_ttl            = 3600
    max_ttl                = 86400
    compress               = true
  }

  # No image behaviors — images served cross-origin from viewer CF (theiceremembers.com).
  # catalog.json is deployed to the pics static bucket with baseUrl pointing to the viewer domain.

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    acm_certificate_arn      = aws_acm_certificate_validation.pics.certificate_arn
    ssl_support_method       = "sni-only"
    minimum_protocol_version = "TLSv1.2_2021"
  }

  depends_on = [aws_acm_certificate_validation.pics]
}

# -----------------------------------------------------------------------------
# Route53 DNS Record for Pics
# -----------------------------------------------------------------------------

resource "aws_route53_record" "pics" {
  zone_id = data.aws_route53_zone.zones[var.pics_parent_domain].zone_id
  name    = var.pics_domain
  type    = "A"

  alias {
    name                   = aws_cloudfront_distribution.pics.domain_name
    zone_id                = aws_cloudfront_distribution.pics.hosted_zone_id
    evaluate_target_health = false
  }
}

# -----------------------------------------------------------------------------
# CloudFront Cache Invalidation for Pics
# -----------------------------------------------------------------------------

action "aws_cloudfront_create_invalidation" "pics_invalidate_all" {
  config {
    distribution_id = aws_cloudfront_distribution.pics.id
    paths           = ["/*"]
  }
}
