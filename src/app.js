import express from "express"
import http from "http"
import { Server } from "socket.io"
import cors from "cors"
import path from "path"
import { config } from "./config/app.config.js"
import { SocketController } from "./controllers/socket.controller.js"
import { errorHandler } from "./middleware/error-handler.js"

/**
 * Express application setup
 */
export function createApp() {
  // Create Expr  ess app
  const app = express()

  // Apply middleware
  app.use(cors(config.cors))
  app.use(express.json())
  app.use(express.static(path.join(__dirname, "..", "public")))

  // Create HTTP server
  const server = http.createServer(app)

  // Create Socket.IO server
  const io = new Server(server, config.socketOptions)

  // Initialize socket controller
  new SocketController(io)

  // Serve the main HTML page
  app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "..", "public", "index.html"))
  })

  // Error handling middleware
  app.use(errorHandler)

  return { app, server }
}
