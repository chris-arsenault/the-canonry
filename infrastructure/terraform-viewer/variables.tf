# variables.tf - Input variables for the-canonry infrastructure (viewer + pics)

variable "aws_region" {
  description = "AWS region to deploy resources"
  type        = string
  default     = "us-east-1" # Required for CloudFront ACM certificates
}

variable "prefix" {
  description = "Project prefix for namespacing viewer resources"
  type        = string
  default     = "pt-viewer"
}

variable "domains" {
  description = "Domain names for the viewer website (apex domains)."
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

# -----------------------------------------------------------------------------
# Pics Gallery
# -----------------------------------------------------------------------------

variable "pics_prefix" {
  description = "Project prefix for namespacing pics resources"
  type        = string
  default     = "pics-viewer"
}

variable "pics_domain" {
  description = "Domain name for the pics gallery (e.g. pics.theiceremembers.com). Set to empty string to skip pics resources."
  type        = string
  default     = ""
}

variable "pics_parent_domain" {
  description = "Parent domain for pics Route53 zone lookup (e.g. theiceremembers.com)"
  type        = string
  default     = ""
}
