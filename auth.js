const express = require("express");
const bcrypt = require("bcryptjs");
const {
  createUser, findUserByPhone, findUserByUsername, safeUser,
} = require("../models/db");
const { generateToken } = require("../middleware/auth");

const router = express.Router();

/**
 * POST /api/auth/register
 * Body: { username, phone, password }
 */
router.post("/register", async (req, res) => {
  try {
    const { username, phone, password } = req.body;

    if (!username || !phone || !password) {
      return res.status(400).json({ error: "username, phone and password are required" });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters" });
    }
    if (findUserByPhone(phone)) {
      return res.status(409).json({ error: "Phone number already registered" });
    }
    if (findUserByUsername(username)) {
      return res.status(409).json({ error: "Username already taken" });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = createUser({ username, phone, passwordHash });
    const token = generateToken(user.id);

    res.status(201).json({ token, user: safeUser(user) });
  } catch (err) {
    console.error("Register error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

/**
 * POST /api/auth/login
 * Body: { phone, password }
 */
router.post("/login", async (req, res) => {
  try {
    const { phone, password } = req.body;

    if (!phone || !password) {
      return res.status(400).json({ error: "phone and password are required" });
    }

    const user = findUserByPhone(phone);
    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const token = generateToken(user.id);
    res.json({ token, user: safeUser(user) });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
