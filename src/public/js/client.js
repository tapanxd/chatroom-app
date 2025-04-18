// JavaScript client for the secure channel application

// Socket.IO is loaded from CDN in the HTML file
const socket = io()

// Current user info
let currentUser = {
  userId: null,
  username: null,
}

// Format timestamp for messages
function formatTimestamp(timestamp) {
  const date = new Date(timestamp)
  const hours = date.getHours().toString().padStart(2, "0")
  const minutes = date.getMinutes().toString().padStart(2, "0")
  const seconds = date.getSeconds().toString().padStart(2, "0")
  return `[${hours}:${minutes}:${seconds}]`
}

// Custom cursor positioning
function setupCustomCursor() {
  // Setup for username input
  const usernameInput = document.getElementById("username")
  const usernameCursor = document.getElementById("usernameCursor")

  if (usernameInput && usernameCursor) {
    // Position cursor initially
    positionCursor(usernameInput, usernameCursor)

    // Update cursor position on input
    usernameInput.addEventListener("input", () => {
      positionCursor(usernameInput, usernameCursor)
    })

    // Update cursor position on click
    usernameInput.addEventListener("click", () => {
      positionCursor(usernameInput, usernameCursor)
    })

    // Focus handler
    usernameInput.addEventListener("focus", () => {
      usernameCursor.style.display = "inline-block"
    })

    // Blur handler
    usernameInput.addEventListener("blur", () => {
      usernameCursor.style.display = "none"
    })
  }

  // Setup for message input
  const messageInput = document.getElementById("messageInput")
  const messageCursor = document.getElementById("messageCursor")

  if (messageInput && messageCursor) {
    // Position cursor initially
    positionCursor(messageInput, messageCursor)

    // Update cursor position on input
    messageInput.addEventListener("input", () => {
      positionCursor(messageInput, messageCursor)
    })

    // Update cursor position on click
    messageInput.addEventListener("click", () => {
      positionCursor(messageInput, messageCursor)
    })

    // Focus handler
    messageInput.addEventListener("focus", () => {
      messageCursor.style.display = "inline-block"
    })

    // Blur handler
    messageInput.addEventListener("blur", () => {
      messageCursor.style.display = "none"
    })
  }

  // Setup for terminate reason input
  const terminateReasonInput = document.getElementById("terminateReason")
  const terminateReasonCursor = document.getElementById("terminateReasonCursor")

  if (terminateReasonInput && terminateReasonCursor) {
    // Position cursor initially
    positionCursor(terminateReasonInput, terminateReasonCursor)

    // Update cursor position on input
    terminateReasonInput.addEventListener("input", () => {
      positionCursor(terminateReasonInput, terminateReasonCursor)
    })

    // Update cursor position on click
    terminateReasonInput.addEventListener("click", () => {
      positionCursor(terminateReasonInput, terminateReasonCursor)
    })

    // Focus handler
    terminateReasonInput.addEventListener("focus", () => {
      terminateReasonCursor.style.display = "inline-block"
    })

    // Blur handler
    terminateReasonInput.addEventListener("blur", () => {
      terminateReasonCursor.style.display = "none"
    })
  }
}

// Position the cursor at the caret position
function positionCursor(input, cursor) {
  const caretPosition = getCaretPosition(input)

  // Create a temporary span to measure text width
  const tempSpan = document.createElement("span")
  tempSpan.style.font = window.getComputedStyle(input).font
  tempSpan.style.position = "absolute"
  tempSpan.style.visibility = "hidden"
  tempSpan.textContent = input.value.substring(0, caretPosition)
  document.body.appendChild(tempSpan)

  // Calculate position
  const textWidth = tempSpan.getBoundingClientRect().width
  document.body.removeChild(tempSpan)

  // Position the cursor
  cursor.style.left = `${input.offsetLeft + textWidth}px`
  cursor.style.top = `${input.offsetTop}px`
}

// Get caret position in input
function getCaretPosition(input) {
  return input.selectionStart || 0
}

