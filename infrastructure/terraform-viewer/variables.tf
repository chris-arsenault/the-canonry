# variables.tf - Input variables for the-canonry viewer infrastructure

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

variable "domains" {
  description = "Domain names for the website (apex domains)."
  type        = list(string)

  validation {
    condition     = length(var.domains) > 0 && alltrue([for d in var.domains : trimspace(d) != ""])
    error_message = "domains must include at least one non-empty domain name."
  }
}

variable "image_prefix" {
  description = "Optional base prefix for image paths (must match Canonry S3 base prefix)"
  type        = string
  default     = ""
}
