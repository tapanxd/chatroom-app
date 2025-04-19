# Get latest Amazon Linux 2 AMI
data "aws_ami" "amazon_linux_2" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["amzn2-ami-hvm-*-x86_64-gp2"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}

# EC2 Instance
resource "aws_instance" "web_server" {
  ami                    = data.aws_ami.amazon_linux_2.id
  instance_type          = var.instance_type
  key_name               = var.key_name
  vpc_security_group_ids = [aws_security_group.web_server.id]
  subnet_id              = aws_subnet.public[0].id
  iam_instance_profile   = aws_iam_instance_profile.ec2_profile.name
  
  # Add dependencies to ensure resources are created before the EC2 instance
  depends_on = [
    # Core infrastructure
    aws_ecr_repository.app_repository,
    aws_dynamodb_table.user_table,
    aws_dynamodb_table.connections_table,
    aws_dynamodb_table.messages_table,
    aws_s3_bucket.archive_bucket,
    aws_sqs_queue.message_queue,
    null_resource.docker_build_push,
    
    # IAM resources
    aws_iam_role.ec2_role,
    aws_iam_instance_profile.ec2_profile,
    aws_iam_role_policy_attachment.dynamodb_full_access,
    aws_iam_role_policy_attachment.s3_full_access,
    aws_iam_role_policy_attachment.sqs_full_access,
    aws_iam_role_policy_attachment.cloudwatch_full_access,
    aws_iam_role_policy_attachment.ecr_full_access,
    
    # Security group
    aws_security_group.web_server
  ]

  user_data = <<-EOF
    #!/bin/bash -xe
    exec > >(tee /var/log/user-data.log|logger -t user-data -s 2>/dev/console) 2>&1
    
    echo "Starting EC2 initialization..."
    yum update -y
    amazon-linux-extras install docker -y
    service docker start
    systemctl enable docker
    usermod -a -G docker ec2-user
    
    # Install AWS CLI
    echo "Installing AWS CLI..."
    curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
    unzip awscliv2.zip
    ./aws/install
    
    # Create a deployment script with retry logic
    echo "Creating deployment script..."
    cat > /home/ec2-user/deploy.sh <<EOE
    #!/bin/bash
    set -e
    
    # Function to check if image exists in ECR
    check_image_exists() {
      aws ecr describe-images \
        --repository-name $(echo "${aws_ecr_repository.app_repository.repository_url}" | cut -d/ -f2) \
        --image-ids imageTag=latest \
        --region ${var.aws_region} \
        --output text \
        --query 'imageDetails[0].imageTags' 2>/dev/null || return 1
      return 0
    }
    
    # Login to ECR
    echo "Logging in to ECR..."
    aws ecr get-login-password --region ${var.aws_region} | docker login --username AWS --password-stdin ${aws_ecr_repository.app_repository.repository_url}
    
    # Wait for image to be available with timeout
    echo "Waiting for Docker image to be available in ECR..."
    MAX_ATTEMPTS=30
    ATTEMPT=1
    
    while [ \$ATTEMPT -le \$MAX_ATTEMPTS ]; do
      echo "Attempt \$ATTEMPT of \$MAX_ATTEMPTS: Checking if image exists in ECR..."
      
      if check_image_exists; then
        echo "Image found in ECR! Proceeding with deployment."
        break
      fi
      
      if [ \$ATTEMPT -eq \$MAX_ATTEMPTS ]; then
        echo "Maximum attempts reached. Image not found in ECR. Exiting."
        exit 1
      fi
      
      echo "Image not found yet. Waiting 10 seconds before next attempt..."
      sleep 10
      ATTEMPT=\$((ATTEMPT+1))
    done
    
    # Pull the image
    echo "Pulling Docker image..."
    docker pull ${aws_ecr_repository.app_repository.repository_url}:latest
    
    # Stop and remove existing container if it exists
    echo "Stopping existing container if running..."
    docker stop userstatus 2>/dev/null || true
    docker rm userstatus 2>/dev/null || true
    
    # Run the container using the exact format provided
    echo "Starting new container..."
    docker run -d -p 80:3000 \
      --name userstatus \
      --restart always \
      -e AWS_REGION=${var.aws_region} \
      -e DYNAMODB_TABLE_NAME=${aws_dynamodb_table.user_table.name} \
      -e S3_BUCKET_NAME=${aws_s3_bucket.archive_bucket.bucket} \
      -e SQS_QUEUE_URL=${aws_sqs_queue.message_queue.url} \
      -e CONNECTIONS_TABLE_NAME=${aws_dynamodb_table.connections_table.name} \
      -e MESSAGES_TABLE_NAME=${aws_dynamodb_table.messages_table.name} \
      ${aws_ecr_repository.app_repository.repository_url}:latest
    
    echo "Deployment completed successfully!"
    EOE
    
    chmod +x /home/ec2-user/deploy.sh
    chown ec2-user:ec2-user /home/ec2-user/deploy.sh
    
    # Run the deployment script
    echo "Running initial deployment..."
    # Wait a bit to ensure the image has time to be pushed to ECR
    sleep 60
    /home/ec2-user/deploy.sh
    
    # Set up a cron job to check for new images and redeploy if needed
    echo "Setting up cron job for periodic redeployment checks..."
    echo "0 * * * * /home/ec2-user/deploy.sh >> /home/ec2-user/deploy.log 2>&1" | crontab -u ec2-user -

    echo "EC2 initialization completed!"
  EOF

  tags = merge(
    local.common_tags,
    {
      Name = "${local.name_prefix}-web-server"
    }
  )
}