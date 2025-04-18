# S3 Bucket for Chat Archives
resource "aws_s3_bucket" "archive_bucket" {
  bucket = "${local.name_prefix}-archive-${random_id.suffix.hex}"

  tags = merge(
    local.common_tags,
    {
      Name = "${local.name_prefix}-archive"
    }
  )
}

# S3 Bucket Versioning
resource "aws_s3_bucket_versioning" "archive_bucket_versioning" {
  bucket = aws_s3_bucket.archive_bucket.id
  
  versioning_configuration {
    status = "Enabled"
  }
}

# S3 Bucket Server-Side Encryption
resource "aws_s3_bucket_server_side_encryption_configuration" "archive_bucket_encryption" {
  bucket = aws_s3_bucket.archive_bucket.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# S3 Bucket Policy
resource "aws_s3_bucket_policy" "archive_bucket_policy" {
  bucket = aws_s3_bucket.archive_bucket.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          AWS = aws_iam_role.ec2_role.arn
        }
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:ListBucket"
        ]
        Resource = [
          aws_s3_bucket.archive_bucket.arn,
          "${aws_s3_bucket.archive_bucket.arn}/*"
        ]
      }
    ]
  })
}