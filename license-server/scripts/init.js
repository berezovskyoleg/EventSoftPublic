require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });

const db = require("../src/db");
const fs = require("fs");
const path = require("path");

function seedApps() {
  const apps = [
    { slug: "toastmachine", name: "ToastMachine", description: "Слот-машина для выбора тостующегося" },
    { slug: "fastquiz", name: "FastQuiz", description: "Быстрые викторины для мероприятий" },
    { slug: "musicbingo", name: "MusicBingo", description: "Музыкальное бинго для вечеринок" },
  ];

  const insert = db.prepare(
    "INSERT OR IGNORE INTO apps (slug, name, description) VALUES (?, ?, ?)"
  );
  for (const app of apps) {
    insert.run(app.slug, app.name, app.description);
  }
}

function seedToastMachineKeys() {
  const app = db.prepare("SELECT id FROM apps WHERE slug = ?").get("toastmachine");
  if (!app) {
    console.error("ToastMachine app not found");
    process.exit(1);
  }

  const count = db.prepare("SELECT COUNT(*) as c FROM license_keys WHERE app_id = ?").get(app.id).c;
  if (count > 0) {
    console.log(`ToastMachine already has ${count} keys, skipping seed.`);
    return;
  }

  const keysFile = path.join(__dirname, "..", "keys.txt");
  const fallbackKeysFile = path.join(__dirname, "..", "..", "src-tauri", "keys.txt");
  let keys = [];
  for (const file of [keysFile, fallbackKeysFile]) {
    if (fs.existsSync(file)) {
      keys = fs
        .readFileSync(file, "utf-8")
        .split("\n")
        .map((s) => s.trim().toUpperCase())
        .filter((s) => s.length > 0);
      if (keys.length > 0) break;
    }
  }

  if (keys.length === 0) {
    console.warn("No keys found in src-tauri/keys.txt, generating 100 random keys for ToastMachine.");
    const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
    while (keys.length < 100) {
      let key = "TOAST-";
      for (let s = 0; s < 4; s++) {
        let part = "";
        for (let i = 0; i < 4; i++) {
          part += alphabet[Math.floor(Math.random() * alphabet.length)];
        }
        key += part + (s < 3 ? "-" : "");
      }
      if (!keys.includes(key)) keys.push(key);
    }
  }

  const insert = db.prepare("INSERT INTO license_keys (app_id, key) VALUES (?, ?)");
  const insertMany = db.transaction((klist) => {
    for (const k of klist) insert.run(app.id, k);
  });
  insertMany(keys);
  console.log(`Seeded ${keys.length} keys for ToastMachine.`);
}

function seedAdmin() {
  const username = process.env.ADMIN_USERNAME || "admin";
  const hash = process.env.ADMIN_PASSWORD_HASH;
  if (!hash) {
    console.warn("ADMIN_PASSWORD_HASH not set, skipping admin seed.");
    return;
  }
  db.prepare("INSERT OR IGNORE INTO admins (username, password_hash) VALUES (?, ?)").run(
    username,
    hash
  );
}

seedApps();
seedToastMachineKeys();
seedAdmin();
console.log("Initialization complete.");
