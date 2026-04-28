const jwt = require("jsonwebtoken");
const {
  findUserById, updateUser, findChatById,
  createMessage, markMessagesAsRead, safeUser,
} = require("../models/db");

/**
 * Attaches all Socket.IO real-time logic to the server.
 *
 * Events emitted by the CLIENT:
 *   authenticate      { token }
 *   join_chat         { chatId }
 *   leave_chat        { chatId }
 *   send_message      { chatId, text, type?, fileUrl? }
 *   typing_start      { chatId }
 *   typing_stop       { chatId }
 *   mark_read         { chatId }
 *   call_offer        { chatId, targetUserId, offer, callType }
 *   call_answer       { chatId, targetUserId, answer }
 *   call_ice          { targetUserId, candidate }
 *   call_end          { targetUserId }
 *
 * Events emitted by the SERVER:
 *   authenticated     { user }
 *   error             { message }
 *   new_message       { message, chatId }
 *   user_online       { userId }
 *   user_offline      { userId, lastSeen }
 *   typing            { chatId, userId, username }
 *   stop_typing       { chatId, userId }
 *   messages_read     { chatId, userId }
 *   call_incoming     { chatId, fromUserId, offer, callType }
 *   call_answered     { answer }
 *   call_ice          { candidate }
 *   call_ended        {}
 */
function initSocket(io) {
  // ── Auth middleware for Socket.IO ──────────────────────────────────────────
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error("No token provided"));

    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      const user = findUserById(payload.userId);
      if (!user) return next(new Error("User not found"));
      socket.user = user;
      next();
    } catch {
      next(new Error("Invalid token"));
    }
  });

  io.on("connection", (socket) => {
    const user = socket.user;
    console.log(`[Socket] Connected: ${user.username} (${socket.id})`);

    // Track socket id and mark online
    updateUser(user.id, { socketId: socket.id, lastSeen: new Date() });
    socket.broadcast.emit("user_online", { userId: user.id });
    socket.emit("authenticated", { user: safeUser(user) });

    // ── Join a chat room ───────────────────────────────────────────────────
    socket.on("join_chat", ({ chatId }) => {
      const chat = findChatById(chatId);
      if (!chat || !chat.members.includes(user.id)) {
        return socket.emit("error", { message: "Chat not found or access denied" });
      }
      socket.join(chatId);
      console.log(`[Socket] ${user.username} joined room ${chatId}`);
    });

    // ── Leave a chat room ──────────────────────────────────────────────────
    socket.on("leave_chat", ({ chatId }) => {
      socket.leave(chatId);
    });

    // ── Send message ───────────────────────────────────────────────────────
    socket.on("send_message", ({ chatId, text, type = "text", fileUrl = null }) => {
      const chat = findChatById(chatId);
      if (!chat || !chat.members.includes(user.id)) {
        return socket.emit("error", { message: "Chat not found or access denied" });
      }
      if (!text && !fileUrl) {
        return socket.emit("error", { message: "Message must have text or a file" });
      }

      const message = createMessage({
        chatId,
        senderId: user.id,
        text: text || "",
        type,
        fileUrl,
      });

      const payload = {
        ...message,
        sender: safeUser(findUserById(user.id)),
      };

      // Broadcast to everyone in the room (including sender for confirmation)
      io.to(chatId).emit("new_message", { chatId, message: payload });
      console.log(`[Message] ${user.username} → ${chatId}: ${text}`);
    });

    // ── Typing indicators ──────────────────────────────────────────────────
    socket.on("typing_start", ({ chatId }) => {
      socket.to(chatId).emit("typing", {
        chatId,
        userId: user.id,
        username: user.username,
      });
    });

    socket.on("typing_stop", ({ chatId }) => {
      socket.to(chatId).emit("stop_typing", { chatId, userId: user.id });
    });

    // ── Read receipts ──────────────────────────────────────────────────────
    socket.on("mark_read", ({ chatId }) => {
      const chat = findChatById(chatId);
      if (!chat || !chat.members.includes(user.id)) return;
      markMessagesAsRead(chatId, user.id);
      socket.to(chatId).emit("messages_read", { chatId, userId: user.id });
    });

    // ── WebRTC signalling (voice/video calls) ──────────────────────────────
    socket.on("call_offer", ({ chatId, targetUserId, offer, callType }) => {
      const targetUser = findUserById(targetUserId);
      if (!targetUser?.socketId) {
        return socket.emit("error", { message: "User is not online" });
      }
      io.to(targetUser.socketId).emit("call_incoming", {
        chatId,
        fromUserId: user.id,
        fromUsername: user.username,
        offer,
        callType, // 'audio' | 'video'
      });
    });

    socket.on("call_answer", ({ targetUserId, answer }) => {
      const targetUser = findUserById(targetUserId);
      if (targetUser?.socketId) {
        io.to(targetUser.socketId).emit("call_answered", { answer });
      }
    });

    socket.on("call_ice", ({ targetUserId, candidate }) => {
      const targetUser = findUserById(targetUserId);
      if (targetUser?.socketId) {
        io.to(targetUser.socketId).emit("call_ice", { candidate });
      }
    });

    socket.on("call_end", ({ targetUserId }) => {
      const targetUser = findUserById(targetUserId);
      if (targetUser?.socketId) {
        io.to(targetUser.socketId).emit("call_ended", {});
      }
    });

    // ── Disconnect ─────────────────────────────────────────────────────────
    socket.on("disconnect", () => {
      const lastSeen = new Date();
      updateUser(user.id, { socketId: null, lastSeen });
      socket.broadcast.emit("user_offline", { userId: user.id, lastSeen });
      console.log(`[Socket] Disconnected: ${user.username}`);
    });
  });
}

module.exports = initSocket;
