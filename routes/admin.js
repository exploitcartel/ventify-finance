// routes/admin.js
// Admin-only: user management, company management, and the aggregate
// analytics the admin dashboard charts are built from. Every route here
// requires the admin role.

const express = require("express");
const bcrypt = require("bcryptjs");
const db = require("../db/connection");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();

router.get("/users", requireAuth, requireRole("admin"), (req, res) => {
  const rows = db
    .prepare(
      `SELECT u.id, u.username, u.full_name, u.role, u.client_id, c.name as company_name
       FROM users u LEFT JOIN clients c ON c.id = u.client_id
       ORDER BY u.id`
    )
    .all();
  res.json(rows);
});

router.post("/users", requireAuth, requireRole("admin"), (req, res) => {
  const { username, fullName, password, role, clientId } = req.body;

  if (!username || !username.trim()) return res.status(400).json({ error: "Username is required." });
  if (!fullName || !fullName.trim()) return res.status(400).json({ error: "Full name is required." });
  if (!password || password.length < 6)
    return res.status(400).json({ error: "Password must be at least 6 characters." });
  if (!["admin", "financial_agent", "business_viewer"].includes(role))
    return res.status(400).json({ error: "Invalid role." });

  const resolvedClientId = role === "business_viewer" ? Number(clientId) || null : null;
  if (role === "business_viewer" && !resolvedClientId)
    return res.status(400).json({ error: "A company is required for a business viewer." });

  try {
    const hash = bcrypt.hashSync(password, 10);
    const info = db
      .prepare("INSERT INTO users (username, password_hash, full_name, role, client_id) VALUES (?, ?, ?, ?, ?)")
      .run(username.trim(), hash, fullName.trim(), role, resolvedClientId);
    res.json({ ok: true, id: info.lastInsertRowid });
  } catch (err) {
    if (String(err.message).includes("UNIQUE")) {
      return res.status(400).json({ error: "That username is already taken." });
    }
    res.status(500).json({ error: "Could not create the user." });
  }
});

router.delete("/users/:id", requireAuth, requireRole("admin"), (req, res) => {
  const id = Number(req.params.id);
  if (id === req.currentUser.id) {
    return res.status(400).json({ error: "You can't delete your own account." });
  }
  db.prepare("DELETE FROM users WHERE id = ?").run(id);
  res.json({ ok: true });
});

router.get("/companies", requireAuth, requireRole("admin"), (req, res) => {
  const rows = db
    .prepare(
      `SELECT c.id, c.name, c.industry, c.contact_email, c.status,
         (SELECT COUNT(*) FROM users u WHERE u.client_id = c.id) as user_count,
         COALESCE((SELECT ROUND(SUM(revenue),2) FROM financial_records f WHERE f.client_id = c.id), 0) as total_revenue
       FROM clients c ORDER BY c.name`
    )
    .all();
  res.json(rows);
});

router.post("/companies", requireAuth, requireRole("admin"), (req, res) => {
  const { name, industry, contactEmail } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: "Company name is required." });
  if (!industry || !industry.trim()) return res.status(400).json({ error: "Industry is required." });

  const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
  const email = contactEmail && contactEmail.trim() ? contactEmail.trim() : `accounts@${slug}.example.com`;

  const info = db
    .prepare("INSERT INTO clients (name, industry, contact_email, status) VALUES (?, ?, ?, 'active')")
    .run(name.trim(), industry.trim(), email);
  res.json({ ok: true, id: info.lastInsertRowid });
});

router.get("/analytics", requireAuth, requireRole("admin"), (req, res) => {
  const byIndustry = db
    .prepare("SELECT industry, COUNT(*) as count FROM clients GROUP BY industry ORDER BY count DESC")
    .all();
  const topCompanies = db
    .prepare(
      `SELECT c.name, ROUND(SUM(f.revenue),2) as revenue
       FROM financial_records f JOIN clients c ON c.id = f.client_id
       GROUP BY c.id ORDER BY revenue DESC LIMIT 5`
    )
    .all();
  const usersByRole = db.prepare("SELECT role, COUNT(*) as count FROM users GROUP BY role").all();
  res.json({ byIndustry, topCompanies, usersByRole });
});

module.exports = router;
