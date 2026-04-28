// In-memory store — swap each "db.*" with real DB calls (MongoDB/Postgres) when ready
const { v4: uuidv4 } = require("uuid");

const db = {
  users: [],       // { id, username, phone, passwordHash, avatar, status, lastSeen, socketId }
  chats: [],       // { id, type: 'direct'|'group', name, members: [userId], createdAt, createdBy }
  messages: [],    // { id, chatId, senderId, text, type, fileUrl, readBy: [userId], createdAt }
};

// ─── Users ───────────────────────────────────────────────────────────────────

function createUser({ username, phone, passwordHash }) {
  const user = {
    id: uuidv4(),
    username,
    phone,
    passwordHash,
    avatar: username[0].toUpperCase(),
    status: "Hey there! I am using ChatApp.",
    lastSeen: new Date(),
    socketId: null,
  };
  db.users.push(user);
  return user;
}

function findUserById(id) {
  return db.users.find((u) => u.id === id) || null;
}

function findUserByPhone(phone) {
  return db.users.find((u) => u.phone === phone) || null;
}

function findUserByUsername(username) {
  return db.users.find((u) => u.username === username) || null;
}

function updateUser(id, updates) {
  const user = findUserById(id);
  if (!user) return null;
  Object.assign(user, updates);
  return user;
}

function getAllUsers() {
  return db.users;
}

// ─── Chats ───────────────────────────────────────────────────────────────────

function createDirectChat(userAId, userBId) {
  // Return existing chat if it exists
  const existing = db.chats.find(
    (c) =>
      c.type === "direct" &&
      c.members.includes(userAId) &&
      c.members.includes(userBId)
  );
  if (existing) return existing;

  const chat = {
    id: uuidv4(),
    type: "direct",
    name: null,
    members: [userAId, userBId],
    createdAt: new Date(),
    createdBy: userAId,
  };
  db.chats.push(chat);
  return chat;
}

function createGroupChat({ name, members, createdBy }) {
  const chat = {
    id: uuidv4(),
    type: "group",
    name,
    members: [...new Set([createdBy, ...members])],
    createdAt: new Date(),
    createdBy,
  };
  db.chats.push(chat);
  return chat;
}

function findChatById(id) {
  return db.chats.find((c) => c.id === id) || null;
}

function getChatsForUser(userId) {
  return db.chats.filter((c) => c.members.includes(userId));
}

function addMemberToGroup(chatId, userId) {
  const chat = findChatById(chatId);
  if (!chat || chat.type !== "group") return null;
  if (!chat.members.includes(userId)) chat.members.push(userId);
  return chat;
}

function removeMemberFromGroup(chatId, userId) {
  const chat = findChatById(chatId);
  if (!chat || chat.type !== "group") return null;
  chat.members = chat.members.filter((m) => m !== userId);
  return chat;
}

// ─── Messages ────────────────────────────────────────────────────────────────

function createMessage({ chatId, senderId, text, type = "text", fileUrl = null }) {
  const message = {
    id: uuidv4(),
    chatId,
    senderId,
    text,
    type,     // 'text' | 'image' | 'file' | 'audio'
    fileUrl,
    readBy: [senderId],
    createdAt: new Date(),
  };
  db.messages.push(message);
  return message;
}

function getMessagesForChat(chatId, limit = 50, before = null) {
  let msgs = db.messages.filter((m) => m.chatId === chatId);
  if (before) {
    msgs = msgs.filter((m) => new Date(m.createdAt) < new Date(before));
  }
  return msgs.slice(-limit);
}

function markMessagesAsRead(chatId, userId) {
  db.messages
    .filter((m) => m.chatId === chatId && !m.readBy.includes(userId))
    .forEach((m) => m.readBy.push(userId));
}

function findMessageById(id) {
  return db.messages.find((m) => m.id === id) || null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function safeUser(user) {
  if (!user) return null;
  const { passwordHash, socketId, ...safe } = user;
  return safe;
}

module.exports = {
  createUser, findUserById, findUserByPhone, findUserByUsername,
  updateUser, getAllUsers, safeUser,
  createDirectChat, createGroupChat, findChatById,
  getChatsForUser, addMemberToGroup, removeMemberFromGroup,
  createMessage, getMessagesForChat, markMessagesAsRead, findMessageById,
};
