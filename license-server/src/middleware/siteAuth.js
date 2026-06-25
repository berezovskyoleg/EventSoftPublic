const jwt = require("jsonwebtoken");
const path = require("path");

const COOKIE_NAME = "site_session";
const MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000; // 90 days

// These values are intentionally simple because the site pages themselves are
// not sensitive customer data — they are public-ish landing/download pages that
// the owner wants to hide from random visitors while the products are in beta.
const DEFAULT_EMAIL = "berezovskyoleg@yandex.ru";
const DEFAULT_PASSWORD = "12345";

const SITE_AUTH_EMAIL = process.env.SITE_AUTH_EMAIL || DEFAULT_EMAIL;
const SITE_AUTH_PASSWORD = process.env.SITE_AUTH_PASSWORD || DEFAULT_PASSWORD;

function getSecret() {
  const secret = process.env.JWT_SECRET || process.env.SESSION_SECRET || "eventhunt-site-auth-fallback-secret";
  return secret;
}

function signSession(email) {
  return jwt.sign({ email }, getSecret(), { expiresIn: "90d" });
}

function verifySession(token) {
  try {
    return jwt.verify(token, getSecret());
  } catch {
    return null;
  }
}

function isProtectedPath(reqPath) {
  const normalized = reqPath.split("?")[0].toLowerCase();
  if (normalized === "/" || normalized === "/index.html") return false;
  if (normalized.startsWith("/login") || normalized.startsWith("/logout")) return false;
  if (normalized.startsWith("/api/")) return false;
  if (normalized.startsWith("/admin")) return false;
  if (normalized.startsWith("/releases/")) return false;
  if (normalized.startsWith("/musicbingo") || normalized.startsWith("/fastquiz")) return true;
  return false;
}

function siteAuthMiddleware(req, res, next) {
  if (!isProtectedPath(req.path)) {
    return next();
  }

  const token = req.cookies?.[COOKIE_NAME];
  const payload = token ? verifySession(token) : null;
  if (payload) {
    req.siteUser = payload;
    return next();
  }

  // Not authenticated — redirect to login, preserving return URL.
  const returnTo = encodeURIComponent(req.originalUrl);
  return res.redirect(`/login?returnTo=${returnTo}`);
}

function renderLoginPage(returnTo) {
  const safeReturn = encodeURIComponent(returnTo || "/");
  return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Вход — EventSoft</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="min-h-screen bg-[#0f0f13] text-indigo-50 flex items-center justify-center p-4">
  <div class="w-full max-w-sm rounded-2xl border border-indigo-700/30 bg-[#1a1a24] p-6 shadow-2xl">
    <h1 class="text-xl font-black text-center mb-1">EventSoft</h1>
    <p class="text-sm text-indigo-200/60 text-center mb-6">Вход в закрытый раздел</p>
    <form method="POST" action="/login" class="space-y-4">
      <input type="hidden" name="returnTo" value="${safeReturn}" />
      <div>
        <label class="block text-xs font-semibold uppercase tracking-wider text-indigo-200/70 mb-1">Email</label>
        <input type="email" name="email" required value="${SITE_AUTH_EMAIL}" class="w-full rounded-lg border border-indigo-700/50 bg-[#0f0f13] px-3 py-2 text-sm focus:outline-none focus:border-indigo-500" />
      </div>
      <div>
        <label class="block text-xs font-semibold uppercase tracking-wider text-indigo-200/70 mb-1">Пароль</label>
        <input type="password" name="password" required autofocus class="w-full rounded-lg border border-indigo-700/50 bg-[#0f0f13] px-3 py-2 text-sm focus:outline-none focus:border-indigo-500" />
      </div>
      <div class="flex items-center gap-2">
        <input type="checkbox" name="remember" id="remember" checked class="h-4 w-4 rounded border-indigo-700/50 bg-[#0f0f13] text-indigo-500 focus:ring-indigo-500" />
        <label for="remember" class="text-sm text-indigo-200/70">Запомнить на 90 дней</label>
      </div>
      <button type="submit" class="w-full rounded-lg bg-gradient-to-r from-indigo-500 to-pink-500 py-2.5 text-sm font-bold text-white hover:from-indigo-400 hover:to-pink-400 transition">
        Войти
      </button>
    </form>
  </div>
</body>
</html>`;
}

function loginHandler(req, res) {
  if (req.method === "GET") {
    return res.send(renderLoginPage(req.query.returnTo || "/"));
  }

  if (req.method === "POST") {
    const { email, password, remember } = req.body || {};
    if (email === SITE_AUTH_EMAIL && password === SITE_AUTH_PASSWORD) {
      const token = signSession(email);
      const options = remember === "on"
        ? { maxAge: MAX_AGE_MS, httpOnly: true, sameSite: "lax" }
        : { httpOnly: true, sameSite: "lax" };
      res.cookie(COOKIE_NAME, token, options);
      const returnTo = req.body.returnTo || "/";
      return res.redirect(returnTo);
    }
    return res.status(401).send(renderLoginPage(req.body.returnTo || "/").replace("</form>", `<div class="mt-3 text-sm text-rose-400 text-center">Неверный email или пароль</div></form>`));
  }

  res.status(405).send("Method Not Allowed");
}

function logoutHandler(req, res) {
  res.clearCookie(COOKIE_NAME);
  res.redirect("/");
}

module.exports = {
  siteAuthMiddleware,
  loginHandler,
  logoutHandler,
};
