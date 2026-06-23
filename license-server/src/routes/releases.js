const express = require("express");
const fs = require("fs");
const path = require("path");

const router = express.Router();
const RELEASES_DIR = process.env.RELEASES_DIR || "/app/releases";

function parseVersion(filename) {
  const match = filename.match(/_(\d+\.\d+\.\d+(_\w+)?)_[\w\.]+\.(dmg|msi|exe)/);
  return match ? match[1] : null;
}

// GET /api/releases/latest
router.get("/latest", (req, res) => {
  try {
    if (!fs.existsSync(RELEASES_DIR)) {
      return res.json({ ok: true, macos: null, windows: null, version: null });
    }
    const files = fs.readdirSync(RELEASES_DIR);
    const macos = files
      .filter((f) => f.endsWith(".dmg"))
      .sort()
      .pop();
    const windows = files
      .filter((f) => f.endsWith(".msi") || f.endsWith(".exe"))
      .sort()
      .pop();

    const version = parseVersion(macos || windows || "") || null;

    return res.json({
      ok: true,
      version,
      macos: macos ? `/releases/${macos}` : null,
      windows: windows ? `/releases/${windows}` : null,
    });
  } catch (err) {
    console.error("releases error", err);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
});

module.exports = router;
