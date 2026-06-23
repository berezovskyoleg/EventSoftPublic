require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });

const express = require("express");
const cors = require("cors");
const path = require("path");

const licenseRoutes = require("./routes/license");
const adminRoutes = require("./routes/admin");
const feedbackRoutes = require("./routes/feedback");
const releasesRoutes = require("./routes/releases");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// API routes
app.use("/api/license", licenseRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/feedback", feedbackRoutes);
app.use("/api/releases", releasesRoutes);

// Static files
app.use("/releases", express.static(path.join(__dirname, "..", "releases")));
app.use("/admin", express.static(path.join(__dirname, "..", "public", "admin")));
app.use(express.static(path.join(__dirname, "..", "public")));

// Health check
app.get("/health", (req, res) => {
  res.json({ ok: true });
});

// SPA fallback for admin routes
app.get("/admin/*", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "admin", "index.html"));
});

app.listen(PORT, () => {
  console.log(`License server listening on port ${PORT}`);
});
