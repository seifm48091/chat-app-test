const express = require("express");
const { authMiddleware } = require("../middleware/auth");
const { getAllUsers, findUserById, updateUser, safeUser } = require("../models/db");

const router = express.Router();
router.use(authMiddleware);

/**
 * GET /api/users/me
 * Returns current user's profile
 */
router.get("/me", (req, res) => {
  res.json({ user: safeUser(req.user) });
});

/**
 * PATCH /api/users/me
 * Body: { username?, status?, avatar? }
 */
router.patch("/me", (req, res) => {
  const { username, status, avatar } = req.body;
  const updates = {};
  if (username !== undefined) updates.username = username;
  if (status !== undefined) updates.status = status;
  if (avatar !== undefined) updates.avatar = avatar;

  const updated = updateUser(req.user.id, updates);
  res.json({ user: safeUser(updated) });
});

/**
 * GET /api/users/search?q=name
 * Search users by username (excludes self)
 */
router.get("/search", (req, res) => {
  const q = (req.query.q || "").toLowerCase().trim();
  if (!q) return res.json({ users: [] });

  const results = getAllUsers()
    .filter(
      (u) =>
        u.id !== req.user.id &&
        u.username.toLowerCase().includes(q)
    )
    .map(safeUser);

  res.json({ users: results });
});

/**
 * GET /api/users/:id
 * Get a specific user's public profile
 */
router.get("/:id", (req, res) => {
  const user = findUserById(req.params.id);
  if (!user) return res.status(404).json({ error: "User not found" });
  res.json({ user: safeUser(user) });
});

module.exports = router;
