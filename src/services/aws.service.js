import { PutCommand, UpdateCommand, QueryCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb"
import { PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3"
import { dynamoDbDocClient, s3Client, awsConfig } from "../config/aws.config.js"
import { logger } from "../utils/logger.js"
import { v4 as uuidv4 } from "uuid"

/**
 * AWS Service - handles interactions with AWS services
 */
export class AwsService {
  /**
   * Check if a user exists in DynamoDB
   */
  async userExists(username) {
    try {
      const params = {
        TableName: awsConfig.dynamoDb.userTableName,
        IndexName: "UsernameIndex",
        KeyConditionExpression: "username = :username",
        ExpressionAttributeValues: {
          ":username": username,
        },
      }

      const { Items } = await dynamoDbDocClient.send(new QueryCommand(params))
      return !!(Items && Items.length > 0) // Force boolean with !!
    } catch (error) {
      logger.error("Error checking if user exists:", error)
      return false
    }
  }

  /**
   * Get user by username from DynamoDB
   */
  async getUserByUsername(username) {
    try {
      const params = {
        TableName: awsConfig.dynamoDb.userTableName,
        IndexName: "UsernameIndex",
        KeyConditionExpression: "username = :username",
        ExpressionAttributeValues: {
          ":username": username,
        },
      }

      const { Items } = await dynamoDbDocClient.send(new QueryCommand(params))

      if (Items && Items.length > 0) {
        return Items[0]
      }

      return null
    } catch (error) {
      logger.error("Error getting user by username:", error)
      return null
    }
  }

  /**
   * Save user to DynamoDB
   */
  async saveUser(user) {
    try {
      const params = {
        TableName: awsConfig.dynamoDb.userTableName,
        Item: {
          id: user.id,
          username: user.username,
          status: user.status,
          lastActivity: user.lastActivity,
          createdAt: Date.now(),
        },
      }

      await dynamoDbDocClient.send(new PutCommand(params))
      logger.info(`User saved to DynamoDB: ${user.username} (${user.id})`)
      return true
    } catch (error) {
      logger.error("Error saving user to DynamoDB:", error)
      return false
    }
  }

  /**
   * Update user status in DynamoDB
   */
  async updateUserStatus(userId, status) {
    try {
      const params = {
        TableName: awsConfig.dynamoDb.userTableName,
        Key: {
          id: userId,
        },
        UpdateExpression: "set #status = :status, lastActivity = :lastActivity",
        ExpressionAttributeNames: {
          "#status": "status",
        },
        ExpressionAttributeValues: {
          ":status": status,
          ":lastActivity": Date.now(),
        },
        ReturnValues: "UPDATED_NEW",
      }

      await dynamoDbDocClient.send(new UpdateCommand(params))
      logger.info(`User status updated in DynamoDB: ${userId} -> ${status}`)
      return true
    } catch (error) {
      logger.error("Error updating user status in DynamoDB:", error)
      return false
    }
  }

  /**
   * Save connection to DynamoDB
   */
  async saveConnection(connection) {
    try {
      // Generate a connectionId if not provided
      if (!connection.connectionId) {
        connection.connectionId = uuidv4()
      }

      // Ensure all required fields have values
      const connectionToSave = {
        id: connection.connectionId, // Use connectionId as the id
        connectionId: connection.connectionId,
        userId: connection.userId || "anonymous",
        socketId: connection.socketId || "unknown",
        ipAddress: connection.ipAddress || "unknown",
        userAgent: connection.userAgent || "unknown",
        connectedAt: connection.connectedAt || Date.now(),
        lastActivity: connection.lastActivity || Date.now(),
      }

      const params = {
        TableName: awsConfig.dynamoDb.connectionTableName,
        Item: connectionToSave,
      }

      await dynamoDbDocClient.send(new PutCommand(params))
      logger.info(`Connection saved to DynamoDB: ${connectionToSave.socketId} (User: ${connectionToSave.userId})`)
      return true
    } catch (error) {
      logger.error("Error saving connection to DynamoDB:", error)
      return false
    }
  }

  /**
   * Update connection activity in DynamoDB
   */
  async updateConnectionActivity(socketId) {
    try {
      if (!socketId) {
        logger.warn("Cannot update connection activity: socketId is undefined or null")
        return false
      }

      // First get the connection to get the id
      const getParams = {
        TableName: awsConfig.dynamoDb.connectionTableName,
        IndexName: "SocketIdIndex",
        KeyConditionExpression: "socketId = :socketId",
        ExpressionAttributeValues: {
          ":socketId": socketId,
        },
      }

      const { Items } = await dynamoDbDocClient.send(new QueryCommand(getParams))

      if (!Items || Items.length === 0) {
        // Instead of just logging a warning, create a new connection record
        logger.info(`Connection not found for socketId: ${socketId}, creating a new record`)

        // Create a new connection with minimal information
        const newConnection = {
          connectionId: uuidv4(),
          socketId: socketId,
          userId: "anonymous", // This will be updated when the user registers
          ipAddress: "unknown",
          userAgent: "unknown",
          connectedAt: Date.now(),
          lastActivity: Date.now(),
        }

        // Save the new connection
        await this.saveConnection(newConnection)
        return true
      }

      const connection = Items[0]

      // Now update the connection
      const updateParams = {
        TableName: awsConfig.dynamoDb.connectionTableName,
        Key: {
          id: connection.id,
        },
        UpdateExpression: "set lastActivity = :lastActivity",
        ExpressionAttributeValues: {
          ":lastActivity": Date.now(),
        },
        ReturnValues: "UPDATED_NEW",
      }

      await dynamoDbDocClient.send(new UpdateCommand(updateParams))
      logger.info(`Connection activity updated in DynamoDB: ${socketId}`)
      return true
    } catch (error) {
      logger.error("Error updating connection activity in DynamoDB:", error)
      return false
    }
  }

  /**
   * Delete connection from DynamoDB
   */
  async deleteConnection(socketId) {
    try {
      if (!socketId) {
        logger.warn("Cannot delete connection: socketId is undefined or null")
        return false
      }

      // First get the connection to get the id
      const getParams = {
        TableName: awsConfig.dynamoDb.connectionTableName,
        IndexName: "SocketIdIndex",
        KeyConditionExpression: "socketId = :socketId",
        ExpressionAttributeValues: {
          ":socketId": socketId,
        },
      }

      const { Items } = await dynamoDbDocClient.send(new QueryCommand(getParams))

      if (!Items || Items.length === 0) {
        // Just log and return success - no need to delete what doesn't exist
        logger.info(`Connection not found for socketId: ${socketId}, nothing to delete`)
        return true
      }

      const connection = Items[0]

      // Now delete the connection
      const deleteParams = {
        TableName: awsConfig.dynamoDb.connectionTableName,
        Key: {
          id: connection.id,
        },
      }

      await dynamoDbDocClient.send(new DeleteCommand(deleteParams))
      logger.info(`Connection deleted from DynamoDB: ${socketId}`)
      return true
    } catch (error) {
      logger.error("Error deleting connection from DynamoDB:", error)
      return false
    }
  }

  /**
   * Get active connections for a user
   */
  async getUserConnections(userId) {
    try {
      const params = {
        TableName: awsConfig.dynamoDb.connectionTableName,
        IndexName: "UserIdIndex",
        KeyConditionExpression: "userId = :userId",
        ExpressionAttributeValues: {
          ":userId": userId,
        },
      }

      const { Items } = await dynamoDbDocClient.send(new QueryCommand(params))
      return Items || []
    } catch (error) {
      logger.error("Error getting user connections from DynamoDB:", error)
      return []
    }
  }

  /**
   * Save message to DynamoDB
   */
  async saveMessage(message) {
    try {
      // Make sure the message has an id
      if (!message.id) {
        message.id = uuidv4()
      }

      const params = {
        TableName: awsConfig.dynamoDb.messageTableName,
        Item: {
          id: message.id,
          userId: message.userId,
          username: message.username,
          text: message.text,
          timestamp: message.timestamp,
          chatId: message.chatId || "default",
        },
      }

      await dynamoDbDocClient.send(new PutCommand(params))
      logger.info(`Message saved to DynamoDB: ${message.id}`)
      return true
    } catch (error) {
      logger.error("Error saving message to DynamoDB:", error)
      return false
    }
  }

  /**
   * Get recent messages from DynamoDB
   */
  async getRecentMessages(chatId = "default", limit = 50) {
    try {
      const params = {
        TableName: awsConfig.dynamoDb.messageTableName,
        IndexName: "ChatIdTimestampIndex",
        KeyConditionExpression: "chatId = :chatId",
        ExpressionAttributeValues: {
          ":chatId": chatId,
        },
        ScanIndexForward: false, // descending order (newest first)
        Limit: limit,
      }

      const { Items } = await dynamoDbDocClient.send(new QueryCommand(params))

      // Sort by timestamp (oldest first) before returning
      return (Items || []).sort((a, b) => a.timestamp - b.timestamp)
    } catch (error) {
      logger.error("Error getting recent messages from DynamoDB:", error)
      return []
    }
  }

  /**
   * Archive chat to S3
   */
  async archiveChat(chatId, messages) {
    try {
      if (!awsConfig.s3.bucketName) {
        logger.warn("S3 bucket not configured, skipping chat archiving")
        return null
      }

      const timestamp = new Date().toISOString()
      const archiveId = uuidv4()
      const key = `chats/${chatId}/${timestamp}-${archiveId}.json`

      const params = {
        Bucket: awsConfig.s3.bucketName,
        Key: key,
        Body: JSON.stringify({
          chatId,
          archivedAt: timestamp,
          messageCount: messages.length,
          messages,
        }),
        ContentType: "application/json",
      }

      await s3Client.send(new PutObjectCommand(params))
      logger.info(`Chat archived to S3: ${key}`)
      return key
    } catch (error) {
      logger.error("Error archiving chat to S3:", error)
      return null
    }
  }

  /**
   * Retrieve archived chat from S3
   */
  async getArchivedChat(key) {
    try {
      if (!awsConfig.s3.bucketName) {
        logger.warn("S3 bucket not configured, cannot retrieve archived chat")
        return null
      }

      const params = {
        Bucket: awsConfig.s3.bucketName,
        Key: key,
      }

      const { Body } = await s3Client.send(new GetObjectCommand(params))

      if (Body) {
        const bodyContents = await Body.transformToString()
        const archiveData = JSON.parse(bodyContents)
        return archiveData.messages
      }

      return null
    } catch (error) {
      logger.error("Error retrieving archived chat from S3:", error)
      return null
    }
  }
}

// Export a singleton instance
export const awsService = new AwsService()
