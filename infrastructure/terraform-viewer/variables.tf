# variables.tf - Input variables for penguin-tales viewer infrastructure

variable "aws_region" {
  description = "AWS region to deploy resources"
  type        = string
  default     = "us-east-1" # Required for CloudFront ACM certificates
}

variable "prefix" {
  description = "Project prefix for namespacing resources"
  type        = string
  default     = "pt-viewer"
}

variable "domain_name" {
  description = "Domain name for the website"
  type        = string
  default     = "penguin-tales.com"
}

variable "image_prefix" {
  description = "Optional base prefix for image paths (must match Canonry S3 base prefix)"
  type        = string
  default     = ""
}
