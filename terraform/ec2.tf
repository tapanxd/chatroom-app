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
  
  # Put everything in the user_data script
  user_data = <<-EOF
    #!/bin/bash -xe
    # Redirect all output to a log file
    exec > >(tee /var/log/user-data.log) 2>&1
    
    echo "Starting EC2 initialization at $(date)"
    
    # Update the system
    echo "Updating system packages..."
    yum update -y
    
    # Install Docker
    echo "Installing Docker..."
    amazon-linux-extras install docker -y
    systemctl start docker
    systemctl enable docker
    usermod -a -G docker ec2-user
    
    # Install AWS CLI
    echo "Installing AWS CLI..."
    curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
    unzip awscliv2.zip
    ./aws/install
    
    # Wait for everything to be ready
    echo "Waiting for services to be fully available..."
    sleep 30
    
    # Login to ECR
    echo "Logging in to ECR..."
    aws ecr get-login-password --region ${var.aws_region} | docker login --username AWS --password-stdin ${aws_ecr_repository.app_repository.repository_url}
    
    # Pull the image
    echo "Pulling Docker image..."
    docker pull ${aws_ecr_repository.app_repository.repository_url}:latest
    
    # Run the container
    echo "Starting container..."
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
    
    # Verify container is running
    echo "Verifying container status..."
    docker ps -a
    docker logs userstatus
    
    # Create a marker file to indicate completion
    echo "EC2 initialization completed at $(date)" > /home/ec2-user/initialization-complete.txt
  EOF
  
  # Keep the depends_on block with IAM roles
  depends_on = [
    aws_ecr_repository.app_repository,
    aws_dynamodb_table.user_table,
    aws_dynamodb_table.connections_table,
    aws_dynamodb_table.messages_table,
    aws_s3_bucket.archive_bucket,
    aws_sqs_queue.message_queue,
    null_resource.docker_build_push,
    aws_iam_role.ec2_role,
    aws_iam_instance_profile.ec2_profile,
    aws_iam_role_policy_attachment.dynamodb_full_access,
    aws_iam_role_policy_attachment.s3_full_access,
    aws_iam_role_policy_attachment.sqs_full_access,
    aws_iam_role_policy_attachment.cloudwatch_full_access,
    aws_iam_role_policy_attachment.ecr_full_access,
    aws_security_group.web_server
  ]

  tags = merge(
    local.common_tags,
    {
      Name = "${local.name_prefix}-web-server"
    }
  )
}

# Add a null_resource to check if the EC2 instance is ready
resource "null_resource" "check_ec2_ready" {
  depends_on = [aws_instance.web_server]
  
  # This will force the provisioner to run on every apply
  triggers = {
    instance_id = aws_instance.web_server.id
  }
  
  provisioner "local-exec" {
    command = <<-EOT
      echo "Waiting for EC2 instance to be ready..."
      aws ec2 wait instance-status-ok --instance-ids ${aws_instance.web_server.id} --region ${var.aws_region}
      echo "EC2 instance is ready! You can SSH into it with:"
      echo "ssh -i userstatus-keypair.pem ec2-user@${aws_instance.web_server.public_ip}"
      echo "To check the user data script logs:"
      echo "ssh -i userstatus-keypair.pem ec2-user@${aws_instance.web_server.public_ip} 'sudo cat /var/log/user-data.log'"
      echo "To check if the container is running:"
      echo "ssh -i userstatus-keypair.pem ec2-user@${aws_instance.web_server.public_ip} 'sudo docker ps -a'"
    EOT
  }
}