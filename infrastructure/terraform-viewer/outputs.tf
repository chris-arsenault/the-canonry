# outputs.tf - Output values for the infrastructure (viewer + pics)

# -----------------------------------------------------------------------------
# Viewer
# -----------------------------------------------------------------------------

output "bucket_name" {
  description = "Name of the S3 bucket for viewer static content"
  value       = aws_s3_bucket.static_site.id
}

output "image_bucket_name" {
  description = "Name of the S3 bucket used for raw/webp/thumb images"
  value       = aws_s3_bucket.image_assets.id
}

output "cloudfront_distribution_id" {
  description = "ID of the viewer CloudFront distribution"
  value       = aws_cloudfront_distribution.static_site.id
}

output "cloudfront_domain_name" {
  description = "Domain name of the viewer CloudFront distribution"
  value       = aws_cloudfront_distribution.static_site.domain_name
}

output "acm_certificate_arn" {
  description = "ARN of the viewer ACM certificate"
  value       = aws_acm_certificate.main.arn
}

output "website_url" {
  description = "URL to access the viewer"
  value       = "https://${local.primary_domain}/"
}

output "aws_region" {
  description = "AWS region for the deployment"
  value       = var.aws_region
}

output "route53_zone_id" {
  description = "Route53 hosted zone ID for the primary domain"
  value       = data.aws_route53_zone.zones[local.primary_domain].zone_id
}

output "route53_zone_ids" {
  description = "Route53 hosted zone IDs keyed by domain"
  value       = { for domain, zone in data.aws_route53_zone.zones : domain => zone.zone_id }
}

# -----------------------------------------------------------------------------
# Pics
# -----------------------------------------------------------------------------

output "pics_bucket_name" {
  description = "Name of the S3 bucket for pics app static content"
  value       = aws_s3_bucket.pics_static.id
}

output "pics_cloudfront_distribution_id" {
  description = "ID of the pics CloudFront distribution"
  value       = aws_cloudfront_distribution.pics.id
}

output "pics_domain" {
  description = "Domain name for the pics gallery"
  value       = var.pics_domain
}

output "pics_website_url" {
  description = "URL to access the pics gallery"
  value       = "https://${var.pics_domain}/"
}
