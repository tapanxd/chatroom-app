import { userModel } from "../models/user.model.js"
import { UserStatus } from "../types/constants.js"
import { logger } from "../utils/logger.js"
import { config } from "../config/app.config.js"
import { awsService } from "./aws.service.js"
import { queueService } from "./queue.service.js" // Import queue service

/**
 * Status service - handles status-related operations
 */
export class StatusService {
  constructor(io) {
    this.io = io
    this.setupInactivityCheck()
  }

  /**
   * Change a user's status
   */
  async changeStatus(data) {
    const user = userModel.getUser(data.userId)

    if (!user) {
      logger.warn(`Failed to change status for non-existent user: ${data.userId}`)
      return false
    }

    const oldStatus = user.status
    const success = userModel.updateUserStatus(data.userId, data.status)

    if (success) {
      logger.info(`Status changed for user ${data.userId}: ${oldStatus} -> ${data.status}`)

      // Update status in DynamoDB
      await awsService.updateUserStatus(data.userId, data.status)

      // Create status notification
      const statusNotification = {
        type: "status_change_notification",
        userId: user.id,
        username: user.username,
        oldStatus: oldStatus,
        newStatus: data.status,
        timestamp: Date.now(),
      }

      // Send to SQS directly instead of using notification service
      await queueService.bufferMessage(statusNotification, "status_notification")
      logger.info(`Status change notification buffered to SQS: ${user.username} (${oldStatus} -> ${data.status})`)

      // REMOVE THIS LINE - don't use notification service as it might be causing duplication
      // await notificationService.sendStatusChangeNotification(user, oldStatus, data.status)
    } else {
      logger.warn(`Failed to update status for user: ${data.userId}`)
    }

    return success
  }

  /**
   * Update a user's activity
   */
  async updateActivity(data) {
    const user = userModel.getUser(data.userId)

    if (user && user.status === UserStatus.AWAY) {
      return this.changeStatus({
        userId: data.userId,
        status: UserStatus.ONLINE,
      })
    }

    return userModel.updateUserActivity(data.userId)
  }

  /**
   * Broadcast status updates to all clients
   */
  broadcastStatusUpdates() {
    this.io.emit("status_update", userModel.getAllUsers())
  }

  /**
   * Set up automatic status changes for inactive users
   */
  setupInactivityCheck() {
    // Check for inactive users every minute
    setInterval(async () => {
      const inactiveUserIds = userModel.findInactiveUsers(config.inactivityTimeout)

      if (inactiveUserIds.length > 0) {
        // Update status for all inactive users
        for (const userId of inactiveUserIds) {
          const user = userModel.getUser(userId)
          if (user) {
            const oldStatus = user.status
            userModel.updateUserStatus(userId, UserStatus.AWAY)

            // Update status in DynamoDB
            await awsService.updateUserStatus(userId, UserStatus.AWAY)

            // Create status notification for automatic change
            const statusNotification = {
              type: "status_change_notification",
              userId: user.id,
              username: user.username,
              oldStatus: oldStatus,
              newStatus: UserStatus.AWAY,
              timestamp: Date.now(),
              automatic: true,
            }

            // Send to SQS directly
            await queueService.bufferMessage(statusNotification, "status_notification")
            logger.info(
              `Automatic status change notification buffered to SQS: ${user.username} (${oldStatus} -> ${UserStatus.AWAY})`,
            )

            // REMOVE THIS LINE - don't use notification service
            // await notificationService.sendStatusChangeNotification(user, oldStatus, UserStatus.AWAY)
          }
        }

        logger.info(`Marked ${inactiveUserIds.length} users as away due to inactivity`)
        this.broadcastStatusUpdates()
      }
    }, 60 * 1000)
  }
}