// Initialize cursor on page load
document.addEventListener("DOMContentLoaded", () => {
  setupCustomCursor()

  // Focus username input on load
  const usernameInput = document.getElementById("username")
  if (usernameInput) {
    usernameInput.focus()
  }
})

// Register with the server and hide registration form
function registerAndHide() {
  const usernameInput = document.getElementById("username")
  const username = usernameInput.value.trim()

  if (username) {
    socket.emit("register", { username })
    const registrationDiv = document.getElementById("registration")
    const statusControlsDiv = document.getElementById("statusControls")
    const chatControlsDiv = document.getElementById("chatControls")
    const messageInput = document.getElementById("messageInput")
    const promptUsername = document.getElementById("promptUsername")

    if (registrationDiv) {
      registrationDiv.innerHTML = `
        <div class="sidebar-title">CURRENT IDENTITY:</div>
        <div class="user-item">
          <div class="user-status status-online"></div>
          <div class="user-name current-user">${username}</div>
        </div>
      `
    }

    if (statusControlsDiv) {
      statusControlsDiv.style.display = "block"
    }

    if (chatControlsDiv) {
      chatControlsDiv.style.display = "flex"
    }

    // Enable chat input after registration
    if (messageInput) {
      messageInput.disabled = false
      messageInput.focus()
    }

    // Update prompt with username
    if (promptUsername) {
      promptUsername.textContent = `${username}@SECURE:~$`
    }
  }
}

// After registration is confirmed
socket.on("registered", (userData) => {
  currentUser = userData
  console.log(`Registered as: ${userData.username} (${userData.userId})`)

  // Request browser notification permission
  if ("Notification" in window && Notification.permission !== "granted" && Notification.permission !== "denied") {
    Notification.requestPermission()
  }

  // Start activity tracking
  startActivityTracking()

  // Add a system message
  const chatMessagesElement = document.getElementById("chatMessages")
  if (chatMessagesElement) {
    const timestamp = formatTimestamp(Date.now())
    const messageElement = document.createElement("div")
    messageElement.className = "message"
    messageElement.innerHTML = `
      <span class="message-timestamp">${timestamp}</span>
      <span class="message-username">SYSTEM:</span>
      <span class="message-content">${userData.username} has joined the channel</span>
    `
    chatMessagesElement.appendChild(messageElement)
    scrollToBottom()
  }
})

// Change status manually
function changeStatus(newStatus) {
  if (!currentUser.userId) return

  socket.emit("status_change", {
    userId: currentUser.userId,
    status: newStatus,
  })
}

// Send a chat message
function sendMessage() {
  const messageInput = document.getElementById("messageInput")
  const text = messageInput.value.trim()

  if (text && currentUser.userId) {
    socket.emit("send_message", { text })
    messageInput.value = ""

    // Reposition cursor after clearing input
    const messageCursor = document.getElementById("messageCursor")
    if (messageCursor && messageInput) {
      positionCursor(messageInput, messageCursor)
    }
  }
}

// Handle Enter key press in message input
function handleKeyPress(event) {
  if (event.key === "Enter") {
    sendMessage()
  }
}

// Receive chat messages
socket.on("chat_message", (message) => {
  addMessageToUI(message)
})

// Receive chat history
socket.on("chat_history", (messages) => {
  const chatMessagesElement = document.getElementById("chatMessages")
  if (!chatMessagesElement) return

  // Clear existing messages
  chatMessagesElement.innerHTML = `
    <div class="system-message">
      --- SECURE CONNECTION ESTABLISHED ---
    </div>
    <div class="system-message">
      --- WELCOME TO OPERATION SKYFALL ---
    </div>
  `

  // Add history messages
  messages.forEach((message) => {
    addMessageToUI(message)
  })

  // Scroll to bottom
  scrollToBottom()
})

