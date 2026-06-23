const express = require("express");
const db = require("../db");
const crypto = require("crypto");

const router = express.Router();

function normalizeKey(raw) {
  return raw
    .toString()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .replace(/(.{4})(?=.)/g, "$1-")
    .slice(0, 24);
}

function hashFingerprint(raw) {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

function getAppBySlug(slug) {
  return db.prepare("SELECT * FROM apps WHERE slug = ?").get(slug);
}

function getKeyRecord(appId, key) {
  return db
    .prepare("SELECT * FROM license_keys WHERE app_id = ? AND key = ?")
    .get(appId, key);
}

// POST /api/license/activate
router.post("/activate", (req, res) => {
  try {
    const { key: rawKey, fingerprint: rawFp, app: appSlug } = req.body;
    if (!rawKey || !rawFp || !appSlug) {
      return res.status(400).json({ ok: false, error: "Missing key, fingerprint or app" });
    }
    if (String(rawFp).length < 16) {
      return res.status(400).json({ ok: false, error: "Invalid fingerprint" });
    }

    const key = normalizeKey(rawKey);
    const fpHash = hashFingerprint(rawFp);
    const app = getAppBySlug(appSlug);
    if (!app) {
      return res.status(404).json({ ok: false, error: "App not found" });
    }

    const record = getKeyRecord(app.id, key);
    if (!record) {
      return res.status(400).json({ ok: false, error: "License key not found" });
    }
    if (record.status === "revoked") {
      return res.status(400).json({ ok: false, error: "License key revoked" });
    }

    const now = new Date().toISOString();

    // Not activated yet — bind to this device
    if (record.status !== "activated") {
      db.prepare(
        `UPDATE license_keys
         SET status = 'activated',
             activated_at = ?,
             device_fingerprint = ?,
             activation_count = activation_count + 1
         WHERE id = ?`
      ).run(now, fpHash, record.id);
      return res.json({ ok: true, activated: true, key });
    }

    // Already activated — allow only same device
    if (record.device_fingerprint !== fpHash) {
      return res.status(400).json({
        ok: false,
        error: "This key is already bound to another device",
      });
    }

    return res.json({ ok: true, activated: false, key });
  } catch (err) {
    console.error("activate error", err);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
});

// POST /api/license/verify
router.post("/verify", (req, res) => {
  try {
    const { key: rawKey, fingerprint: rawFp, app: appSlug } = req.body;
    if (!rawKey || !rawFp || !appSlug) {
      return res.status(400).json({ ok: false, error: "Missing key, fingerprint or app" });
    }

    const key = normalizeKey(rawKey);
    const fpHash = hashFingerprint(rawFp);
    const app = getAppBySlug(appSlug);
    if (!app) {
      return res.status(404).json({ ok: false, error: "App not found" });
    }

    const record = getKeyRecord(app.id, key);
    if (!record) {
      return res.status(400).json({ ok: false, error: "License key not found" });
    }
    if (record.status === "revoked") {
      return res.status(400).json({ ok: false, error: "License key revoked" });
    }
    if (record.status !== "activated") {
      return res.status(400).json({ ok: false, error: "License key not activated" });
    }
    if (record.device_fingerprint !== fpHash) {
      return res.status(400).json({ ok: false, error: "Key bound to another device" });
    }

    return res.json({ ok: true, key });
  } catch (err) {
    console.error("verify error", err);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
});

// POST /api/license/deactivate (optional, admin-only could be safer)
router.post("/deactivate", (req, res) => {
  try {
    const { key: rawKey, app: appSlug } = req.body;
    if (!rawKey || !appSlug) {
      return res.status(400).json({ ok: false, error: "Missing key or app" });
    }
    const key = normalizeKey(rawKey);
    const app = getAppBySlug(appSlug);
    if (!app) {
      return res.status(404).json({ ok: false, error: "App not found" });
    }
    const record = getKeyRecord(app.id, key);
    if (!record) {
      return res.status(400).json({ ok: false, error: "License key not found" });
    }
    db.prepare(
      `UPDATE license_keys
       SET status = 'available',
           device_fingerprint = NULL,
           activated_at = NULL
       WHERE id = ?`
    ).run(record.id);
    return res.json({ ok: true, key });
  } catch (err) {
    console.error("deactivate error", err);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
});

module.exports = router;
