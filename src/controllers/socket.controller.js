import { userService } from "../services/user.service.js"
import { StatusService } from "../services/status.service.js" // Add this import
import { chatService } from "../services/chat.service.js"
import { logger } from "../utils/logger.js"
import { v4 as uuidv4 } from "uuid"
import { notificationService } from "../services/notification.service.js"
import { awsService } from "../services/aws.service.js"
import { queueService } from "../services/queue.service.js"
import { UserStatus } from "../types/constants.js"

/**
 * Socket controller - handles WebSocket events
 */
export class SocketController {
  constructor(io) {
    this.io = io
    this.statusService = new StatusService(io)

    // Register message handlers with the queue service
    this.registerQueueHandlers(io)

    this.setupSocketHandlers()
  }

  /**
   * Register message handlers with the queue service
   */
  registerQueueHandlers(io) {
    // Register handler for chat messages
    queueService.registerHandler("chat_message", (message) => {
      io.emit("chat_message", message)
      logger.info(`Emitted buffered chat message to clients: ${message.id}`)
      return Promise.resolve()
    })

    // Register handler for status notifications
    queueService.registerHandler("status_notification", (notification) => {
      io.emit("notification", notification)
      logger.info(`Emitted buffered status notification to clients: ${notification.userId}`)
      return Promise.resolve()
    })

    // Register handler for chat termination
    queueService.registerHandler("chat_termination", (termination) => {
      io.emit("chat_terminated", termination)
      logger.info(`Emitted buffered chat termination to clients`)
      return Promise.resolve()
    })
  }

  /**
   * Set up socket event handlers
   */
  setupSocketHandlers() {
    this.io.on("connection", async (socket) => {
      logger.info(`User connected: ${socket.id} from ${socket.handshake.address}`)

      // Create a temporary connection record immediately on connection
      try {
        const tempConnection = {
          connectionId: uuidv4(),
          socketId: socket.id,
          userId: "anonymous", // Will be updated when user registers
          ipAddress: socket.handshake.address,
          userAgent: socket.handshake.headers["user-agent"] || "Unknown",
          connectedAt: Date.now(),
          lastActivity: Date.now(),
        }

        await awsService.saveConnection(tempConnection)
        logger.info(`Temporary connection record created for socket: ${socket.id}`)
      } catch (error) {
        logger.error("Error creating temporary connection record:", error)
      }

      // Handle user registration
      socket.on("register", async (data) => {
        try {
          if (!data || !data.username) {
            throw new Error("Username is required")
          }

          const user = await userService.registerUser(socket, data)

          // Save connection information to DynamoDB
          const connection = {
            connectionId: uuidv4(),
            userId: user.id,
            socketId: socket.id,
            ipAddress: socket.handshake.address,
            userAgent: socket.handshake.headers["user-agent"] || "Unknown",
            connectedAt: Date.now(),
            lastActivity: Date.now(),
          }

          await awsService.saveConnection(connection)

          // Send confirmation to the user
          socket.emit("registered", { userId: user.id, username: user.username })

          // Send recent chat messages to the newly registered user
          socket.emit("chat_history", chatService.getRecentMessages())

          // Broadcast updated user list
          this.statusService.broadcastStatusUpdates()

          // Broadcast user joined message
          const joinMessage = {
            id: uuidv4(),
            userId: "system",
            username: "System",
            text: `${user.username} has joined the channel`,
            timestamp: Date.now(),
          }
          await chatService.addMessage(joinMessage)
        } catch (error) {
          logger.error("Error during user registration:", error)
          socket.emit("error", { message: `Failed to register user: ${error.message}` })
        }
      })

      // Handle status changes
      socket.on("status_change", async (data) => {
        try {
          if (!data || !data.userId || !data.status) {
            throw new Error("User ID and status are required")
          }

          const user = userService.getUserById(data.userId)
          if (!user) {
            throw new Error("User not found")
          }

          const oldStatus = user.status
          const success = await this.statusService.changeStatus(data)

          if (success) {
            // Update connection activity
            await awsService.updateConnectionActivity(socket.id)

            // Broadcast updated user list
            this.statusService.broadcastStatusUpdates()
          } else {
            throw new Error("Failed to update status")
          }
        } catch (error) {
          logger.error("Error during status change:", error)
          socket.emit("error", { message: `Failed to change status: ${error.message}` })
        }
      })

      // Handle user activity
      socket.on("user_activity", async (data) => {
        try {
          if (!data || !data.userId) {
            throw new Error("User ID is required")
          }

          // Update connection activity in DynamoDB
          await awsService.updateConnectionActivity(socket.id)

          const user = userService.getUserById(data.userId)
          const oldStatus = user ? user.status : null

          const statusChanged = await this.statusService.updateActivity(data)

          if (statusChanged && user && oldStatus === UserStatus.AWAY) {
            // Broadcast updated user list if status changed from AWAY to ONLINE
            this.statusService.broadcastStatusUpdates()
          }
        } catch (error) {
          logger.error("Error during activity update:", error)
          // Don't emit error to client for activity updates to avoid spam
        }
      })

      // Handle chat messages
      socket.on("send_message", async (data) => {
        try {
          if (!data || !data.text) {
            throw new Error("Message text is required")
          }

          const userId = socket.data.userId
          if (!userId) {
            throw new Error("User not registered")
          }

          const user = userService.getUserById(userId)

          if (user && data.text.trim()) {
            const message = {
              id: uuidv4(),
              userId: user.id,
              username: user.username,
              text: data.text.trim(),
              timestamp: Date.now(),
            }

            // Store the message
            await chatService.addMessage(message)

            // Update connection activity
            await awsService.updateConnectionActivity(socket.id)
          } else {
            throw new Error("User not found or invalid message")
          }
        } catch (error) {
          logger.error("Error sending message:", error)
          socket.emit("error", { message: `Failed to send message: ${error.message}` })
        }
      })

      // Handle chat termination
      socket.on("terminate_chat", async (data) => {
        try {
          const userId = socket.data.userId
          if (!userId) {
            throw new Error("User not registered")
          }

          const user = userService.getUserById(userId)

          if (user) {
            // Terminate and archive the chat
            const success = await chatService.terminateChat(data.reason)

            if (success) {
              // Send notification about chat termination
              await notificationService.sendChatTerminationNotification(user.id, user.username, data.reason)

              // Notify all clients that the chat has been terminated
              const terminationMessage = {
                id: uuidv4(),
                userId: "system",
                username: "System",
                text: `Chat terminated by ${user.username}${data.reason ? `: ${data.reason}` : ""}`,
                timestamp: Date.now(),
              }

              // Start a new chat session
              await chatService.addMessage(terminationMessage)
            } else {
              throw new Error("Failed to terminate chat")
            }
          } else {
            throw new Error("User not found")
          }
        } catch (error) {
          logger.error("Error terminating chat:", error)
          socket.emit("error", { message: `Failed to terminate chat: ${error.message}` })
        }
      })

      // Handle disconnection
      socket.on("disconnect", async () => {
        try {
          const userId = socket.data.userId
          const user = userService.getUserById(userId)

          if (user) {
            // Delete connection from DynamoDB
            await awsService.deleteConnection(socket.id)

            await userService.handleDisconnect(socket)
            this.statusService.broadcastStatusUpdates()

            // Broadcast user left message
            const leaveMessage = {
              id: uuidv4(),
              userId: "system",
              username: "System",
              text: `${user.username} has left the channel`,
              timestamp: Date.now(),
            }
            await chatService.addMessage(leaveMessage)
          }
        } catch (error) {
          logger.error("Error during disconnect handling:", error)
        }
      })
    })
  }
}