// Handle chat termination
socket.on("chat_terminated", (termination) => {
  const chatMessagesElement = document.getElementById("chatMessages")
  if (!chatMessagesElement) return

  // Add termination message
  const timestamp = formatTimestamp(termination.timestamp)
  const terminationElement = document.createElement("div")
  terminationElement.className = "system-message"
  terminationElement.innerHTML = `
    --- CHAT TERMINATED BY ${termination.by.toUpperCase()} ---
    ${termination.reason ? `--- REASON: ${termination.reason} ---` : ""}
    --- NEW SECURE SESSION INITIATED ---
  `

  // Clear chat except for system messages
  chatMessagesElement.innerHTML = `
    <div class="system-message">
      --- SECURE CONNECTION ESTABLISHED ---
    </div>
    <div class="system-message">
      --- WELCOME TO OPERATION SKYFALL ---
    </div>
    ${terminationElement.outerHTML}
  `

  scrollToBottom()

  // Close modal if open
  closeTerminateModal()
})

// Add a message to the UI
function addMessageToUI(message) {
  const chatMessagesElement = document.getElementById("chatMessages")
  if (!chatMessagesElement) return

  const isCurrentUser = message.userId === currentUser.userId
  const isSystemMessage = message.userId === "system"
  const timestamp = formatTimestamp(message.timestamp)

  const messageElement = document.createElement("div")
  messageElement.className = "message"

  if (isSystemMessage) {
    // Format system message
    const systemText = message.text
      .replace("has joined the chat", "has joined the channel")
      .replace("has left the chat", "connection terminated")

    messageElement.innerHTML = `
      <span class="message-timestamp">${timestamp}</span>
      <span class="message-username">SYSTEM:</span>
      <span class="message-system">${escapeHtml(systemText)}</span>
    `
  } else if (message.text.startsWith("/")) {
    // Handle command-like messages with special formatting
    messageElement.innerHTML = `
      <span class="message-timestamp">${timestamp}</span>
      <span class="message-username">${escapeHtml(message.username)}:</span>
      <span class="message-highlight">${escapeHtml(message.text)}</span>
    `
  } else {
    // Regular message
    messageElement.innerHTML = `
      <span class="message-timestamp">${timestamp}</span>
      <span class="message-username">${escapeHtml(message.username)}:</span>
      <span class="message-content">${escapeHtml(message.text)}</span>
    `
  }

  chatMessagesElement.appendChild(messageElement)
  scrollToBottom()
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
  const div = document.createElement("div")
  div.textContent = text
  return div.innerHTML
}

// Scroll chat to bottom
function scrollToBottom() {
  const chatMessagesElement = document.getElementById("chatMessages")
  if (chatMessagesElement) {
    chatMessagesElement.scrollTop = chatMessagesElement.scrollHeight
  }
}

// Receive status updates
socket.on("status_update", (users) => {
  console.log("User statuses updated:", users)

  // Update header with user count
  const headerStatus = document.getElementById("headerStatus")
  if (headerStatus) {
    headerStatus.textContent = `USERS ONLINE: ${users.filter((u) => u.status === "online").length}`
  }

  // Update UI with user list and statuses
  updateUserStatusUI(users)
})

// Handle errors
socket.on("error", (error) => {
  console.error("Socket error:", error.message)

  const chatMessagesElement = document.getElementById("chatMessages")
  if (chatMessagesElement) {
    const timestamp = formatTimestamp(Date.now())
    const errorElement = document.createElement("div")
    errorElement.className = "message"
    errorElement.innerHTML = `
      <span class="message-timestamp">${timestamp}</span>
      <span class="message-username">ERROR:</span>
      <span style="color: #ff0000;">${escapeHtml(error.message)}</span>
    `
    chatMessagesElement.appendChild(errorElement)
    scrollToBottom()
  }
})

// Track user activity to reset AWAY status
function startActivityTracking() {
  // Send activity notification on mouse movement or keyboard input
  document.addEventListener("mousemove", reportActivity)
  document.addEventListener("keydown", reportActivity)

  // Debounce to avoid excessive messages
  let activityTimeout = null

  function reportActivity() {
    if (activityTimeout) {
      window.clearTimeout(activityTimeout)
    }

    activityTimeout = window.setTimeout(() => {
      if (currentUser.userId) {
        socket.emit("user_activity", { userId: currentUser.userId })
      }
    }, 1000)
  }
}

