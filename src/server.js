import express from "express"
import http from "http"
import path from "path"
import { fileURLToPath } from "url"
import { Server } from "socket.io"
import cors from "cors"
import { SocketController } from "./controllers/socket.controller.js"
import { logger } from "./utils/logger.js"

// Get the directory name using ES modules approach
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Create Express app
const app = express()

// Apply middleware
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "*",
    methods: ["GET", "POST"],
  }),
)
app.use(express.json())

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, "public")))

// Create HTTP server
const server = http.createServer(app)

// Create Socket.IO server
const io = new Server(server, {
  cors: {
    origin: process.env.CORS_ORIGIN || "*",
    methods: ["GET", "POST"],
  },
})

// Initialize socket controller
new SocketController(io)

// Serve the main HTML page
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"))
})

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error("Unhandled error:", err)
  res.status(500).json({ error: "Internal server error" })
})

// Start the server
const PORT = process.env.PORT || 3000
server.listen(PORT, () => {
  logger.info(`Server running on http://localhost:${PORT}`)
  logger.info(`Environment: ${process.env.NODE_ENV || "development"}`)
  logger.info(`CORS origin: ${process.env.CORS_ORIGIN || "*"}`)
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
