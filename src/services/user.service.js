import { userModel } from "../models/user.model.js"
import { UserStatus } from "../types/constants.js"
import { logger } from "../utils/logger.js"
import { awsService } from "./aws.service.js"

/**
 * User service - handles user-related operations
 */
export class UserService {
  /**
   * Register a new user
   */
  async registerUser(socket, data) {
    const username = data.username || `User-${socket.id.substring(0, 5)}`

    // Check if user already exists in DynamoDB
    const existingUser = await awsService.getUserByUsername(username)

    if (existingUser) {
      logger.info(`User found in database: ${username} (${existingUser.id})`)

      // Update the existing user's status to online
      existingUser.status = UserStatus.ONLINE
      existingUser.lastActivity = Date.now()

      // Save to memory model
      userModel.addUser(existingUser)

      // Update in DynamoDB
      await awsService.updateUserStatus(existingUser.id, UserStatus.ONLINE)

      // Store userId in socket data for disconnect handling
      socket.data.userId = existingUser.id

      return existingUser
    }

    // Create new user if not found
    const userId = data.userId || socket.id

    const user = {
      id: userId,
      username,
      status: UserStatus.ONLINE,
      lastActivity: Date.now(),
      createdAt: Date.now(),
    }

    // Save to memory model
    userModel.addUser(user)

    // Save to DynamoDB
    await awsService.saveUser(user)

    // Store userId in socket data for disconnect handling
    socket.data.userId = userId

    logger.info(`User registered: ${username} (${userId})`)

    return user
  }

  /**
   * Handle user disconnection
   */
  async handleDisconnect(socket) {
    const userId = socket.data.userId

    if (userId) {
      const user = userModel.getUser(userId)

      if (user) {
        logger.info(`User disconnected: ${user.username} (${userId})`)

        // Mark user as offline
        userModel.updateUserStatus(userId, UserStatus.OFFLINE)

        // Update in DynamoDB
        await awsService.updateUserStatus(userId, UserStatus.OFFLINE)
      }
    }
  }

  /**
   * Get all users
   */
  getAllUsers() {
    return userModel.getAllUsers()
  }

  /**
   * Get user by ID
   */
  getUserById(userId) {
    return userModel.getUser(userId)
  }

  /**
   * Update a user's status
   */
  updateUserStatus(userId, status) {
    return userModel.updateUserStatus(userId, status)
  }
}

// Export a singleton instance
export const userService = new UserService()
