# outputs.tf - Output values for the pics gallery infrastructure

output "bucket_name" {
  description = "Name of the S3 bucket for pics app static content"
  value       = aws_s3_bucket.static_site.id
}

output "cloudfront_distribution_id" {
  description = "ID of the CloudFront distribution"
  value       = aws_cloudfront_distribution.pics.id
}

output "cloudfront_domain_name" {
  description = "Domain name of the CloudFront distribution"
  value       = aws_cloudfront_distribution.pics.domain_name
}

output "website_url" {
  description = "URL to access the pics gallery"
  value       = "https://${var.domain}/"
}
