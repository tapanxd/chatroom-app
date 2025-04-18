import { UserStatus } from "../types/constants.js"

/**
 * User store model - manages user data
 */
export class UserModel {
  constructor() {
    this.users = new Map()
  }

  /**
   * Add a new user to the store
   */
  addUser(user) {
    this.users.set(user.id, user)
  }

  /**
   * Get a user by ID
   */
  getUser(userId) {
    return this.users.get(userId)
  }

  /**
   * Remove a user from the store
   */
  removeUser(userId) {
    return this.users.delete(userId)
  }

  /**
   * Get all users
   */
  getAllUsers() {
    return Array.from(this.users.values())
  }

  /**
   * Update a user's status
   */
  updateUserStatus(userId, status) {
    const user = this.users.get(userId)
    if (user) {
      user.status = status
      user.lastActivity = Date.now()
      this.users.set(userId, user)
      return true
    }
    return false
  }

  /**
   * Update a user's activity timestamp
   */
  updateUserActivity(userId) {
    const user = this.users.get(userId)
    if (user) {
      user.lastActivity = Date.now()
      this.users.set(userId, user)
      return true
    }
    return false
  }

  /**
   * Find users who have been inactive for longer than the specified time
   */
  findInactiveUsers(inactiveTime) {
    const now = Date.now()
    const inactiveUserIds = []

    this.users.forEach((user, userId) => {
      if (user.status === UserStatus.ONLINE && now - user.lastActivity > inactiveTime) {
        inactiveUserIds.push(userId)
      }
    })

    return inactiveUserIds
  }
}

// Export a singleton instance
export const userModel = new UserModel()
