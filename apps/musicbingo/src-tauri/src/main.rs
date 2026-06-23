mod game;
mod online_license;
mod playlist;
mod server;

use std::path::PathBuf;
use std::sync::{Arc, Mutex};

use online_license::{activate, clear_license, verify};
use rand::seq::SliceRandom;
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use tauri::{Manager, State};

use crate::playlist::db::PlaylistStore;
use crate::server::state::AppState;

struct LicenseState {
    app_data_dir: Mutex<PathBuf>,
}

struct ServerState {
    url: Mutex<Option<String>>,
}

#[tauri::command]
fn license_activate(
    state: State<'_, LicenseState>,
    key: String,
    fingerprint: String,
) -> Result<Value, String> {
    let dir = state.app_data_dir.lock().map_err(|e| e.to_string())?;
    activate(&dir, &key, &fingerprint)
}

#[tauri::command]
fn license_verify(state: State<'_, LicenseState>, fingerprint: String) -> Result<Value, String> {
    let dir = state.app_data_dir.lock().map_err(|e| e.to_string())?;
    verify(&dir, &fingerprint)
}

#[tauri::command]
fn license_logout(state: State<'_, LicenseState>) -> Result<(), String> {
    let dir = state.app_data_dir.lock().map_err(|e| e.to_string())?;
    clear_license(&dir)
}

#[tauri::command]
fn get_machine_fingerprint() -> Result<String, String> {
    let uid = machine_uid::get().unwrap_or_default();
    let user = whoami::username();
    let raw = format!("{}|{}|musicbingo-v1", uid, user);
    let mut hasher = Sha256::new();
    hasher.update(raw.as_bytes());
    let hash = hex::encode(hasher.finalize());
    Ok(format!("fp1.{}", hash))
}

#[tauri::command]
fn get_server_url(state: State<'_, ServerState>) -> Result<Option<String>, String> {
    let url = state.url.lock().map_err(|e| e.to_string())?;
    Ok(url.clone())
}

#[tauri::command]
fn set_game_config(
    state: State<'_, Arc<AppState>>,
    host_name: String,
    room_code: String,
    total_rounds: usize,
) -> Result<(), String> {
    let mut config = state.config.write().map_err(|e| e.to_string())?;
    config.host_name = host_name;
    config.room_code = room_code;
    config.total_rounds = total_rounds;
    Ok(())
}

#[tauri::command]
fn get_players(state: State<'_, Arc<AppState>>) -> Result<Value, String> {
    let players = state.players.read().map_err(|e| e.to_string())?;
    let list: Vec<_> = players.values().cloned().collect();
    Ok(serde_json::to_value(list).map_err(|e| e.to_string())?)
}

#[tauri::command]
fn get_game_state(state: State<'_, Arc<AppState>>) -> Result<Value, String> {
    let phase = state.phase.read().map_err(|e| e.to_string())?;
    let round = state.current_round.read().map_err(|e| e.to_string())?;
    let config = state.config.read().map_err(|e| e.to_string())?;
    let track = state.current_track.read().map_err(|e| e.to_string())?;
    Ok(json!({
        "phase": format!("{:?}", *phase).to_lowercase(),
        "round": *round,
        "config": *config,
        "current_track": *track,
    }))
}

#[tauri::command]
fn create_playlist(state: State<'_, Arc<AppState>>, name: String) -> Result<Value, String> {
    let store = get_playlist_store(&state)?;
    let id = store.create_playlist(&name).map_err(|e| e.to_string())?;
    Ok(json!({"id": id}))
}

#[tauri::command]
fn list_playlists(state: State<'_, Arc<AppState>>) -> Result<Value, String> {
    let store = get_playlist_store(&state)?;
    let list = store.list_playlists().map_err(|e| e.to_string())?;
    Ok(serde_json::to_value(list).map_err(|e| e.to_string())?)
}

