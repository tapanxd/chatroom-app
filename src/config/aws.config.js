import { DynamoDBClient } from "@aws-sdk/client-dynamodb"
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb"
import { S3Client } from "@aws-sdk/client-s3"
import { SQSClient } from "@aws-sdk/client-sqs"
import { logger } from "../utils/logger.js"

// AWS Region
const REGION = process.env.AWS_REGION || "us-east-1"

// Initialize DynamoDB client
const dynamoClient = new DynamoDBClient({ region: REGION })
export const dynamoDbDocClient = DynamoDBDocumentClient.from(dynamoClient)

// Initialize S3 client
export const s3Client = new S3Client({ region: REGION })

// Initialize SQS client
export const sqsClient = new SQSClient({ region: REGION })

// AWS Configuration
export const awsConfig = {
  dynamoDb: {
    userTableName: process.env.DYNAMODB_TABLE_NAME || "UserStatusChat_Users",
    connectionTableName: process.env.CONNECTIONS_TABLE_NAME || "UserStatusChat_Users_Connections",
    messageTableName: process.env.MESSAGES_TABLE_NAME || "UserStatusChat_Users_Messages",
    region: REGION,
  },
  s3: {
    bucketName: process.env.S3_BUCKET_NAME || "user-status-chat-archive",
    region: REGION,
  },
  sqs: {
    queueUrl: process.env.SQS_QUEUE_URL || "",
    region: REGION,
  },
}

// Log configuration on startup
logger.info("AWS Configuration:", {
  region: REGION,
  userTable: awsConfig.dynamoDb.userTableName,
  connectionTable: awsConfig.dynamoDb.connectionTableName,
  messageTable: awsConfig.dynamoDb.messageTableName,
  s3Bucket: awsConfig.s3.bucketName,
  sqsQueueUrl: awsConfig.sqs.queueUrl,
})
