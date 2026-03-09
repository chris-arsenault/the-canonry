# variables.tf - Input variables for the pics gallery infrastructure

variable "aws_region" {
  description = "AWS region to deploy resources"
  type        = string
  default     = "us-east-1" # Required for CloudFront ACM certificates
}

variable "prefix" {
  description = "Project prefix for namespacing resources"
  type        = string
  default     = "pics-viewer"
}

variable "domain" {
  description = "Domain name for the pics gallery (e.g. pics.theiceremembers.com)"
  type        = string
}

variable "parent_domain" {
  description = "Parent domain for Route53 zone lookup (e.g. theiceremembers.com)"
  type        = string
}

variable "image_bucket_name" {
  description = "Name of the EXISTING image assets bucket (shared with viewer)"
  type        = string
}

variable "image_prefix" {
  description = "Base prefix for image paths in the image bucket (e.g. canonry)"
  type        = string
  default     = ""
}
