const API = "/api";

const state = {
  token: localStorage.getItem("admin_token"),
  apps: [],
  currentApp: "toastmachine",
  keys: [],
  stats: [],
  filter: "",
  statusFilter: "",
  view: "keys",
  feedback: [],
  unreadFeedback: 0,
};

const appEl = document.getElementById("app");

async function api(method, path, body) {
  const opts = {
    method,
    headers: { "Content-Type": "application/json" },
  };
  if (state.token) opts.headers.Authorization = `Bearer ${state.token}`;
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${API}${path}`, opts);
  const data = await res.json().catch(() => ({ ok: false, error: "Network error" }));
  if (!res.ok && res.status === 401) {
    state.token = null;
    localStorage.removeItem("admin_token");
    renderLogin();
    return null;
  }
  return data;
}

function formatDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("ru-RU");
}

function copy(text) {
  navigator.clipboard.writeText(text).then(() => alert("Скопировано: " + text));
}

function renderLogin() {
  appEl.innerHTML = `
    <div class="min-h-screen flex items-center justify-center">
      <div class="bg-slate-900 border border-slate-800 rounded-2xl p-8 w-full max-w-md">
        <h1 class="text-2xl font-black mb-6 text-amber-400">License Admin</h1>
        <form id="loginForm" class="space-y-4">
          <div>
            <label class="block text-sm text-slate-400 mb-1">Логин</label>
            <input type="text" name="username" class="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 focus:outline-none focus:border-amber-500" required />
          </div>
          <div>
            <label class="block text-sm text-slate-400 mb-1">Пароль</label>
            <input type="password" name="password" class="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 focus:outline-none focus:border-amber-500" required />
          </div>
          <button type="submit" class="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold py-2 rounded-lg transition">Войти</button>
        </form>
        <div id="loginError" class="text-red-400 text-sm mt-4 hidden"></div>
      </div>
    </div>
  `;
  document.getElementById("loginForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const data = await api("POST", "/admin/login", {
      username: fd.get("username"),
      password: fd.get("password"),
    });
    if (data && data.ok) {
      state.token = data.token;
      localStorage.setItem("admin_token", data.token);
      init();
    } else {
      const err = document.getElementById("loginError");
      err.textContent = data?.error || "Ошибка входа";
      err.classList.remove("hidden");
    }
  });
}

async function loadApps() {
  const data = await api("GET", "/admin/apps");
  if (data && data.ok) state.apps = data.apps;
}

async function loadKeys() {
  const qs = new URLSearchParams();
  qs.set("app", state.currentApp);
  if (state.statusFilter) qs.set("status", state.statusFilter);
  const data = await api("GET", `/admin/keys?${qs.toString()}`);
  if (data && data.ok) {
    state.keys = data.keys;
    state.stats = data.stats;
    renderDashboard();
  }
}

async function sellKey(id) {
  const notes = prompt("Комментарий к продаже (необязательно):");
  if (notes === null) return;
  const data = await api("POST", `/admin/keys/${id}/sell`, { notes });
  if (data && data.ok) {
    copy(data.key);
    loadKeys();
  } else {
    alert(data?.error || "Ошибка");
  }
}

async function revokeKey(id) {
  if (!confirm("Отозвать этот ключ?")) return;
  const data = await api("POST", `/admin/keys/${id}/revoke`);
  if (data && data.ok) loadKeys();
  else alert(data?.error || "Ошибка");
}

async function resetKey(id) {
  if (!confirm("Сбросить привязку этого ключа к устройству?")) return;
  const data = await api("POST", `/admin/keys/${id}/reset`);
  if (data && data.ok) loadKeys();
  else alert(data?.error || "Ошибка");
}

async function generateKeys() {
  const count = prompt("Сколько ключей сгенерировать?", "10");
  if (!count) return;
  const data = await api("POST", "/admin/keys/generate", {
    app: state.currentApp,
    count: parseInt(count, 10),
  });
  if (data && data.ok) {
    alert(`Сгенерировано ${data.generated} ключей`);
    loadKeys();
  } else {
    alert(data?.error || "Ошибка");
  }
}

async function issueKeyByEmail(email, notes) {
  const data = await api("POST", "/admin/keys/issue", {
    app: state.currentApp,
    email,
    notes,
  });
  if (data && data.ok) {
    alert(`Ключ ${data.key} выдан на ${data.email} и отправлен по почте.`);
    loadKeys();
  } else {
    alert(data?.error || "Ошибка выдачи ключа.");
  }
}

async function loadFeedback() {
  const data = await api("GET", "/admin/feedback");
  if (data && data.ok) {
    state.feedback = data.feedback;
    state.unreadFeedback = data.unread;
    if (state.view === "feedback") renderFeedback();
    else renderDashboard();
  }
}

async function markFeedbackRead(id) {
  const data = await api("POST", `/admin/feedback/${id}/read`);
  if (data && data.ok) loadFeedback();
  else alert(data?.error || "Ошибка");
}

function getStatsMap() {
  const map = { available: 0, sold: 0, activated: 0, revoked: 0 };
  for (const s of state.stats) map[s.status] = s.count;
  return map;
}

function renderDashboard() {
  const stats = getStatsMap();
  const filtered = state.keys.filter((k) =>
    k.key.toLowerCase().includes(state.filter.toLowerCase())
  );

  appEl.innerHTML = `
    <div class="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
      <div>
        <h1 class="text-2xl font-black text-amber-400">License Admin</h1>
        <p class="text-slate-400 text-sm">Управление лицензионными ключами</p>
      </div>
      <div class="flex items-center gap-3">
        <button id="feedbackBtn" class="relative text-sm text-slate-400 hover:text-white">
          Сообщения
          ${state.unreadFeedback > 0 ? `<span class="absolute -top-2 -right-3 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">${state.unreadFeedback}</span>` : ""}
        </button>
        <button id="logoutBtn" class="text-sm text-slate-400 hover:text-white">Выйти</button>
      </div>
    </div>

    <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
      <div class="bg-slate-900 border border-slate-800 rounded-xl p-4">
        <div class="text-slate-400 text-xs uppercase">Доступно</div>
        <div class="text-2xl font-bold text-emerald-400">${stats.available}</div>
      </div>
      <div class="bg-slate-900 border border-slate-800 rounded-xl p-4">
        <div class="text-slate-400 text-xs uppercase">Продано</div>
        <div class="text-2xl font-bold text-amber-400">${stats.sold}</div>
      </div>
      <div class="bg-slate-900 border border-slate-800 rounded-xl p-4">
        <div class="text-slate-400 text-xs uppercase">Активировано</div>
        <div class="text-2xl font-bold text-blue-400">${stats.activated}</div>
      </div>
      <div class="bg-slate-900 border border-slate-800 rounded-xl p-4">
        <div class="text-slate-400 text-xs uppercase">Отозвано</div>
        <div class="text-2xl font-bold text-red-400">${stats.revoked}</div>
      </div>
    </div>

    <div class="bg-slate-900 border border-slate-800 rounded-xl p-4 mb-6">
      <h3 class="text-sm font-semibold text-slate-300 mb-3">Выдать ключ по email</h3>
      <form id="issueForm" class="flex flex-col md:flex-row gap-3">
        <input type="email" name="email" required placeholder="customer@example.com" class="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 focus:outline-none focus:border-amber-500" />
        <input type="text" name="notes" placeholder="Комментарий (необязательно)" class="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 focus:outline-none focus:border-amber-500" />
        <button type="submit" class="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold px-4 py-2 rounded-lg transition">Выдать и отправить</button>
      </form>
      <div id="issueResult" class="hidden text-sm mt-2"></div>
    </div>

    <div class="bg-slate-900 border border-slate-800 rounded-xl p-4 mb-6">
      <div class="flex flex-col md:flex-row gap-4">
        <select id="appSelect" class="bg-slate-950 border border-slate-700 rounded-lg px-4 py-2">
          ${state.apps
            .map(
              (a) =>
                `<option value="${a.slug}" ${a.slug === state.currentApp ? "selected" : ""}>${a.name}</option>`
            )
            .join("")}
        </select>
        <select id="statusFilter" class="bg-slate-950 border border-slate-700 rounded-lg px-4 py-2">
          <option value="" ${state.statusFilter === "" ? "selected" : ""}>Все статусы</option>
          <option value="available" ${state.statusFilter === "available" ? "selected" : ""}>Доступно</option>
          <option value="sold" ${state.statusFilter === "sold" ? "selected" : ""}>Продано</option>
          <option value="activated" ${state.statusFilter === "activated" ? "selected" : ""}>Активировано</option>
          <option value="revoked" ${state.statusFilter === "revoked" ? "selected" : ""}>Отозвано</option>
        </select>
        <input id="searchInput" type="text" placeholder="Поиск по ключу..." value="${state.filter}" class="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-4 py-2" />
        <button id="genBtn" class="bg-slate-800 hover:bg-slate-700 text-white font-semibold px-4 py-2 rounded-lg transition">+ Сгенерировать</button>
      </div>
    </div>

    <div class="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
      <table class="w-full text-sm">
        <thead class="bg-slate-950 text-slate-400">
          <tr>
            <th class="text-left px-4 py-3 font-medium">Ключ</th>
            <th class="text-left px-4 py-3 font-medium">Статус</th>
            <th class="text-left px-4 py-3 font-medium">Продан</th>
            <th class="text-left px-4 py-3 font-medium">Email покупателя</th>
            <th class="text-left px-4 py-3 font-medium">Активирован</th>
            <th class="text-left px-4 py-3 font-medium">Устройство</th>
            <th class="text-right px-4 py-3 font-medium">Действия</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-800">
          ${filtered
            .map(
              (k) => `
            <tr class="hover:bg-slate-800/50">
              <td class="px-4 py-3 font-mono">${k.key}</td>
              <td class="px-4 py-3">
                <span class="inline-flex items-center px-2 py-1 rounded text-xs font-semibold ${statusClass(k.status)}">${statusLabel(k.status)}</span>
              </td>
              <td class="px-4 py-3 text-slate-400">${formatDate(k.sold_at)}</td>
              <td class="px-4 py-3 text-slate-400 text-xs truncate max-w-[150px]" title="${k.customer_email || ""}">${k.customer_email || "—"}</td>
              <td class="px-4 py-3 text-slate-400">${formatDate(k.activated_at)}</td>
              <td class="px-4 py-3 text-slate-400 font-mono text-xs truncate max-w-[150px]" title="${k.device_fingerprint || ""}">${k.device_fingerprint ? k.device_fingerprint.slice(0, 16) + "..." : "—"}</td>
              <td class="px-4 py-3 text-right space-x-2">
                ${k.status === "available" ? `<button data-sell="${k.id}" class="text-emerald-400 hover:text-emerald-300 font-medium">Продать</button>` : ""}
                ${k.status !== "revoked" ? `<button data-revoke="${k.id}" class="text-red-400 hover:text-red-300 font-medium">Отозвать</button>` : ""}
                ${k.status !== "available" ? `<button data-reset="${k.id}" class="text-slate-400 hover:text-white font-medium">Сброс</button>` : ""}
              </td>
            </tr>
          `
            )
            .join("")}
        </tbody>
      </table>
      ${filtered.length === 0 ? '<div class="p-8 text-center text-slate-500">Ничего не найдено</div>' : ""}
    </div>
  `;

  document.getElementById("logoutBtn").addEventListener("click", () => {
    state.token = null;
    localStorage.removeItem("admin_token");
    renderLogin();
  });
  document.getElementById("feedbackBtn").addEventListener("click", () => {
    state.view = "feedback";
    loadFeedback();
  });
  document.getElementById("issueForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const result = document.getElementById("issueResult");
    result.className = "hidden text-sm mt-2";
    const data = await api("POST", "/admin/keys/issue", {
      app: state.currentApp,
      email: fd.get("email"),
      notes: fd.get("notes"),
    });
    if (data && data.ok) {
      result.textContent = `Выдан ${data.key} на ${data.email}`;
      result.className = "text-sm mt-2 text-emerald-400";
      e.target.reset();
      loadKeys();
    } else {
      result.textContent = data?.error || "Ошибка выдачи";
      result.className = "text-sm mt-2 text-red-400";
    }
    result.classList.remove("hidden");
  });
  document.getElementById("appSelect").addEventListener("change", (e) => {
    state.currentApp = e.target.value;
    loadKeys();
  });
  document.getElementById("statusFilter").addEventListener("change", (e) => {
    state.statusFilter = e.target.value;
    loadKeys();
  });
  document.getElementById("searchInput").addEventListener("input", (e) => {
    state.filter = e.target.value;
    renderDashboard();
  });
  document.getElementById("genBtn").addEventListener("click", generateKeys);
  appEl.querySelectorAll("[data-sell]").forEach((btn) =>
    btn.addEventListener("click", () => sellKey(btn.dataset.sell))
  );
  appEl.querySelectorAll("[data-revoke]").forEach((btn) =>
    btn.addEventListener("click", () => revokeKey(btn.dataset.revoke))
  );
  appEl.querySelectorAll("[data-reset]").forEach((btn) =>
    btn.addEventListener("click", () => resetKey(btn.dataset.reset))
  );
}

function renderFeedback() {
  appEl.innerHTML = `
    <div class="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
      <div>
        <h1 class="text-2xl font-black text-amber-400">License Admin</h1>
        <p class="text-slate-400 text-sm">Сообщения пользователей</p>
      </div>
      <div class="flex items-center gap-3">
        <button id="keysBtn" class="text-sm text-slate-400 hover:text-white">Ключи</button>
        <button id="logoutBtn" class="text-sm text-slate-400 hover:text-white">Выйти</button>
      </div>
    </div>

    <div class="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
      <table class="w-full text-sm">
        <thead class="bg-slate-950 text-slate-400">
          <tr>
            <th class="text-left px-4 py-3 font-medium w-12"></th>
            <th class="text-left px-4 py-3 font-medium">Имя / Контакт</th>
            <th class="text-left px-4 py-3 font-medium">Сообщение</th>
            <th class="text-left px-4 py-3 font-medium">Дата</th>
            <th class="text-right px-4 py-3 font-medium">Действие</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-800">
          ${state.feedback.length === 0 ? '<tr><td colspan="5" class="px-4 py-8 text-center text-slate-500">Нет сообщений</td></tr>' : ""}
          ${state.feedback
            .map(
              (f) => `
            <tr class="hover:bg-slate-800/50 ${f.read ? "" : "bg-slate-800/30"}">
              <td class="px-4 py-3">
                ${f.read ? "" : '<span class="inline-block w-2 h-2 rounded-full bg-red-500"></span>'}
              </td>
              <td class="px-4 py-3">
                <div class="font-medium text-slate-200">${escapeHtml(f.name)}</div>
                ${f.contact ? `<div class="text-xs text-slate-400">${escapeHtml(f.contact)}</div>` : ""}
              </td>
              <td class="px-4 py-3 text-slate-300 whitespace-pre-wrap">${escapeHtml(f.message)}</td>
              <td class="px-4 py-3 text-slate-400 text-xs">${formatDate(f.created_at)}</td>
              <td class="px-4 py-3 text-right">
                ${f.read ? '<span class="text-slate-500 text-xs">Прочитано</span>' : `<button data-read="${f.id}" class="text-emerald-400 hover:text-emerald-300 font-medium text-xs">Отметить прочитанным</button>`}
              </td>
            </tr>
          `
            )
            .join("")}
        </tbody>
      </table>
    </div>
  `;

  document.getElementById("logoutBtn").addEventListener("click", () => {
    state.token = null;
    localStorage.removeItem("admin_token");
    renderLogin();
  });
  document.getElementById("keysBtn").addEventListener("click", () => {
    state.view = "keys";
    loadKeys();
  });
  appEl.querySelectorAll("[data-read]").forEach((btn) =>
    btn.addEventListener("click", () => markFeedbackRead(btn.dataset.read))
  );
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function statusClass(status) {
  switch (status) {
    case "available":
      return "bg-emerald-500/10 text-emerald-400";
    case "sold":
      return "bg-amber-500/10 text-amber-400";
    case "activated":
      return "bg-blue-500/10 text-blue-400";
    case "revoked":
      return "bg-red-500/10 text-red-400";
    default:
      return "bg-slate-500/10 text-slate-400";
  }
}

function statusLabel(status) {
  const labels = {
    available: "Доступно",
    sold: "Продано",
    activated: "Активировано",
    revoked: "Отозвано",
  };
  return labels[status] || status;
}

async function init() {
  if (!state.token) return renderLogin();
  await loadApps();
  if (state.apps.length > 0 && !state.apps.find((a) => a.slug === state.currentApp)) {
    state.currentApp = state.apps[0].slug;
  }
  await loadKeys();
  await loadFeedback();
}

init();
