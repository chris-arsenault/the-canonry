# providers.tf - Terraform and AWS provider configuration

terraform {
  required_version = ">= 1.14"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.22.0"
    }
  }

  backend "s3" {
    region       = "us-east-1"
    key          = "canonry.tfstate"
    encrypt      = true
    use_lockfile = true
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project   = "penguin-tales"
      ManagedBy = "terraform"
    }
  }
}
