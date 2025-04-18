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

  user_data = <<-EOF
    #!/bin/bash -xe
    yum update -y
    amazon-linux-extras install docker -y
    service docker start
    systemctl enable docker
    usermod -a -G docker ec2-user
    
    # Install AWS CLI
    curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
    unzip awscliv2.zip
    ./aws/install
    
    # Set environment variables
    cat > /etc/environment <<EOE
    AWS_REGION=${var.aws_region}
    DYNAMODB_TABLE_NAME=${aws_dynamodb_table.user_table.name}
    CONNECTIONS_TABLE_NAME=${aws_dynamodb_table.connections_table.name}
    MESSAGES_TABLE_NAME=${aws_dynamodb_table.messages_table.name}
    S3_BUCKET_NAME=${aws_s3_bucket.archive_bucket.bucket}
    SQS_QUEUE_URL=${aws_sqs_queue.message_queue.url}
    EOE
    
    # Create a deployment script
    cat > /home/ec2-user/deploy.sh <<EOE
    #!/bin/bash
    aws ecr get-login-password --region ${var.aws_region} | docker login --username AWS --password-stdin ${aws_ecr_repository.app_repository.repository_url}
    docker pull ${aws_ecr_repository.app_repository.repository_url}:latest
    docker stop user-status-chat || true
    docker rm user-status-chat || true
    docker run -d -p 80:3000 \\
      --env-file /etc/environment \\
      --name user-status-chat \\
      --restart always \\
      ${aws_ecr_repository.app_repository.repository_url}:latest
    EOE
    
    chmod +x /home/ec2-user/deploy.sh
    chown ec2-user:ec2-user /home/ec2-user/deploy.sh
    
    # Set up a cron job to check for new images every hour
    echo "0 * * * * ec2-user /home/ec2-user/deploy.sh > /home/ec2-user/deploy.log 2>&1" | tee /etc/cron.d/deploy-app
  EOF

  tags = merge(
    local.common_tags,
    {
      Name = "${local.name_prefix}-web-server"
    }
  )
}