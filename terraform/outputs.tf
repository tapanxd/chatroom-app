output "vpc_id" {
  description = "VPC ID"
  value       = aws_vpc.main.id
}

output "public_subnet_ids" {
  description = "Public subnet IDs"
  value       = aws_subnet.public[*].id
}

output "private_subnet_ids" {
  description = "Private subnet IDs"
  value       = aws_subnet.private[*].id
}

output "web_server_security_group_id" {
  description = "Web server security group ID"
  value       = aws_security_group.web_server.id
}

output "web_server_public_dns" {
  description = "Public DNS of the web server"
  value       = aws_instance.web_server.public_dns
}

output "web_server_public_ip" {
  description = "Public IP of the web server"
  value       = aws_instance.web_server.public_ip
}

output "user_table_name" {
  description = "Name of the DynamoDB user table"
  value       = aws_dynamodb_table.user_table.name
}

output "connections_table_name" {
  description = "Name of the DynamoDB connections table"
  value       = aws_dynamodb_table.connections_table.name
}

output "messages_table_name" {
  description = "Name of the DynamoDB messages table"
  value       = aws_dynamodb_table.messages_table.name
}

output "archive_bucket_name" {
  description = "Name of the S3 archive bucket"
  value       = aws_s3_bucket.archive_bucket.bucket
}

output "message_queue_url" {
  description = "URL of the SQS message queue"
  value       = aws_sqs_queue.message_queue.url
}

output "ecr_repository_url" {
  description = "URL of the ECR repository"
  value       = aws_ecr_repository.app_repository.repository_url
}

output "dashboard_url" {
  description = "URL of the CloudWatch dashboard"
  value       = "https://${var.aws_region}.console.aws.amazon.com/cloudwatch/home?region=${var.aws_region}#dashboards:name=${aws_cloudwatch_dashboard.main.dashboard_name}"
}

output "s3_vpc_endpoint_id" {
  description = "ID of the S3 VPC endpoint"
  value       = aws_vpc_endpoint.s3.id
}

output "dynamodb_vpc_endpoint_id" {
  description = "ID of the DynamoDB VPC endpoint"
  value       = aws_vpc_endpoint.dynamodb.id
}
