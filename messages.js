const express = require("express");
const { authMiddleware } = require("../middleware/auth");
const {
  findChatById, getMessagesForChat, markMessagesAsRead, findMessageById,
} = require("../models/db");

const router = express.Router();
router.use(authMiddleware);

/**
 * GET /api/messages/:chatId
 * Query params: limit (default 50), before (ISO date for pagination)
 */
router.get("/:chatId", (req, res) => {
  const chat = findChatById(req.params.chatId);
  if (!chat) return res.status(404).json({ error: "Chat not found" });
  if (!chat.members.includes(req.user.id)) {
    return res.status(403).json({ error: "Not a member of this chat" });
  }

  const limit = Math.min(parseInt(req.query.limit) || 50, 200);
  const before = req.query.before || null;

  const messages = getMessagesForChat(chat.id, limit, before);
  markMessagesAsRead(chat.id, req.user.id);

  res.json({ messages, hasMore: messages.length === limit });
});

module.exports = router;
