const express = require("express");
const db = require("../db");

const router = express.Router();

// POST /api/feedback — public feedback form
router.post("/", (req, res) => {
  try {
    const { name, contact, message, app } = req.body;
    if (!name || !message) {
      return res.status(400).json({ ok: false, error: "Укажите имя и сообщение." });
    }

    const cleanName = String(name).trim().slice(0, 120);
    const cleanContact = contact ? String(contact).trim().slice(0, 120) : null;
    const cleanMessage = String(message).trim().slice(0, 4000);
    const appSlug = app ? String(app).trim().slice(0, 60) : null;

    if (cleanMessage.length < 5) {
      return res.status(400).json({ ok: false, error: "Сообщение слишком короткое." });
    }

    db.prepare(
      "INSERT INTO feedback (name, contact, message, app_slug) VALUES (?, ?, ?, ?)"
    ).run(cleanName, cleanContact, cleanMessage, appSlug);

    return res.json({ ok: true });
  } catch (err) {
    console.error("feedback error", err);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
});

module.exports = router;
