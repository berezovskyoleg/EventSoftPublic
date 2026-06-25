const express = require("express");
const fs = require("fs");
const path = require("path");

const router = express.Router();
const RELEASES_DIR = process.env.RELEASES_DIR || "/app/releases";

function parseVersion(filename) {
  const match = filename.match(/_(\d+\.\d+\.\d+(_\w+)?)_[\w\.\-]+\.(dmg|msi|exe)/);
  return match ? match[1] : null;
}

function versionTuple(version) {
  const parts = (version || "").split(".")
    .map((p) => parseInt(p.replace(/[^0-9].*$/, ""), 10) || 0);
  while (parts.length < 3) parts.push(0);
  return parts.slice(0, 3);
}

function compareVersion(a, b) {
  const ta = versionTuple(a);
  const tb = versionTuple(b);
  for (let i = 0; i < 3; i++) {
    if (ta[i] !== tb[i]) return ta[i] - tb[i];
  }
  return 0;
}

function latestFile(files) {
  return files
    .map((f) => ({ file: f, version: parseVersion(f) }))
    .filter((x) => x.version)
    .sort((a, b) => compareVersion(a.version, b.version))
    .pop()?.file || null;
}

function findLatest(dir) {
  if (!fs.existsSync(dir)) {
    return { version: null, macos: null, windows: null };
  }
  const files = fs.readdirSync(dir);
  const macos = latestFile(files.filter((f) => f.endsWith(".dmg")));
  const windows = latestFile(files.filter((f) => f.endsWith(".msi") || f.endsWith(".exe")));

  const version = parseVersion(macos || windows || "") || null;
  return {
    version,
    macos: macos ? `/releases/${path.basename(dir)}/${macos}` : null,
    windows: windows ? `/releases/${path.basename(dir)}/${windows}` : null,
  };
}

// GET /api/releases/latest?app=musicbingo
router.get("/latest", (req, res) => {
  try {
    const app = (req.query.app || "").toString().replace(/[^a-z0-9_-]/gi, "");
    const dir = app ? path.join(RELEASES_DIR, app) : RELEASES_DIR;
    const result = findLatest(dir);

    return res.json({
      ok: true,
      version: result.version,
      macos: result.macos,
      windows: result.windows,
    });
  } catch (err) {
    console.error("releases error", err);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
});

module.exports = router;
