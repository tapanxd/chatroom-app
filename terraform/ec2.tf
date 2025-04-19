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

# EC2 Instance (without remote-exec)
resource "aws_instance" "web_server" {
  ami                    = data.aws_ami.amazon_linux_2.id
  instance_type          = var.instance_type
  key_name               = var.key_name
  vpc_security_group_ids = [aws_security_group.web_server.id]
  subnet_id              = aws_subnet.public[0].id
  iam_instance_profile   = aws_iam_instance_profile.ec2_profile.name
  
  # Keep a minimal user_data script for initial setup
  user_data = <<-EOF
    #!/bin/bash -xe
    yum update -y
    amazon-linux-extras install docker -y
    service docker start
    systemctl enable docker
    usermod -a -G docker ec2-user
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

# Use null_resource with local-exec to run SSH commands
resource "null_resource" "setup_ec2" {
  depends_on = [aws_instance.web_server]

  # This will force the provisioner to run on every apply
  triggers = {
    instance_id = aws_instance.web_server.id
    timestamp   = timestamp()
  }

  provisioner "local-exec" {
    command = <<-EOT
      # Wait for SSH to be available
      echo "Waiting for SSH to become available..."
      while ! ssh -o StrictHostKeyChecking=no -o ConnectTimeout=5 -i userstatus-keypair.pem ec2-user@${aws_instance.web_server.public_ip} echo "SSH is up"; do
        sleep 5
      done

      # Create a setup script
      cat > setup.sh <<'EOF'
#!/bin/bash
echo 'Starting EC2 setup at $(date)' > /home/ec2-user/setup.log

# Install AWS CLI
echo 'Installing AWS CLI...' >> /home/ec2-user/setup.log
curl 'https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip' -o 'awscliv2.zip'
unzip awscliv2.zip
sudo ./aws/install

# Wait for Docker to be fully available
echo 'Waiting for Docker to be ready...' >> /home/ec2-user/setup.log
sudo systemctl status docker >> /home/ec2-user/setup.log
sleep 10  # Give Docker a moment to fully initialize

# Login to ECR
echo 'Logging in to ECR...' >> /home/ec2-user/setup.log
aws ecr get-login-password --region ${var.aws_region} | sudo docker login --username AWS --password-stdin ${aws_ecr_repository.app_repository.repository_url} >> /home/ec2-user/setup.log 2>&1

# Pull the image
echo 'Pulling Docker image...' >> /home/ec2-user/setup.log
sudo docker pull ${aws_ecr_repository.app_repository.repository_url}:latest >> /home/ec2-user/setup.log 2>&1

# Run the container
echo 'Starting container...' >> /home/ec2-user/setup.log
sudo docker run -d -p 80:3000 --name userstatus --restart always -e AWS_REGION=${var.aws_region} -e DYNAMODB_TABLE_NAME=${aws_dynamodb_table.user_table.name} -e S3_BUCKET_NAME=${aws_s3_bucket.archive_bucket.bucket} -e SQS_QUEUE_URL=${aws_sqs_queue.message_queue.url} -e CONNECTIONS_TABLE_NAME=${aws_dynamodb_table.connections_table.name} -e MESSAGES_TABLE_NAME=${aws_dynamodb_table.messages_table.name} ${aws_ecr_repository.app_repository.repository_url}:latest >> /home/ec2-user/setup.log 2>&1

# Verify container is running
echo 'Verifying container status...' >> /home/ec2-user/setup.log
sudo docker ps -a >> /home/ec2-user/setup.log 2>&1
sudo docker logs userstatus >> /home/ec2-user/setup.log 2>&1

echo 'EC2 setup completed at $(date)' >> /home/ec2-user/setup.log
EOF

      # Copy the setup script to the EC2 instance
      scp -o StrictHostKeyChecking=no -i userstatus-keypair.pem setup.sh ec2-user@${aws_instance.web_server.public_ip}:/home/ec2-user/

      # Run the setup script
      ssh -o StrictHostKeyChecking=no -i userstatus-keypair.pem ec2-user@${aws_instance.web_server.public_ip} "chmod +x /home/ec2-user/setup.sh && /home/ec2-user/setup.sh"

      # Clean up
      rm setup.sh
    EOT
  }
}