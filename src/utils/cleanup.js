import { awsService } from "../services/aws.service.js"
import { logger } from "./logger.js"

/**
 * Utility for cleaning up stale resources
 */
export const cleanup = {
  /**
   * Clean up stale connections
   * @param {number} maxAgeMs - Maximum age in milliseconds before a connection is considered stale
   */
  async staleConnections(maxAgeMs = 24 * 60 * 60 * 1000) {
    // Default: 24 hours
    try {
      const now = Date.now()
      const staleThreshold = now - maxAgeMs

      logger.info(`Starting cleanup of connections older than ${new Date(staleThreshold).toISOString()}`)

      const connections = await awsService.getAllConnections()
      const staleConnections = connections.filter((conn) => conn.lastActivity < staleThreshold)

      logger.info(`Found ${staleConnections.length} stale connections out of ${connections.length} total`)

      for (const conn of staleConnections) {
        logger.info(`Removing stale connection: ${conn.connectionId} (User: ${conn.userId})`)
        await awsService.deleteConnectionById(conn.connectionId)
      }

      logger.info(`Stale connection cleanup completed`)
      return staleConnections.length
    } catch (error) {
      logger.error("Error cleaning up stale connections:", error)
      return 0
    }
  },
}
