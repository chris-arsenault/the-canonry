# variables.tf - Input variables for canonry full suite infrastructure

variable "aws_region" {
  description = "AWS region to deploy resources"
  type        = string
  default     = "us-east-1" # Required for CloudFront ACM certificates
}

variable "prefix" {
  description = "Project prefix for namespacing resources"
  type        = string
  default     = "canonry"
}

variable "domain_name" {
  description = "Domain name for the website"
  type        = string
  default     = "the-canonry.com"
}
