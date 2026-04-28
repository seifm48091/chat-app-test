const express = require("express");
const { authMiddleware } = require("../middleware/auth");
const {
  createDirectChat, createGroupChat, findChatById,
  getChatsForUser, getMessagesForChat, markMessagesAsRead,
  addMemberToGroup, removeMemberFromGroup,
  findUserById, safeUser,
} = require("../models/db");

const router = express.Router();
router.use(authMiddleware);

// ── Helper: enrich a chat with member profiles and last message ──────────────
function enrichChat(chat, requestingUserId) {
  const members = chat.members.map((id) => safeUser(findUserById(id))).filter(Boolean);
  const messages = getMessagesForChat(chat.id, 1);
  const lastMessage = messages[messages.length - 1] || null;

  // Unread count for requesting user
  const allMsgs = getMessagesForChat(chat.id, 200);
  const unreadCount = allMsgs.filter(
    (m) => !m.readBy.includes(requestingUserId)
  ).length;

  return { ...chat, members, lastMessage, unreadCount };
}

/**
 * GET /api/chats
 * Returns all chats the current user belongs to
 */
router.get("/", (req, res) => {
  const chats = getChatsForUser(req.user.id).map((c) =>
    enrichChat(c, req.user.id)
  );
  // Sort by last message time, most recent first
  chats.sort((a, b) => {
    const aTime = a.lastMessage ? new Date(a.lastMessage.createdAt) : new Date(a.createdAt);
    const bTime = b.lastMessage ? new Date(b.lastMessage.createdAt) : new Date(b.createdAt);
    return bTime - aTime;
  });
  res.json({ chats });
});

/**
 * POST /api/chats/direct
 * Body: { userId }  — open or get a direct chat with another user
 */
router.post("/direct", (req, res) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ error: "userId is required" });
  if (userId === req.user.id) return res.status(400).json({ error: "Cannot chat with yourself" });

  const other = findUserById(userId);
  if (!other) return res.status(404).json({ error: "User not found" });

  const chat = createDirectChat(req.user.id, userId);
  res.status(201).json({ chat: enrichChat(chat, req.user.id) });
});

/**
 * POST /api/chats/group
 * Body: { name, members: [userId, ...] }
 */
router.post("/group", (req, res) => {
  const { name, members } = req.body;
  if (!name) return res.status(400).json({ error: "Group name is required" });
  if (!Array.isArray(members) || members.length < 1) {
    return res.status(400).json({ error: "At least 1 other member is required" });
  }

  const chat = createGroupChat({ name, members, createdBy: req.user.id });
  res.status(201).json({ chat: enrichChat(chat, req.user.id) });
});

/**
 * GET /api/chats/:chatId
 * Get a single chat with messages
 */
router.get("/:chatId", (req, res) => {
  const chat = findChatById(req.params.chatId);
  if (!chat) return res.status(404).json({ error: "Chat not found" });
  if (!chat.members.includes(req.user.id)) {
    return res.status(403).json({ error: "Not a member of this chat" });
  }

  const limit = parseInt(req.query.limit) || 50;
  const before = req.query.before || null;
  const messages = getMessagesForChat(chat.id, limit, before);

  // Mark all as read
  markMessagesAsRead(chat.id, req.user.id);

  res.json({ chat: enrichChat(chat, req.user.id), messages });
});

/**
 * POST /api/chats/:chatId/members
 * Body: { userId }  — add a member to a group
 */
router.post("/:chatId/members", (req, res) => {
  const chat = findChatById(req.params.chatId);
  if (!chat) return res.status(404).json({ error: "Chat not found" });
  if (chat.type !== "group") return res.status(400).json({ error: "Not a group chat" });
  if (chat.createdBy !== req.user.id) return res.status(403).json({ error: "Only the group creator can add members" });

  const { userId } = req.body;
  if (!userId) return res.status(400).json({ error: "userId is required" });

  const updated = addMemberToGroup(chat.id, userId);
  res.json({ chat: enrichChat(updated, req.user.id) });
});

/**
 * DELETE /api/chats/:chatId/members/:userId
 * Remove a member from a group (creator only, or self-leave)
 */
router.delete("/:chatId/members/:userId", (req, res) => {
  const chat = findChatById(req.params.chatId);
  if (!chat) return res.status(404).json({ error: "Chat not found" });
  if (chat.type !== "group") return res.status(400).json({ error: "Not a group chat" });

  const { userId } = req.params;
  const isSelf = userId === req.user.id;
  const isCreator = chat.createdBy === req.user.id;

  if (!isSelf && !isCreator) {
    return res.status(403).json({ error: "Only the group creator can remove members" });
  }

  const updated = removeMemberFromGroup(chat.id, userId);
  res.json({ chat: enrichChat(updated, req.user.id) });
});

module.exports = router;
