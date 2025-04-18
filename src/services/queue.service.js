import { SQSClient, SendMessageCommand, ReceiveMessageCommand, DeleteMessageCommand } from "@aws-sdk/client-sqs"
import { logger } from "../utils/logger.js"

/**
 * Queue service - handles message buffering with Amazon SQS
 */
export class QueueService {
  constructor() {
    this.sqsClient = new SQSClient({ region: process.env.AWS_REGION || "us-east-1" })
    this.queueUrl = process.env.SQS_QUEUE_URL
    this.isProcessing = false
    this.messageHandlers = {}

    // Start processing messages if queue URL is configured
    if (this.queueUrl) {
      this.startMessageProcessor()
      logger.info(`SQS Queue service initialized with queue URL: ${this.queueUrl}`)
    } else {
      logger.warn("SQS Queue URL not configured, message buffering disabled")
    }
  }

  /**
   * Register a message handler for a specific message type
   */
  registerHandler(messageType, handler) {
    this.messageHandlers[messageType] = handler
    logger.info(`Registered handler for message type: ${messageType}`)
  }

  /**
   * Buffer a message to SQS
   */
  async bufferMessage(message, messageType = "chat_message") {
    try {
      if (!this.queueUrl) {
        logger.warn("SQS Queue URL not configured, skipping message buffering")
        return false
      }

      const params = {
        QueueUrl: this.queueUrl,
        MessageBody: JSON.stringify(message),
        MessageAttributes: {
          MessageType: {
            DataType: "String",
            StringValue: messageType,
          },
          UserId: {
            DataType: "String",
            StringValue: message.userId || "system",
          },
        },
        // Add a delay for system messages to ensure they appear after user messages
        DelaySeconds: message.userId === "system" ? 1 : 0,
      }

      const command = new SendMessageCommand(params)
      const result = await this.sqsClient.send(command)

      logger.info(`Message buffered to SQS: ${result.MessageId} (Type: ${messageType})`)
      return true
    } catch (error) {
      logger.error("Error buffering message to SQS:", error)
      return false
    }
  }

  /**
   * Start the message processor
   */
  startMessageProcessor() {
    if (this.isProcessing) return

    this.isProcessing = true
    this.processMessages()

    logger.info("SQS message processor started")
  }

  /**
   * Stop the message processor
   */
  stopMessageProcessor() {
    this.isProcessing = false
    logger.info("SQS message processor stopped")
  }

  /**
   * Process messages from the queue
   */
  async processMessages() {
    while (this.isProcessing) {
      try {
        const params = {
          QueueUrl: this.queueUrl,
          MaxNumberOfMessages: 10,
          WaitTimeSeconds: 20, // Long polling
          VisibilityTimeout: 30,
          MessageAttributeNames: ["All"],
        }

        const command = new ReceiveMessageCommand(params)
        const data = await this.sqsClient.send(command)

        if (data.Messages && data.Messages.length > 0) {
          logger.info(`Received ${data.Messages.length} messages from SQS`)

          for (const message of data.Messages) {
            try {
              // Process the message
              const messageBody = JSON.parse(message.Body)
              const messageType = message.MessageAttributes?.MessageType?.StringValue || "unknown"

              // Call the appropriate handler if registered
              if (this.messageHandlers[messageType]) {
                await this.messageHandlers[messageType](messageBody)
                logger.info(`Processed ${messageType} message: ${messageBody.id || "unknown"}`)
              } else {
                logger.warn(`No handler registered for message type: ${messageType}`)
              }

              // Delete the message from the queue after processing
              const deleteParams = {
                QueueUrl: this.queueUrl,
                ReceiptHandle: message.ReceiptHandle,
              }

              await this.sqsClient.send(new DeleteMessageCommand(deleteParams))
              logger.info(`Deleted message from SQS: ${message.MessageId}`)
            } catch (processError) {
              logger.error(`Error processing message ${message.MessageId}:`, processError)
            }
          }
        }
      } catch (error) {
        logger.error("Error receiving messages from SQS:", error)
        // Wait a bit before trying again to avoid hammering the API
        await new Promise((resolve) => setTimeout(resolve, 5000))
      }
    }
  }
}

// Export a singleton instance
export const queueService = new QueueService()
