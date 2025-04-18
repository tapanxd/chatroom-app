import { createApp } from "./app.js"
import { logger } from "./utils/logger.js"

// Create the app and server
const { app, server } = createApp()

// Start the server
const PORT = process.env.PORT || 3000
server.listen(PORT, () => {
  logger.info(`Server running on http://localhost:${PORT}`)
})

// Handle uncaught exceptions
process.on("uncaughtException", (error) => {
  logger.error("Uncaught Exception:", error)
  process.exit(1)
})

// Handle unhandled promise rejections
process.on("unhandledRejection", (reason, promise) => {
  logger.error("Unhandled Rejection at:", promise, "reason:", reason)
})

// Handle termination signals
process.on("SIGTERM", () => {
  logger.info("SIGTERM received, shutting down gracefully")
  server.close(() => {
    logger.info("Server closed")
    process.exit(0)
  })
})