fn get_playlist_store(_state: &Arc<AppState>) -> Result<PlaylistStore, String> {
    let app_data_dir = dirs::data_dir()
        .ok_or("data dir not found")?
        .join("com.eventsoft.musicbingo");
    std::fs::create_dir_all(&app_data_dir).map_err(|e| e.to_string())?;
    PlaylistStore::open(app_data_dir.join("playlists.db")).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_playlist_tracks(state: State<'_, Arc<AppState>>, playlist_id: i64) -> Result<Value, String> {
    let store = get_playlist_store(&state)?;
    let tracks = store.get_tracks(playlist_id).map_err(|e| e.to_string())?;
    Ok(serde_json::to_value(tracks).map_err(|e| e.to_string())?)
}

#[tauri::command]
fn delete_track(state: State<'_, Arc<AppState>>, track_id: i64) -> Result<(), String> {
    let store = get_playlist_store(&state)?;
    store.delete_track(track_id).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn delete_playlist(state: State<'_, Arc<AppState>>, playlist_id: i64) -> Result<(), String> {
    let store = get_playlist_store(&state)?;
    store.delete_playlist(playlist_id).map_err(|e| e.to_string())?;
    Ok(())
}

#[derive(serde::Deserialize)]
struct ImportTrack {
    path: String,
    title: String,
    artist: String,
    duration_seconds: i64,
}

#[tauri::command]
fn import_tracks(
    state: State<'_, Arc<AppState>>,
    playlist_id: i64,
    files: Vec<ImportTrack>,
) -> Result<Value, String> {
    let app_data_dir = dirs::data_dir()
        .ok_or("data dir not found")?
        .join("com.eventsoft.musicbingo");
    let music_dir = app_data_dir.join("music").join(playlist_id.to_string());
    std::fs::create_dir_all(&music_dir).map_err(|e| e.to_string())?;

    let store = get_playlist_store(&state)?;
    let mut imported = Vec::new();

    for file in files {
        let src = PathBuf::from(&file.path);
        if !src.exists() {
            continue;
        }
        let ext = src
            .extension()
            .and_then(|s| s.to_str())
            .unwrap_or("mp3")
            .to_lowercase();
        let file_name = format!(
            "{}_{}.{}",
            uuid::Uuid::new_v4().to_string().replace("-", ""),
            sanitize_filename(&file.title),
            ext
        );
        let dest = music_dir.join(&file_name);
        std::fs::copy(&src, &dest).map_err(|e| e.to_string())?;

        let id = store
            .add_track(
                playlist_id,
                &file.title,
                &file.artist,
                dest.to_string_lossy().as_ref(),
                file.duration_seconds,
            )
            .map_err(|e| e.to_string())?;
        imported.push(json!({"id": id, "title": file.title, "artist": file.artist}));
    }

    Ok(json!({"imported": imported}))
}

#[tauri::command]
fn start_round(
    state: State<'_, Arc<AppState>>,
    pattern: String,
    round_number: usize,
) -> Result<(), String> {
    use crate::game::patterns::Pattern;
    let pattern: Pattern = serde_json::from_str(&format!("\"{}\"", pattern))
        .map_err(|_| "Unknown pattern".to_string())?;

    let tracks = state.available_tracks.read().map_err(|e| e.to_string())?;
    if tracks.len() < 25 {
        return Err("Недостаточно треков для игры".into());
    }

    let mut queue: Vec<i64> = tracks.iter().map(|t| t.id).collect();
    queue.shuffle(&mut rand::thread_rng());

    let mut round = state.current_round.write().map_err(|e| e.to_string())?;
    *round = crate::server::state::RoundState {
        round_number,
        pattern: Some(pattern),
        tracks_queue: queue,
        current_track_index: None,
        finished: false,
    };

    *state.current_track.write().map_err(|e| e.to_string())? = None;
    *state.phase.write().map_err(|e| e.to_string())? = crate::server::state::GamePhase::RoundIntro;
    Ok(())
}

#[tauri::command]
fn next_track(state: State<'_, Arc<AppState>>) -> Result<Value, String> {
    let mut round = state.current_round.write().map_err(|e| e.to_string())?;
    let next_idx = round.current_track_index.map(|i| i + 1).unwrap_or(0);
    if next_idx >= round.tracks_queue.len() {
        return Err("Все треки раунда сыграны".into());
    }
    let track_id = round.tracks_queue[next_idx];
    round.current_track_index = Some(next_idx);

    let tracks = state.available_tracks.read().map_err(|e| e.to_string())?;
    let track = tracks.iter().find(|t| t.id == track_id).cloned();

    *state.phase.write().map_err(|e| e.to_string())? = crate::server::state::GamePhase::Playing;

    let started_at = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);

    if let Some(t) = track {
        let current = crate::server::state::CurrentTrack {
            track_id: t.id,
            title: t.title.clone(),
            artist: t.artist.clone(),
            started_at,
        };
        *state.current_track.write().map_err(|e| e.to_string())? = Some(current.clone());
        Ok(serde_json::to_value(&current).map_err(|e| e.to_string())?)
    } else {
        Err("Трек не найден".into())
    }
}

#[tauri::command]
fn end_round(state: State<'_, Arc<AppState>>) -> Result<(), String> {
    let mut round = state.current_round.write().map_err(|e| e.to_string())?;
    round.finished = true;
    {
        let mut history = state.rounds_history.write().map_err(|e| e.to_string())?;
        history.push(round.clone());
    }
    *state.phase.write().map_err(|e| e.to_string())? = crate::server::state::GamePhase::RoundOver;
    Ok(())
}

#[tauri::command]
fn reset_game(state: State<'_, Arc<AppState>>) -> Result<(), String> {
    *state.phase.write().map_err(|e| e.to_string())? = crate::server::state::GamePhase::Lobby;
    *state.players.write().map_err(|e| e.to_string())? = std::collections::HashMap::new();
    *state.current_round.write().map_err(|e| e.to_string())? = crate::server::state::RoundState::default();
    *state.current_track.write().map_err(|e| e.to_string())? = None;
    *state.rounds_history.write().map_err(|e| e.to_string())? = Vec::new();
    *state.winners.write().map_err(|e| e.to_string())? = Vec::new();
    Ok(())
}

#[tauri::command]
fn generate_qr(text: String) -> Result<String, String> {
    use qrcode::QrCode;
    use qrcode::render::svg;
    let code = QrCode::new(text).map_err(|e| e.to_string())?;
    let image = code
        .render()
        .min_dimensions(200, 200)
        .dark_color(svg::Color("#000000"))
        .light_color(svg::Color("#ffffff"))
        .build();
    Ok(format!("data:image/svg+xml;base64,{}", base64::Engine::encode(&base64::engine::general_purpose::STANDARD, image)))
}

#[tauri::command]
fn confirm_bingo(state: State<'_, Arc<AppState>>, player_id: String) -> Result<Value, String> {
    let mut players = state.players.write().map_err(|e| e.to_string())?;
    if let Some(player) = players.get_mut(&player_id) {
        let valid = if let Some(card) = &player.card {
            let round = state.current_round.read().map_err(|e| e.to_string())?;
            if let Some(pattern) = &round.pattern {
                pattern.check(&card.marked_array())
            } else {
                false
            }
        } else {
            false
        };
        player.bingo_claimed = true;
        if valid {
            player.bingo_confirmed = true;
            drop(players);
            state.winners.write().map_err(|e| e.to_string())?.push(player_id);
        }
        return Ok(json!({"valid": valid}));
    }
    Err("Игрок не найден".into())
}

#[tauri::command]
fn set_game_playlist(state: State<'_, Arc<AppState>>, playlist_id: i64) -> Result<(), String> {
    let store = get_playlist_store(&state)?;
    let tracks = store.get_tracks(playlist_id).map_err(|e| e.to_string())?;
    if tracks.len() < 25 {
        return Err("В плейлисте должно быть не менее 25 треков".into());
    }
    *state.available_tracks.write().map_err(|e| e.to_string())? = tracks;
    Ok(())
}

fn sanitize_filename(name: &str) -> String {
    name.chars()
        .map(|c| if c.is_alphanumeric() || c == ' ' { c } else { '_' })
        .collect::<String>()
        .replace(' ', "_")
        .to_lowercase()
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            let app_data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
            std::fs::create_dir_all(&app_data_dir).map_err(|e| e.to_string())?;

            app.manage(LicenseState {
                app_data_dir: Mutex::new(app_data_dir.clone()),
            });

            let game_state = AppState::new();
            app.manage(game_state.clone());

            let server_url_state = Arc::new(ServerState {
                url: Mutex::new(None),
            });
            app.manage(server_url_state.clone());

            tauri::async_runtime::spawn(async move {
                match server::start_server(game_state, 8765).await {
                    Ok((url, _port)) => {
                        println!("MusicBingo server started at {}", url);
                        if let Ok(mut lock) = server_url_state.url.lock() {
                            *lock = Some(url);
                        }
                    }
                    Err(e) => eprintln!("Failed to start server: {}", e),
                }
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            license_activate,
            license_verify,
            license_logout,
            get_machine_fingerprint,
            get_server_url,
            set_game_config,
            get_players,
            get_game_state,
            create_playlist,
            list_playlists,
            import_tracks,
            get_playlist_tracks,
            delete_track,
            delete_playlist,
            set_game_playlist,
            start_round,
            next_track,
            end_round,
            reset_game,
            confirm_bingo,
            generate_qr,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
