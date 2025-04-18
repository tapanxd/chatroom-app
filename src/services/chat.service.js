import { v4 as uuidv4 } from "uuid"
import { logger } from "../utils/logger.js"
import { awsService } from "./aws.service.js"
import { queueService } from "./queue.service.js" // Import queue service

/**
 * Chat service - handles chat-related operations
 */
export class ChatService {
  constructor() {
    this.messages = []
    this.MAX_MESSAGES = 100 // Limit the number of stored messages
    this.chatId = uuidv4() // Unique ID for the current chat session
    this.archives = [] // List of archived chats

    // Load recent messages from DynamoDB on startup
    this.loadRecentMessages()
  }

  /**
   * Load recent messages from DynamoDB
   */
  async loadRecentMessages() {
    try {
      logger.info(`Loading recent messages for chat ${this.chatId}`)
      const dbMessages = await awsService.getRecentMessages(this.chatId)
      if (dbMessages && dbMessages.length > 0) {
        this.messages = dbMessages
        logger.info(`Loaded ${dbMessages.length} messages from DynamoDB`)
      } else {
        logger.info("No recent messages found in DynamoDB")
      }
    } catch (error) {
      logger.error("Error loading messages from DynamoDB:", error)
    }
  }

  /**
   * Add a new message
   */
  async addMessage(message) {
    try {
      // Add message to in-memory store
      this.messages.push(message)

      // Keep only the most recent messages in memory
      if (this.messages.length > this.MAX_MESSAGES) {
        this.messages = this.messages.slice(-this.MAX_MESSAGES)
      }

      // Save message to DynamoDB
      const messageWithChatId = {
        ...message,
        chatId: this.chatId,
      }
      await awsService.saveMessage(messageWithChatId)

      // Buffer the message to SQS
      await queueService.bufferMessage(message, "chat_message")

      logger.info(
        `New message from ${message.username}: ${message.text.substring(0, 30)}${message.text.length > 30 ? "..." : ""}`,
      )

      return message
    } catch (error) {
      logger.error("Error adding message:", error)
      return message // Still return the message even if DB save fails
    }
  }

  /**
   * Get recent messages
   */
  getRecentMessages(limit = 50) {
    return this.messages.slice(-Math.min(limit, this.MAX_MESSAGES))
  }

  /**
   * Terminate and archive the current chat
   */
  async terminateChat(reason) {
    try {
      if (this.messages.length === 0) {
        logger.warn("No messages to archive")
        return true // Still consider it a success
      }

      // Archive the current chat to S3
      const s3Key = await awsService.archiveChat(this.chatId, this.messages)

      if (s3Key) {
        // Create archive record
        const archive = {
          id: this.chatId,
          archivedAt: Date.now(),
          messageCount: this.messages.length,
          s3Key,
        }

        // Add to archives list
        this.archives.push(archive)

        logger.info(`Chat terminated and archived: ${archive.id} (${archive.messageCount} messages)`)

        if (reason) {
          logger.info(`Termination reason: ${reason}`)
        }
      } else {
        logger.warn("Failed to archive chat to S3, but continuing with termination")
      }

      // Clear current messages
      this.messages = []

      // Generate new chat ID for the next session
      this.chatId = uuidv4()
      logger.info(`New chat session started with ID: ${this.chatId}`)

      return true
    } catch (error) {
      logger.error("Error terminating chat:", error)
      return false
    }
  }

  /**
   * Get list of archived chats
   */
  getArchives() {
    return this.archives
  }

  /**
   * Retrieve an archived chat
   */
  async getArchivedChat(archiveId) {
    try {
      const archive = this.archives.find((a) => a.id === archiveId)

      if (!archive) {
        logger.warn(`Archive not found: ${archiveId}`)
        return null
      }

      return await awsService.getArchivedChat(archive.s3Key)
    } catch (error) {
      logger.error("Error retrieving archived chat:", error)
      return null
    }
  }
}

// Export a singleton instance
export const chatService = new ChatService()
