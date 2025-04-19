# ECR Repository
resource "aws_ecr_repository" "app_repository" {
  name                 = "${local.name_prefix}"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  tags = merge(
    local.common_tags,
    {
      Name = "${local.name_prefix}-ecr"
    }
  )
}

# ECR Lifecycle Policy
resource "aws_ecr_lifecycle_policy" "app_repository_policy" {
  repository = aws_ecr_repository.app_repository.name

  policy = jsonencode({
    rules = [
      {
        rulePriority = 1
        description  = "Keep only the last 10 images"
        selection = {
          tagStatus     = "any"
          countType     = "imageCountMoreThan"
          countNumber   = 10
        }
        action = {
          type = "expire"
        }
      }
    ]
  })
}

# Build and push Docker image to ECR
resource "null_resource" "docker_build_push" {
  depends_on = [aws_ecr_repository.app_repository]

  triggers = {
    ecr_repository_url = aws_ecr_repository.app_repository.repository_url
    # Add this to force rebuild on every apply, remove if you want to build only when the repository changes
    always_run = timestamp()
  }

  provisioner "local-exec" {
    command = <<-EOT
      # Get AWS account ID
      AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
      AWS_REGION=${data.aws_region.current.name}
      
      # Build the Docker image from parent directory
      cd ..
      docker build -t ${aws_ecr_repository.app_repository.name}:latest .
      
      # Log in to ECR
      aws ecr get-login-password --region ${data.aws_region.current.name} | docker login --username AWS --password-stdin $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com
      
      # Tag the image with ECR repository URL
      docker tag ${aws_ecr_repository.app_repository.name}:latest ${aws_ecr_repository.app_repository.repository_url}:latest
      
      # Push the image to ECR
      docker push ${aws_ecr_repository.app_repository.repository_url}:latest
      
      echo "Successfully built and pushed Docker image to ${aws_ecr_repository.app_repository.repository_url}:latest"
    EOT
  }
}

# Data source to get current AWS region
data "aws_region" "current" {}