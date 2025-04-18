# SQS Queue for Messages
resource "aws_sqs_queue" "message_queue" {
  name                      = "${local.name_prefix}-messages"
  visibility_timeout_seconds = 30
  message_retention_seconds = 345600  # 4 days

  tags = merge(
    local.common_tags,
    {
      Name = "${local.name_prefix}-messages"
    }
  )
}