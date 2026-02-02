# providers.tf - Terraform and AWS provider configuration

terraform {
  required_version = ">= 1.14"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.22.0"
    }
  }

  # Uncomment and configure for remote state storage
  # backend "s3" {
  #   bucket         = "penguin-tales-terraform-state"
  #   key            = "terraform.tfstate"
  #   region         = "us-east-1"
  #   encrypt        = true
  #   dynamodb_table = "penguin-tales-terraform-locks"
  # }

  backend "local" {
    path = "./penguin-tales.tfstate"
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
