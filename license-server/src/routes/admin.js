const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("../db");
const authMiddleware = require("../middleware/auth");

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET;
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || "admin";
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH;

// POST /api/admin/login
router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    if (username !== ADMIN_USERNAME) {
      return res.status(401).json({ ok: false, error: "Invalid credentials" });
    }
    const valid = await bcrypt.compare(password, ADMIN_PASSWORD_HASH);
    if (!valid) {
      return res.status(401).json({ ok: false, error: "Invalid credentials" });
    }
    const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: "7d" });
    return res.json({ ok: true, token });
  } catch (err) {
    console.error("login error", err);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
});

// GET /api/admin/apps
router.get("/apps", authMiddleware, (req, res) => {
  try {
    const apps = db.prepare("SELECT * FROM apps ORDER BY id").all();
    return res.json({ ok: true, apps });
  } catch (err) {
    console.error("apps error", err);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
});

// GET /api/admin/keys?app=toastmachine&status=
router.get("/keys", authMiddleware, (req, res) => {
  try {
    const { app: appSlug, status } = req.query;
    const app = db.prepare("SELECT * FROM apps WHERE slug = ?").get(appSlug);
    if (!app) {
      return res.status(404).json({ ok: false, error: "App not found" });
    }

    let sql = "SELECT * FROM license_keys WHERE app_id = ?";
    const params = [app.id];
    if (status && ["available", "sold", "activated", "revoked"].includes(status)) {
      sql += " AND status = ?";
      params.push(status);
    }
    sql += " ORDER BY created_at ASC, id ASC";

    const keys = db.prepare(sql).all(...params);
    const stats = db
      .prepare(
        `SELECT status, COUNT(*) as count FROM license_keys WHERE app_id = ? GROUP BY status`
      )
      .all(app.id);

    return res.json({ ok: true, keys, stats });
  } catch (err) {
    console.error("keys error", err);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
});

// POST /api/admin/keys/:id/sell
router.post("/keys/:id/sell", authMiddleware, (req, res) => {
  try {
    const { id } = req.params;
    const { notes } = req.body || {};
    const record = db.prepare("SELECT * FROM license_keys WHERE id = ?").get(id);
    if (!record) {
      return res.status(404).json({ ok: false, error: "Key not found" });
    }
    if (record.status !== "available") {
      return res.status(400).json({ ok: false, error: "Key is not available" });
    }
    const now = new Date().toISOString();
    db.prepare(
      "UPDATE license_keys SET status = 'sold', sold_at = ?, notes = ? WHERE id = ?"
    ).run(now, notes || null, id);
    return res.json({ ok: true, key: record.key });
  } catch (err) {
    console.error("sell error", err);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
});

// POST /api/admin/keys/:id/revoke
router.post("/keys/:id/revoke", authMiddleware, (req, res) => {
  try {
    const { id } = req.params;
    const record = db.prepare("SELECT * FROM license_keys WHERE id = ?").get(id);
    if (!record) {
      return res.status(404).json({ ok: false, error: "Key not found" });
    }
    const now = new Date().toISOString();
    db.prepare(
      "UPDATE license_keys SET status = 'revoked', revoked_at = ? WHERE id = ?"
    ).run(now, id);
    return res.json({ ok: true, key: record.key });
  } catch (err) {
    console.error("revoke error", err);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
});

// POST /api/admin/keys/:id/reset
router.post("/keys/:id/reset", authMiddleware, (req, res) => {
  try {
    const { id } = req.params;
    const record = db.prepare("SELECT * FROM license_keys WHERE id = ?").get(id);
    if (!record) {
      return res.status(404).json({ ok: false, error: "Key not found" });
    }
    db.prepare(
      `UPDATE license_keys
       SET status = 'available',
           sold_at = NULL,
           activated_at = NULL,
           revoked_at = NULL,
           device_fingerprint = NULL,
           activation_count = 0,
           notes = NULL
       WHERE id = ?`
    ).run(id);
    return res.json({ ok: true, key: record.key });
  } catch (err) {
    console.error("reset error", err);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
});

// POST /api/admin/keys/generate
router.post("/keys/generate", authMiddleware, (req, res) => {
  try {
    const { app: appSlug, count = 10 } = req.body;
    const app = db.prepare("SELECT * FROM apps WHERE slug = ?").get(appSlug);
    if (!app) {
      return res.status(404).json({ ok: false, error: "App not found" });
    }

    const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
    const segment = 4;
    const countNum = Math.min(Math.max(parseInt(count, 10) || 10, 1), 1000);
    const existing = new Set(
      db.prepare("SELECT key FROM license_keys WHERE app_id = ?").pluck().all(app.id)
    );

    const generated = [];
    let attempts = 0;
    while (generated.length < countNum && attempts < countNum * 50) {
      attempts++;
      let key = "TOAST-";
      for (let s = 0; s < 4; s++) {
        let part = "";
        for (let i = 0; i < segment; i++) {
          part += alphabet[Math.floor(Math.random() * alphabet.length)];
        }
        key += part + (s < 3 ? "-" : "");
      }
      if (existing.has(key) || generated.includes(key)) continue;
      generated.push(key);
    }

    const insert = db.prepare("INSERT INTO license_keys (app_id, key) VALUES (?, ?)");
    const insertMany = db.transaction((keys) => {
      for (const k of keys) insert.run(app.id, k);
    });
    insertMany(generated);

    return res.json({ ok: true, generated: generated.length, keys: generated });
  } catch (err) {
    console.error("generate error", err);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
});

// GET /api/admin/feedback
router.get("/feedback", authMiddleware, (req, res) => {
  try {
    const feedback = db
      .prepare("SELECT * FROM feedback ORDER BY created_at DESC, id DESC")
      .all();
    const unread = db
      .prepare("SELECT COUNT(*) as count FROM feedback WHERE read = 0")
      .get().count;
    return res.json({ ok: true, feedback, unread });
  } catch (err) {
    console.error("feedback list error", err);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
});

// POST /api/admin/feedback/:id/read
router.post("/feedback/:id/read", authMiddleware, (req, res) => {
  try {
    const { id } = req.params;
    db.prepare("UPDATE feedback SET read = 1 WHERE id = ?").run(id);
    return res.json({ ok: true });
  } catch (err) {
    console.error("feedback read error", err);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
});

module.exports = router;
