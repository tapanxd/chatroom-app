import { logger } from "../utils/logger.js"
import { queueService } from "./queue.service.js"

/**
 * Notification service - handles sending notifications
 * Now uses SQS instead of SNS for all notifications
 */
export class NotificationService {
  /**
   * Send a status change notification
   * This method is now just a pass-through to queueService
   * to maintain compatibility with existing code
   */
  async sendStatusChangeNotification(user, oldStatus, newStatus) {
    try {
      logger.info(`Notification service: status change for ${user.username} (${oldStatus} -> ${newStatus})`)

      // We're not doing anything here anymore - status notifications are sent directly
      // from the status service to avoid duplication

      return true
    } catch (error) {
      logger.error("Error in notification service:", error)
      return false
    }
  }

  /**
   * Send a chat termination notification
   * This method is now just a pass-through to queueService
   * to maintain compatibility with existing code
   */
  async sendChatTerminationNotification(userId, username, reason) {
    try {
      logger.info(`Notification service: chat termination by ${username}`)

      const notification = {
        type: "chat_termination_notification",
        by: username,
        reason: reason,
        timestamp: Date.now(),
      }

      // Buffer the notification to SQS
      await queueService.bufferMessage(notification, "chat_termination")

      return true
    } catch (error) {
      logger.error("Error in notification service:", error)
      return false
    }
  }
}

// Export a singleton instance
export const notificationService = new NotificationService()
