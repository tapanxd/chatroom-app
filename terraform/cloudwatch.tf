# SNS Topic for Alarms
resource "aws_sns_topic" "alarms" {
  name = "${local.name_prefix}-alarms"
  
  tags = local.common_tags
}

# CloudWatch Alarm for EC2 CPU
resource "aws_cloudwatch_metric_alarm" "ec2_cpu" {
  alarm_name          = "${local.name_prefix}-ec2-cpu-alarm"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "CPUUtilization"
  namespace           = "AWS/EC2"
  period              = 300
  statistic           = "Average"
  threshold           = 80
  alarm_description   = "Alarm if CPU exceeds 80% for 5 minutes"
  alarm_actions       = [aws_sns_topic.alarms.arn]
  
  dimensions = {
    InstanceId = aws_instance.web_server.id
  }
  
  tags = local.common_tags
  
  # Add dependency to ensure the EC2 instance is fully created
  depends_on = [
    aws_instance.web_server
  ]
}

# CloudWatch Alarm for DynamoDB Read Capacity
resource "aws_cloudwatch_metric_alarm" "dynamodb_read" {
  alarm_name          = "${local.name_prefix}-dynamodb-read-alarm"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "ConsumedReadCapacityUnits"
  namespace           = "AWS/DynamoDB"
  period              = 300
  statistic           = "Sum"
  threshold           = 240
  alarm_description   = "Alarm if DynamoDB consumed read capacity exceeds threshold"
  alarm_actions       = [aws_sns_topic.alarms.arn]
  
  dimensions = {
    TableName = aws_dynamodb_table.user_table.name
  }
  
  tags = local.common_tags
  
  # Add dependency to ensure the DynamoDB table is fully created
  depends_on = [
    aws_dynamodb_table.user_table
  ]
}

# CloudWatch Alarm for DynamoDB Write Capacity
resource "aws_cloudwatch_metric_alarm" "dynamodb_write" {
  alarm_name          = "${local.name_prefix}-dynamodb-write-alarm"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "ConsumedWriteCapacityUnits"
  namespace           = "AWS/DynamoDB"
  period              = 300
  statistic           = "Sum"
  threshold           = 240
  alarm_description   = "Alarm if DynamoDB consumed write capacity exceeds threshold"
  alarm_actions       = [aws_sns_topic.alarms.arn]
  
  dimensions = {
    TableName = aws_dynamodb_table.user_table.name
  }
  
  tags = local.common_tags
  
  # Add dependency to ensure the DynamoDB table is fully created
  depends_on = [
    aws_dynamodb_table.user_table
  ]
}

# CloudWatch Alarm for SQS Queue
resource "aws_cloudwatch_metric_alarm" "sqs_messages" {
  alarm_name          = "${local.name_prefix}-sqs-messages-alarm"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "ApproximateNumberOfMessagesVisible"
  namespace           = "AWS/SQS"
  period              = 300
  statistic           = "Sum"
  threshold           = 100
  alarm_description   = "Alarm if SQS queue has too many messages"
  alarm_actions       = [aws_sns_topic.alarms.arn]
  
  dimensions = {
    QueueName = aws_sqs_queue.message_queue.name
  }
  
  tags = local.common_tags
  
  # Add dependency to ensure the SQS queue is fully created
  depends_on = [
    aws_sqs_queue.message_queue
  ]
}

# CloudWatch Dashboard
resource "aws_cloudwatch_dashboard" "main" {
  dashboard_name = "${local.name_prefix}-dashboard"
  
  dashboard_body = jsonencode({
    widgets = [
      {
        type   = "metric"
        x      = 0
        y      = 0
        width  = 12
        height = 6
        properties = {
          metrics = [
            ["AWS/EC2", "CPUUtilization", "InstanceId", aws_instance.web_server.id]
          ]
          period = 300
          stat   = "Average"
          region = var.aws_region
          title  = "EC2 CPU Utilization"
        }
      },
      {
        type   = "metric"
        x      = 12
        y      = 0
        width  = 12
        height = 6
        properties = {
          metrics = [
            ["AWS/DynamoDB", "ConsumedReadCapacityUnits", "TableName", aws_dynamodb_table.user_table.name],
            ["AWS/DynamoDB", "ConsumedWriteCapacityUnits", "TableName", aws_dynamodb_table.user_table.name]
          ]
          period = 300
          stat   = "Sum"
          region = var.aws_region
          title  = "DynamoDB Capacity Units"
        }
      },
      {
        type   = "metric"
        x      = 0
        y      = 6
        width  = 12
        height = 6
        properties = {
          metrics = [
            ["AWS/SQS", "ApproximateNumberOfMessagesVisible", "QueueName", aws_sqs_queue.message_queue.name],
            ["AWS/SQS", "NumberOfMessagesSent", "QueueName", aws_sqs_queue.message_queue.name],
            ["AWS/SQS", "NumberOfMessagesReceived", "QueueName", aws_sqs_queue.message_queue.name]
          ]
          period = 300
          stat   = "Sum"
          region = var.aws_region
          title  = "SQS Queue Metrics"
        }
      }
    ]
  })
  
  # Add dependencies to ensure all referenced resources are fully created
  depends_on = [
    aws_instance.web_server,
    aws_dynamodb_table.user_table,
    aws_sqs_queue.message_queue
  ]
}