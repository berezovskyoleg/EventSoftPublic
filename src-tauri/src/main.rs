mod online_license;

use online_license::{activate, clear_license, verify};
use serde_json::Value;
use sha2::{Digest, Sha256};
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{Manager, State};

struct AppState {
    app_data_dir: Mutex<PathBuf>,
}

#[tauri::command]
fn license_activate(
    state: State<'_, AppState>,
    key: String,
    fingerprint: String,
) -> Result<Value, String> {
    let dir = state.app_data_dir.lock().map_err(|e| e.to_string())?;
    activate(&dir, &key, &fingerprint)
}

#[tauri::command]
fn license_verify(state: State<'_, AppState>, fingerprint: String) -> Result<Value, String> {
    let dir = state.app_data_dir.lock().map_err(|e| e.to_string())?;
    verify(&dir, &fingerprint)
}

#[tauri::command]
fn license_logout(state: State<'_, AppState>) -> Result<(), String> {
    let dir = state.app_data_dir.lock().map_err(|e| e.to_string())?;
    clear_license(&dir)
}

#[tauri::command]
fn get_machine_fingerprint() -> Result<String, String> {
    let uid = machine_uid::get().unwrap_or_default();
    let user = whoami::username();
    let raw = format!("{}|{}|toast-slot-v1", uid, user);
    let mut hasher = Sha256::new();
    hasher.update(raw.as_bytes());
    let hash = hex::encode(hasher.finalize());
    Ok(format!("fp1.{}", hash))
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            let app_data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
            app.manage(AppState {
                app_data_dir: Mutex::new(app_data_dir),
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            license_activate,
            license_verify,
            license_logout,
            get_machine_fingerprint,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
