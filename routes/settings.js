// routes/settings.js
// Sysadmin-only: configure the AI provider + API key at runtime instead of
// through a .env file, so a fresh deploy needs no shell access to go live -
// log in as admin, paste the key once, and the lab is running.

const express = require("express");
const { requireAuth, requireRole } = require("../middleware/auth");
const { getAIConfig, setAIConfig, DEFAULT_MODEL } = require("../lib/aiConfig");

const router = express.Router();

function maskKey(key) {
  if (!key || key.length <= 8) return "••••";
  return `${key.slice(0, 4)}••••••••${key.slice(-4)}`;
}

router.get("/ai", requireAuth, requireRole("admin"), (req, res) => {
  const config = getAIConfig();
  res.json({
    provider: config.provider,
    model: config.model,
    apiBase: config.apiBase,
    defaultModel: DEFAULT_MODEL,
    configured: Boolean(config.apiKey) || (config.provider === "local" && Boolean(config.apiBase)),
    apiKeyMasked: config.apiKey ? maskKey(config.apiKey) : null,
  });
});

router.post("/ai", requireAuth, requireRole("admin"), (req, res) => {
  const { provider, apiKey, model, apiBase } = req.body;
  const resolvedProvider = (provider || "gemini").trim();

  if (resolvedProvider === "local") {
    if (!apiBase || !apiBase.trim()) {
      return res.status(400).json({ error: "Base URL is required for a local/self-hosted model." });
    }
  } else if (!apiKey || !apiKey.trim()) {
    return res.status(400).json({ error: "API key is required." });
  }

  setAIConfig(resolvedProvider, apiKey ? apiKey.trim() : "", model, apiBase);
  res.json({ ok: true });
});

module.exports = router;
