use chrono::Utc;
use rand::Rng;
use rusqlite::{Connection, OptionalExtension};
use serde_json::Value;
use sha2::{Digest, Sha256};
use std::path::{Path, PathBuf};

const KEY_ALPHABET: &[u8] = b"ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const SEGMENT_LENGTH: usize = 4;
const SEGMENT_COUNT: usize = 4;
const TARGET_KEYS: usize = 100;

pub struct LicenseStore {
    db_path: PathBuf,
}

#[allow(dead_code)]
impl LicenseStore {
    pub fn new(app_data_dir: &Path) -> Result<Self, String> {
        std::fs::create_dir_all(app_data_dir).map_err(|e| e.to_string())?;
        let db_path = app_data_dir.join("toast_slot.db");
        Self::open(&db_path)
    }

    pub fn open(db_path: &Path) -> Result<Self, String> {
        if let Some(parent) = db_path.parent() {
            std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
        let store = Self {
            db_path: db_path.to_path_buf(),
        };
        store.init()?;
        store.ensure_keys()?;
        Ok(store)
    }

    fn conn(&self) -> Result<Connection, String> {
        Connection::open(&self.db_path).map_err(|e| e.to_string())
    }

    fn init(&self) -> Result<(), String> {
        let conn = self.conn()?;
        conn.execute(
            "CREATE TABLE IF NOT EXISTS license_keys (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                key TEXT NOT NULL UNIQUE,
                machine_fingerprint TEXT,
                activated_at TEXT,
                last_verified_at TEXT,
                is_active INTEGER NOT NULL DEFAULT 1,
                created_at TEXT NOT NULL DEFAULT (datetime('now'))
            )",
            [],
        )
        .map_err(|e| e.to_string())?;
        Ok(())
    }

    fn ensure_keys(&self) -> Result<(), String> {
        let conn = self.conn()?;
        let count: usize = conn
            .query_row("SELECT COUNT(*) FROM license_keys", [], |row| row.get(0))
            .map_err(|e| e.to_string())?;

        if count >= TARGET_KEYS {
            return Ok(());
        }

        let missing = TARGET_KEYS - count;
        let existing: Vec<String> = conn
            .prepare("SELECT key FROM license_keys")
            .map_err(|e| e.to_string())?
            .query_map([], |row| row.get(0))
            .map_err(|e| e.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())?;

        // Load a fixed pool of keys shipped with the application so every
        // installation uses the same license key list.
        let fixed_keys: Vec<String> = include_str!("../keys.txt")
            .lines()
            .map(|s| s.trim().to_uppercase())
            .filter(|s| !s.is_empty())
            .collect();

        let mut new_keys = Vec::with_capacity(missing);
        for key in fixed_keys {
            if existing.contains(&key) || new_keys.contains(&key) {
                continue;
            }
            new_keys.push(key);
            if new_keys.len() >= missing {
                break;
            }
        }

        // Fallback to generated keys only if the bundled pool is exhausted.
        let mut guard = 0;
        while new_keys.len() < missing && guard < missing * 50 {
            guard += 1;
            let key = generate_license_key();
            if existing.contains(&key) || new_keys.contains(&key) {
                continue;
            }
            new_keys.push(key);
        }

        let mut stmt = conn
            .prepare("INSERT INTO license_keys (key) VALUES (?1)")
            .map_err(|e| e.to_string())?;
        for key in &new_keys {
            stmt.execute([key]).map_err(|e| e.to_string())?;
        }
        drop(stmt);

        Ok(())
    }

    pub fn activate(&self, raw_key: &str, raw_fp: &str) -> Result<Value, String> {
        let key = normalize_key(raw_key);
        if key.is_empty() {
            return Err("Введите лицензионный ключ.".into());
        }
        if raw_fp.len() < 16 {
            return Err("Не удалось определить устройство.".into());
        }
        let fp_hash = hash_fingerprint(raw_fp);

        let conn = self.conn()?;
        let row: Option<(i64, Option<String>, bool)> = conn
            .query_row(
                "SELECT id, machine_fingerprint, is_active FROM license_keys WHERE key = ?1",
                [&key],
                |row| Ok((row.get(0)?, row.get(1)?, row.get::<_, i64>(2)? != 0)),
            )
            .optional()
            .map_err(|e| e.to_string())?;

        let (id, machine_fp, is_active) = match row {
            Some(r) => r,
            None => return Err("Лицензионный ключ не найден.".into()),
        };

        if !is_active {
            return Err("Этот лицензионный ключ был отозван. Обратитесь к продавцу.".into());
        }

        let now = Utc::now().to_rfc3339();

        if machine_fp.is_none() {
            conn.execute(
                "UPDATE license_keys SET machine_fingerprint = ?1, activated_at = ?2, last_verified_at = ?2 WHERE id = ?3",
                [&fp_hash, &now, &id.to_string()],
            )
            .map_err(|e| e.to_string())?;
            return Ok(serde_json::json!({
                "ok": true,
                "activated": true,
                "key": key,
            }));
        }

        if machine_fp.as_ref().unwrap() != &fp_hash {
            return Err("Этот ключ уже привязан к другому устройству и не может быть использован здесь.".into());
        }

        conn.execute(
            "UPDATE license_keys SET last_verified_at = ?1 WHERE id = ?2",
            [&now, &id.to_string()],
        )
        .map_err(|e| e.to_string())?;

        Ok(serde_json::json!({
            "ok": true,
            "activated": false,
            "key": key,
        }))
    }

