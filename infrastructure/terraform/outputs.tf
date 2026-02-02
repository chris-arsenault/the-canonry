# outputs.tf - Output values for the infrastructure

output "bucket_name" {
  description = "Name of the S3 bucket (used by deploy.sh for AWS CLI sync)"
  value       = aws_s3_bucket.static_site.id
}

output "s3_bucket_name" {
  description = "Name of the S3 bucket (deprecated, use bucket_name)"
  value       = aws_s3_bucket.static_site.id
}

output "s3_bucket_arn" {
  description = "ARN of the S3 bucket"
  value       = aws_s3_bucket.static_site.arn
}

output "cloudfront_distribution_id" {
  description = "ID of the CloudFront distribution (used by deploy.sh for cache invalidation)"
  value       = aws_cloudfront_distribution.static_site.id
}

output "cloudfront_domain_name" {
  description = "Domain name of the CloudFront distribution"
  value       = aws_cloudfront_distribution.static_site.domain_name
}

output "acm_certificate_arn" {
  description = "ARN of the ACM certificate"
  value       = aws_acm_certificate.main.arn
}

output "website_url" {
  description = "URL to access the application"
  value       = "https://${var.domain_name}/"
}

output "route53_zone_id" {
  description = "Route53 hosted zone ID"
  value       = data.aws_route53_zone.main.zone_id
}