// Update UI when user statuses change
function updateUserStatusUI(users) {
  const userListElement = document.getElementById("userList")
  if (!userListElement) return

  userListElement.innerHTML = ""

  if (users.length === 0) {
    userListElement.innerHTML = `
      <div class="user-item">
        <div class="user-status status-ghost"></div>
        <div class="user-name">NO_USERS_CONNECTED</div>
      </div>
    `
    return
  }

  // Sort users: online first, then by username
  users.sort((a, b) => {
    // First by status (online first)
    if (a.status === "online" && b.status !== "online") return -1
    if (a.status !== "online" && b.status === "online") return 1

    // Then alphabetically by username
    return a.username.localeCompare(b.username)
  })

  users.forEach((user) => {
    const isCurrentUser = user.id === currentUser.userId

    // Map status to CSS class
    let statusClass = "status-ghost" // default
    if (user.status === "online") statusClass = "status-online"
    else if (user.status === "away") statusClass = "status-away"
    else if (user.status === "do not disturb") statusClass = "status-dark"

    // Create user item
    const userElement = document.createElement("div")
    userElement.className = "user-item"
    userElement.innerHTML = `
      <div class="user-status ${statusClass}"></div>
      <div class="user-name ${isCurrentUser ? "current-user" : ""}">${user.username}${isCurrentUser ? " (you)" : ""}</div>
    `

    userListElement.appendChild(userElement)
  })
}

// Open terminate chat modal
function openTerminateModal() {
  const modal = document.getElementById("terminateModal")
  if (modal) {
    modal.style.display = "block"

    // Focus the reason input
    const reasonInput = document.getElementById("terminateReason")
    if (reasonInput) {
      reasonInput.focus()
    }
  }
}

// Close terminate chat modal
function closeTerminateModal() {
  const modal = document.getElementById("terminateModal")
  if (modal) {
    modal.style.display = "none"

    // Clear the reason input
    const reasonInput = document.getElementById("terminateReason")
    if (reasonInput) {
      reasonInput.value = ""
    }
  }
}

// Terminate the current chat
function terminateChat() {
  if (!currentUser.userId) return

  const reasonInput = document.getElementById("terminateReason")
  const reason = reasonInput ? reasonInput.value.trim() : ""

  socket.emit("terminate_chat", { reason })
}

// Make functions available to the global scope for HTML onclick handlers
window.registerAndHide = registerAndHide
window.changeStatus = changeStatus
window.sendMessage = sendMessage
window.handleKeyPress = handleKeyPress
window.positionCursor = positionCursor
window.getCaretPosition = getCaretPosition
window.openTerminateModal = openTerminateModal
window.closeTerminateModal = closeTerminateModal
window.terminateChat = terminateChat

// Handle in-app notifications
socket.on("notification", (notification) => {
  console.log("Received notification:", notification)

  if (notification.type === "status_change_notification") {
    // Create a notification message
    const timestamp = formatTimestamp(notification.timestamp)
    const isAutomatic = notification.automatic ? " automatically" : ""
    const notificationText = `${notification.username}'s status${isAutomatic} changed from ${notification.oldStatus} to ${notification.newStatus}`

    // Add notification to chat
    const chatMessagesElement = document.getElementById("chatMessages")
    if (chatMessagesElement) {
      const notificationElement = document.createElement("div")
      notificationElement.className = "status-change"
      notificationElement.innerHTML = `
        <span class="message-timestamp">${timestamp}</span>
        <span class="message-content">${notificationText}</span>
      `
      chatMessagesElement.appendChild(notificationElement)
      scrollToBottom()
    }

    // Optional: Show a browser notification if the page is not active
    if (document.hidden && "Notification" in window && Notification.permission === "granted") {
      new Notification("Status Change", {
        body: notificationText,
        icon: "/favicon.ico",
      })
    }
  }
})