    pub fn verify(&self, raw_key: &str, raw_fp: &str) -> Result<Value, String> {
        let key = normalize_key(raw_key);
        if key.is_empty() || raw_fp.len() < 16 {
            return Err("Неверный формат запроса.".into());
        }
        let fp_hash = hash_fingerprint(raw_fp);

        let conn = self.conn()?;
        let row: Option<(i64, Option<String>, bool)> = conn
            .query_row(
                "SELECT id, machine_fingerprint, is_active FROM license_keys WHERE key = ?1",
                [&key],
                |row| Ok((row.get(0)?, row.get(1)?, row.get::<_, i64>(2)? != 0)),
            )
            .optional()
            .map_err(|e| e.to_string())?;

        let (id, machine_fp, is_active) = match row {
            Some(r) => r,
            None => return Err("Ключ не найден.".into()),
        };

        if !is_active {
            return Err("Ключ отозван.".into());
        }

        match machine_fp {
            Some(fp) if fp == fp_hash => {
                let now = Utc::now().to_rfc3339();
                conn.execute(
                    "UPDATE license_keys SET last_verified_at = ?1 WHERE id = ?2",
                    [&now, &id.to_string()],
                )
                .map_err(|e| e.to_string())?;
                Ok(serde_json::json!({ "ok": true, "key": key }))
            }
            _ => Err("Ключ не привязан к этому устройству.".into()),
        }
    }

    pub fn list_keys(&self) -> Result<Vec<(String, Option<String>, bool)>, String> {
        let conn = self.conn()?;
        let mut stmt = conn
            .prepare("SELECT key, machine_fingerprint, is_active FROM license_keys ORDER BY created_at ASC")
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map([], |row| {
                Ok((row.get::<_, String>(0)?, row.get::<_, Option<String>>(1)?, row.get::<_, i64>(2)? != 0))
            })
            .map_err(|e| e.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())?;
        Ok(rows)
    }

    pub fn set_key_active(&self, key: &str, active: bool) -> Result<(), String> {
        let key = normalize_key(key);
        if key.is_empty() {
            return Err("Укажите ключ.".into());
        }
        let conn = self.conn()?;
        let id: Option<i64> = conn
            .query_row(
                "SELECT id FROM license_keys WHERE key = ?1",
                [&key],
                |row| row.get(0),
            )
            .optional()
            .map_err(|e| e.to_string())?;
        let id = id.ok_or("Ключ не найден.")?;
        let is_active = if active { 1 } else { 0 };
        conn.execute(
            "UPDATE license_keys SET is_active = ?1 WHERE id = ?2",
            [is_active.to_string(), id.to_string()],
        )
        .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn reset_key(&self, key: &str) -> Result<(), String> {
        let key = normalize_key(key);
        if key.is_empty() {
            return Err("Укажите ключ.".into());
        }
        let conn = self.conn()?;
        let updated = conn
            .execute(
                "UPDATE license_keys
                 SET machine_fingerprint = NULL,
                     activated_at = NULL,
                     last_verified_at = NULL,
                     is_active = 1
                 WHERE key = ?1",
                [&key],
            )
            .map_err(|e| e.to_string())?;
        if updated == 0 {
            return Err("Ключ не найден.".into());
        }
        Ok(())
    }

    pub fn reset_all_keys(&self) -> Result<usize, String> {
        let conn = self.conn()?;
        let updated = conn
            .execute(
                "UPDATE license_keys
                 SET machine_fingerprint = NULL,
                     activated_at = NULL,
                     last_verified_at = NULL,
                     is_active = 1",
                [],
            )
            .map_err(|e| e.to_string())?;
        Ok(updated)
    }

    pub fn export_keys(&self, out_path: &Path) -> Result<usize, String> {
        let keys = self.list_keys()?;
        let available = keys.iter().filter(|(_, fp, active)| fp.is_none() && *active).count();
        let activated = keys.iter().filter(|(_, fp, _)| fp.is_some()).count();
        let revoked = keys.iter().filter(|(_, _, active)| !active).count();

        let now = Utc::now().to_rfc3339();
        let mut lines = vec![
            "# ToastMachine — License Keys".to_string(),
            format!("# Total: {} keys", keys.len()),
            format!("# Available: {}", available),
            format!("# Activated: {}", activated),
            format!("# Revoked: {}", revoked),
            format!("# Generated: {}", now),
            String::new(),
        ];

        for (i, (key, fp, active)) in keys.iter().enumerate() {
            let status = if !active {
                "REVOKED"
            } else if fp.is_some() {
                "ACTIVATED"
            } else {
                "AVAILABLE"
            };
            lines.push(format!("{:03}.  {}   [{}]", i + 1, key, status));
        }

        std::fs::write(out_path, lines.join("\n") + "\n").map_err(|e| e.to_string())?;
        Ok(keys.len())
    }
}

fn generate_license_key() -> String {
    let mut rng = rand::thread_rng();
    let mut segments = Vec::with_capacity(SEGMENT_COUNT);
    for _ in 0..SEGMENT_COUNT {
        let mut segment = String::with_capacity(SEGMENT_LENGTH);
        for _ in 0..SEGMENT_LENGTH {
            let idx = rng.gen_range(0..KEY_ALPHABET.len());
            segment.push(KEY_ALPHABET[idx] as char);
        }
        segments.push(segment);
    }
    format!("TOAST-{}", segments.join("-"))
}

fn normalize_key(raw: &str) -> String {
    raw.trim().to_uppercase().replace(|c: char| c.is_whitespace(), "")
}

fn hash_fingerprint(raw: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(raw.as_bytes());
    hex::encode(hasher.finalize())
}
