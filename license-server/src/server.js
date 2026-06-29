require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });

const express = require("express");
const cors = require("cors");
const path = require("path");
const cookieParser = require("cookie-parser");

const licenseRoutes = require("./routes/license");
const adminRoutes = require("./routes/admin");
const feedbackRoutes = require("./routes/feedback");
const releasesRoutes = require("./routes/releases");
const {
  siteAuthMiddleware,
  loginHandler,
  logoutHandler,
} = require("./middleware/siteAuth");
const { setupMusicBingoWSS } = require("./ws/musicbingo");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Site-wide auth for beta pages (must be before protected static/landing routes)
app.use(siteAuthMiddleware);

// Auth entry/exit points
app.all("/login", loginHandler);
app.get("/logout", logoutHandler);

// API routes
app.use("/api/license", licenseRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/feedback", feedbackRoutes);
app.use("/api/releases", releasesRoutes);

// App landing pages (before static to avoid directory redirect)
const APP_SLUGS = ["toastmachine", "fastquiz", "musicbingo"];
for (const slug of APP_SLUGS) {
  app.get([`/${slug}`, `/${slug}/`], (req, res) => {
    res.sendFile(path.join(__dirname, "..", "public", slug, "index.html"));
  });
}

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

// Web app SPA fallbacks for /play routes
app.get("/toastmachine/play", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "toastmachine", "play", "index.html"));
});
app.get("/musicbingo/play", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "musicbingo", "play", "index.html"));
});

const http = require("http");
const server = http.createServer(app);
setupMusicBingoWSS(server);

server.listen(PORT, () => {
  console.log(`License server listening on port ${PORT}`);
});
