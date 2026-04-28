/**
 * chatapp-client.js
 * Drop this file into your frontend project.
 * Requires: socket.io-client  (npm install socket.io-client)
 *
 * Usage:
 *   import ChatClient from './chatapp-client';
 *   const client = new ChatClient('http://localhost:3001');
 *   await client.login('0501234567', 'mypassword');
 *   client.joinChat('chat-id-here');
 *   client.sendMessage('chat-id-here', 'Hello!');
 */

const BASE_URL = "http://localhost:3001"; // change to your server URL

class ChatClient {
  constructor(baseUrl = BASE_URL) {
    this.baseUrl = baseUrl;
    this.token = localStorage.getItem("chatapp_token") || null;
    this.socket = null;
    this.handlers = {};
  }

  // ── Auth helpers ─────────────────────────────────────────────────────────

  async register(username, phone, password) {
    const res = await this._post("/api/auth/register", { username, phone, password });
    this.token = res.token;
    localStorage.setItem("chatapp_token", this.token);
    this._connectSocket();
    return res.user;
  }

  async login(phone, password) {
    const res = await this._post("/api/auth/login", { phone, password });
    this.token = res.token;
    localStorage.setItem("chatapp_token", this.token);
    this._connectSocket();
    return res.user;
  }

  logout() {
    this.token = null;
    localStorage.removeItem("chatapp_token");
    if (this.socket) { this.socket.disconnect(); this.socket = null; }
  }

  // ── REST API calls ───────────────────────────────────────────────────────

  getMe()                              { return this._get("/api/users/me"); }
  searchUsers(q)                       { return this._get(`/api/users/search?q=${encodeURIComponent(q)}`); }
  getChats()                           { return this._get("/api/chats"); }
  getChat(chatId)                      { return this._get(`/api/chats/${chatId}`); }
  openDirectChat(userId)               { return this._post("/api/chats/direct", { userId }); }
  createGroupChat(name, members)       { return this._post("/api/chats/group", { name, members }); }
  getMessages(chatId, limit = 50, before = null) {
    let url = `/api/messages/${chatId}?limit=${limit}`;
    if (before) url += `&before=${before}`;
    return this._get(url);
  }

  // ── Socket.IO real-time ──────────────────────────────────────────────────

  _connectSocket() {
    if (this.socket?.connected) return;
    // eslint-disable-next-line no-undef
    this.socket = io(this.baseUrl, { auth: { token: this.token } });

    this.socket.on("connect",       ()  => console.log("[WS] Connected"));
    this.socket.on("disconnect",    ()  => console.log("[WS] Disconnected"));
    this.socket.on("error",         (e) => console.error("[WS] Error:", e));
    this.socket.on("authenticated", (d) => this._emit("authenticated", d));
    this.socket.on("new_message",   (d) => this._emit("new_message", d));
    this.socket.on("typing",        (d) => this._emit("typing", d));
    this.socket.on("stop_typing",   (d) => this._emit("stop_typing", d));
    this.socket.on("messages_read", (d) => this._emit("messages_read", d));
    this.socket.on("user_online",   (d) => this._emit("user_online", d));
    this.socket.on("user_offline",  (d) => this._emit("user_offline", d));
    this.socket.on("call_incoming", (d) => this._emit("call_incoming", d));
    this.socket.on("call_answered", (d) => this._emit("call_answered", d));
    this.socket.on("call_ice",      (d) => this._emit("call_ice", d));
    this.socket.on("call_ended",    (d) => this._emit("call_ended", d));
  }

  joinChat(chatId)                     { this.socket?.emit("join_chat", { chatId }); }
  leaveChat(chatId)                    { this.socket?.emit("leave_chat", { chatId }); }
  sendMessage(chatId, text, type = "text", fileUrl = null) {
    this.socket?.emit("send_message", { chatId, text, type, fileUrl });
  }
  startTyping(chatId)                  { this.socket?.emit("typing_start", { chatId }); }
  stopTyping(chatId)                   { this.socket?.emit("typing_stop", { chatId }); }
  markRead(chatId)                     { this.socket?.emit("mark_read", { chatId }); }

  // WebRTC calls
  callUser(chatId, targetUserId, offer, callType = "video") {
    this.socket?.emit("call_offer", { chatId, targetUserId, offer, callType });
  }
  answerCall(targetUserId, answer)     { this.socket?.emit("call_answer", { targetUserId, answer }); }
  sendIceCandidate(targetUserId, candidate) { this.socket?.emit("call_ice", { targetUserId, candidate }); }
  endCall(targetUserId)                { this.socket?.emit("call_end", { targetUserId }); }

  // ── Event system ─────────────────────────────────────────────────────────

  on(event, handler) {
    if (!this.handlers[event]) this.handlers[event] = [];
    this.handlers[event].push(handler);
    return () => { this.handlers[event] = this.handlers[event].filter((h) => h !== handler); };
  }

  _emit(event, data) {
    (this.handlers[event] || []).forEach((h) => h(data));
  }

  // ── Internals ─────────────────────────────────────────────────────────────

  async _get(path) {
    const res = await fetch(this.baseUrl + path, {
      headers: { Authorization: `Bearer ${this.token}` },
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Request failed");
    return json;
  }

  async _post(path, body) {
    const res = await fetch(this.baseUrl + path, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
      },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Request failed");
    return json;
  }
}

// Export for ESM / CJS / browser global
if (typeof module !== "undefined") module.exports = ChatClient;
else window.ChatClient = ChatClient;
