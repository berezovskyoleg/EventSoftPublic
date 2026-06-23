const express = require("express");
const db = require("../db");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");

const router = express.Router();

function loadPrivateKey() {
  if (!process.env.LICENSE_PRIVATE_KEY_BASE64) return null;
  return Buffer.from(process.env.LICENSE_PRIVATE_KEY_BASE64, "base64").toString("utf8");
}

const LICENSE_PRIVATE_KEY_PEM = loadPrivateKey();

function loadPublicKey() {
  if (process.env.LICENSE_PUBLIC_KEY_PEM) {
    return process.env.LICENSE_PUBLIC_KEY_PEM;
  }
  if (LICENSE_PRIVATE_KEY_PEM) {
    try {
      return crypto.createPublicKey(LICENSE_PRIVATE_KEY_PEM).export({ type: "spki", format: "pem" });
    } catch (e) {
      console.error("Failed to derive public key from private key", e);
    }
  }
  return null;
}

const LICENSE_PUBLIC_KEY_PEM = loadPublicKey();

function normalizeKey(raw) {
  const clean = raw.toString().toUpperCase().replace(/[^A-Z0-9]/g, "");

  // Keys are always prefixed with TOAST followed by 16 alphanumeric characters.
  let body = clean;
  if (body.startsWith("TOAST")) {
    body = body.slice(5);
  }
  if (body.length !== 16) {
    return "";
  }
  const groups = body.match(/.{1,4}/g) || [];
  return `TOAST-${groups.join("-")}`;
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

function signLicenseToken(key, fingerprint, appSlug) {
  if (!LICENSE_PRIVATE_KEY_PEM) {
    throw new Error("LICENSE_PRIVATE_KEY_BASE64 is not configured");
  }
  const payload = {
    key,
    fingerprint,
    app: appSlug,
  };
  return jwt.sign(payload, LICENSE_PRIVATE_KEY_PEM, {
    algorithm: "RS256",
    expiresIn: "100y", // long-lived offline license
  });
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
      const token = signLicenseToken(key, fpHash, appSlug);
      return res.json({ ok: true, activated: true, key, token });
    }

    // Already activated — allow only same device
    if (record.device_fingerprint !== fpHash) {
      return res.status(400).json({
        ok: false,
        error: "This key is already bound to another device",
      });
    }

    const token = signLicenseToken(key, fpHash, appSlug);
    return res.json({ ok: true, activated: false, key, token });
  } catch (err) {
    console.error("activate error", err);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
});

// POST /api/license/verify
router.post("/verify", (req, res) => {
  try {
    const { key: rawKey, fingerprint: rawFp, app: appSlug, token } = req.body;

    // If a signed token is provided, verify it cryptographically first.
    if (token) {
      const publicPem = LICENSE_PUBLIC_KEY_PEM;
      if (!publicPem) {
        return res.status(500).json({ ok: false, error: "Public key not configured" });
      }
      try {
        const decoded = jwt.verify(token, publicPem, { algorithms: ["RS256"] });
        const fpHash = hashFingerprint(rawFp || "");
        if (decoded.app !== appSlug) {
          return res.status(400).json({ ok: false, error: "Token is for another app" });
        }
        if (decoded.fingerprint !== fpHash) {
          return res.status(400).json({ ok: false, error: "Token bound to another device" });
        }
        return res.json({ ok: true, key: decoded.key, offline: true });
      } catch (err) {
        return res.status(400).json({ ok: false, error: "Invalid or expired token" });
      }
    }

    // Fallback to database-backed online verification.
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

// POST /api/license/deactivate
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
