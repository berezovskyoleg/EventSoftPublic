use jsonwebtoken::{decode, errors::Error as JwtError, Algorithm, DecodingKey, Validation};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sha2::{Digest, Sha256};
use std::fs;
use std::path::{Path, PathBuf};

const LICENSE_SERVER_URL: &str = "https://soft.eventhunt.ru";
const APP_SLUG: &str = "musicbingo";
const PUBLIC_KEY_PEM: &str = include_str!("license_public.pem");

#[derive(Debug, Serialize, Deserialize)]
struct LicenseClaims {
    key: String,
    fingerprint: String,
    app: String,
    exp: Option<usize>,
}

#[derive(Debug, Serialize, Deserialize)]
struct ActivatePayload {
    key: String,
    fingerprint: String,
    app: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct ActivateServerResponse {
    ok: bool,
    #[serde(default)]
    activated: bool,
    #[serde(default)]
    key: String,
    #[serde(default)]
    token: String,
    #[serde(default)]
    error: Option<String>,
}

fn license_token_path(app_data_dir: &Path) -> PathBuf {
    app_data_dir.join("musicbingo.license")
}

fn hash_fingerprint(raw: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(raw.as_bytes());
    hex::encode(hasher.finalize())
}

fn verify_token(token: &str, raw_fp: &str) -> Result<LicenseClaims, String> {
    let fp_hash = hash_fingerprint(raw_fp);
    let validation = Validation::new(Algorithm::RS256);

    let decoded = decode::<LicenseClaims>(
        token,
        &DecodingKey::from_rsa_pem(PUBLIC_KEY_PEM.as_bytes()).map_err(|e| e.to_string())?,
        &validation,
    )
    .map_err(|e: JwtError| format!("Недействительная лицензия: {}", e))?;

    if decoded.claims.app != APP_SLUG {
        return Err("Лицензия предназначена для другого приложения.".into());
    }
    if decoded.claims.fingerprint != fp_hash {
        return Err("Лицензия привязана к другому устройству.".into());
    }

    Ok(decoded.claims)
}

pub fn activate(
    app_data_dir: &Path,
    raw_key: &str,
    raw_fp: &str,
) -> Result<Value, String> {
    if raw_key.trim().is_empty() {
        return Err("Введите лицензионный ключ.".into());
    }
    if raw_fp.len() < 16 {
        return Err("Не удалось определить устройство.".into());
    }

    let payload = ActivatePayload {
        key: raw_key.trim().to_uppercase(),
        fingerprint: raw_fp.to_string(),
        app: APP_SLUG.to_string(),
    };

    let url = format!("{}/api/license/activate", LICENSE_SERVER_URL);
    let response: ActivateServerResponse = ureq::post(&url)
        .set("Content-Type", "application/json")
        .send_json(&payload)
        .map_err(|e| format!("Ошибка связи с сервером лицензий: {}", e))?
        .into_json()
        .map_err(|e| format!("Некорректный ответ сервера: {}", e))?;

    if !response.ok {
        return Err(response.error.unwrap_or_else(|| "Ошибка активации.".into()));
    }

    if response.token.is_empty() {
        return Err("Сервер не вернул лицензионный токен.".into());
    }

    // Validate the token before saving it.
    let claims = verify_token(&response.token, raw_fp)?;

    fs::create_dir_all(app_data_dir).map_err(|e| e.to_string())?;
    fs::write(license_token_path(app_data_dir), &response.token).map_err(|e| e.to_string())?;

    Ok(serde_json::json!({
        "ok": true,
        "activated": response.activated,
        "key": claims.key,
    }))
}

pub fn verify(app_data_dir: &Path, raw_fp: &str) -> Result<Value, String> {
    if raw_fp.len() < 16 {
        return Err("Не удалось определить устройство.".into());
    }

    let token = match fs::read_to_string(license_token_path(app_data_dir)) {
        Ok(t) => t,
        Err(_) => return Err("Лицензия не активирована.".into()),
    };

    let claims = verify_token(&token, raw_fp)?;

    Ok(serde_json::json!({
        "ok": true,
        "key": claims.key,
    }))
}

pub fn clear_license(app_data_dir: &Path) -> Result<(), String> {
    let path = license_token_path(app_data_dir);
    if path.exists() {
        fs::remove_file(path).map_err(|e| e.to_string())?;
    }
    Ok(())
}
