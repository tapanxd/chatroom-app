# DynamoDB User Table
resource "aws_dynamodb_table" "user_table" {
  name         = "${local.name_prefix}-users"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "id"

  attribute {
    name = "id"
    type = "S"
  }

  attribute {
    name = "username"
    type = "S"
  }

  global_secondary_index {
    name            = "UsernameIndex"
    hash_key        = "username"
    projection_type = "ALL"
  }

  tags = merge(
    local.common_tags,
    {
      Name = "${local.name_prefix}-users"
    }
  )
}

# DynamoDB Connections Table
resource "aws_dynamodb_table" "connections_table" {
  name         = "${local.name_prefix}-connections"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "id"

  attribute {
    name = "id"
    type = "S"
  }

  attribute {
    name = "userId"
    type = "S"
  }

  attribute {
    name = "socketId"
    type = "S"
  }

  global_secondary_index {
    name            = "UserIdIndex"
    hash_key        = "userId"
    projection_type = "ALL"
  }

  global_secondary_index {
    name            = "SocketIdIndex"
    hash_key        = "socketId"
    projection_type = "ALL"
  }

  tags = merge(
    local.common_tags,
    {
      Name = "${local.name_prefix}-connections"
    }
  )
}

# DynamoDB Messages Table
resource "aws_dynamodb_table" "messages_table" {
  name         = "${local.name_prefix}-messages"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "id"

  attribute {
    name = "id"
    type = "S"
  }

  attribute {
    name = "chatId"
    type = "S"
  }

  attribute {
    name = "timestamp"
    type = "N"
  }

  global_secondary_index {
    name            = "ChatIdTimestampIndex"
    hash_key        = "chatId"
    range_key       = "timestamp"
    projection_type = "ALL"
  }

  tags = merge(
    local.common_tags,
    {
      Name = "${local.name_prefix}-messages"
    }
  )
}