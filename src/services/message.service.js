import { logger } from "../utils/logger.js"

/**
 * Message service - handles chat message operations
 */
export class MessageService {
  constructor() {
    this.messages = []
    this.MAX_MESSAGES = 100 // Limit the number of stored messages
  }

  /**
   * Add a new message
   */
  addMessage(message) {
    this.messages.push(message)

    // Keep only the most recent messages
    if (this.messages.length > this.MAX_MESSAGES) {
      this.messages = this.messages.slice(-this.MAX_MESSAGES)
    }

    logger.info(
      `New message from ${message.username}: ${message.text.substring(0, 30)}${message.text.length > 30 ? "..." : ""}`,
    )

    return message
  }

  /**
   * Get recent messages
   */
  getRecentMessages(limit = 50) {
    return this.messages.slice(-Math.min(limit, this.MAX_MESSAGES))
  }
}

// Export a singleton instance
export const messageService = new MessageService()
