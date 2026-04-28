require("dotenv").config();
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const authRoutes = require("./routes/auth");
const userRoutes = require("./routes/users");
const chatRoutes = require("./routes/chats");
const messageRoutes = require("./routes/messages");
const initSocket = require("./socket");

const app = express();
const server = http.createServer(app);

// ── Socket.IO setup ──────────────────────────────────────────────────────────
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    methods: ["GET", "POST"],
  },
});

// ── Express middleware ───────────────────────────────────────────────────────
app.use(cors({ origin: process.env.CLIENT_URL || "http://localhost:3000" }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── REST routes ──────────────────────────────────────────────────────────────
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/chats", chatRoutes);
app.use("/api/messages", messageRoutes);

// Health check
app.get("/health", (_req, res) => res.json({ status: "ok", time: new Date() }));

// 404 fallback
app.use((_req, res) => res.status(404).json({ error: "Route not found" }));

// Global error handler
app.use((err, _req, res, _next) => {
  console.error("[Error]", err);
  res.status(500).json({ error: "Internal server error" });
});

// ── Socket.IO events ─────────────────────────────────────────────────────────
initSocket(io);

// ── Start ────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════╗
║   ChatApp Backend running on :${PORT}   ║
║   REST  → http://localhost:${PORT}/api ║
║   WS    → ws://localhost:${PORT}        ║
╚══════════════════════════════════════╝
  `);
});
