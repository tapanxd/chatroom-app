provider "aws" {
  region = var.aws_region
}

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 4.0"
    }
  }
  
  # Uncomment this block to use S3 as a backend for state
  # backend "s3" {
  #   bucket         = "your-terraform-state-bucket"
  #   key            = "user-status-chat/terraform.tfstate"
  #   region         = "us-east-1"
  #   dynamodb_table = "terraform-lock"
  #   encrypt        = true
  # }
}

# Generate a random suffix for unique resource names
resource "random_id" "suffix" {
  byte_length = 4
}

locals {
  name_prefix = "${var.environment}-user-status-chat"
  common_tags = {
    Environment = var.environment
    Project     = "UserStatusChat"
    ManagedBy   = "Terraform"
  }
}