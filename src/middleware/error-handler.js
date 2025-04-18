import { logger } from "../utils/logger.js"

/**
 * Global error handling middleware
 */
export const errorHandler = (err, req, res, next) => {
  logger.error("Unhandled error:", err)

  res.status(500).json({
    error: "Internal server error",
    message: process.env.NODE_ENV === "development" ? err.message : undefined,
  })
}
