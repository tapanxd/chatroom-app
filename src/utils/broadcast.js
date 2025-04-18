import { userModel } from "../models/user.model.js"

/**
 * Utility functions for broadcasting updates to clients
 */
export const broadcast = {
  /**
   * Broadcast user status updates to all connected clients
   */
  statusUpdates: (io) => {
    io.emit("status_update", userModel.getAllUsers())
  },
}
