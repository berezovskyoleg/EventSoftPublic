/**
 * License and game API adapter.
 */

import { invoke } from "@tauri-apps/api/core";

export interface ActivateResponse {
  ok: boolean;
  key: string;
  activated?: boolean;
  error?: string;
}

export interface VerifyResponse {
  ok: boolean;
  key: string;
  error?: string;
}

export interface Track {
  id: number;
  playlist_id: number;
  title: string;
  artist: string;
  file_path: string;
  duration_seconds: number;
  sort_order: number;
}

export interface Playlist {
  id: number;
  name: string;
  created_at: string;
}

export interface CurrentTrack {
  track_id: number;
  title: string;
  artist: string;
  started_at: number;
}

export interface RoundState {
  round_number: number;
  pattern: string | null;
  tracks_queue: number[];
  current_track_index: number | null;
  finished: boolean;
}

export interface Player {
  id: string;
  name: string;
  bingo_claimed: boolean;
  bingo_confirmed: boolean;
}

export interface GameStateResponse {
  phase: string;
  round: RoundState;
  config: { total_rounds: number; host_name: string; room_code: string };
  current_track: CurrentTrack | null;
}

const APP_SLUG = "musicbingo";

function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export async function licenseActivate(
  key: string,
  fingerprint: string
): Promise<ActivateResponse> {
  if (isTauri()) {
    return invoke<ActivateResponse>("license_activate", { key, fingerprint });
  }
  const res = await fetch("https://soft.eventhunt.ru/api/license/activate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key, fingerprint, app: APP_SLUG }),
  });
  const data = (await res.json()) as ActivateResponse;
  if (!res.ok || !data.ok) {
    throw new Error(data.error || "Не удалось активировать ключ.");
  }
  return data;
}

export async function licenseVerify(
  fingerprint: string
): Promise<VerifyResponse> {
  if (isTauri()) {
    return invoke<VerifyResponse>("license_verify", { fingerprint });
  }
  const res = await fetch("https://soft.eventhunt.ru/api/license/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fingerprint, app: APP_SLUG }),
  });
  const data = (await res.json()) as VerifyResponse;
  if (!res.ok || !data.ok) {
    throw new Error(data.error || "Ключ недействителен на этом устройстве.");
  }
  return data;
}

export async function licenseLogout(): Promise<void> {
  if (isTauri()) {
    await invoke("license_logout");
  }
}

export async function getServerUrl(): Promise<string | null> {
  return invoke("get_server_url");
}

export async function setGameConfig(
  hostName: string,
  roomCode: string,
  totalRounds: number
): Promise<void> {
  return invoke("set_game_config", { hostName, roomCode, totalRounds });
}

export async function listPlaylists(): Promise<Playlist[]> {
  return invoke("list_playlists");
}

export async function createPlaylist(name: string): Promise<{ id: number }> {
  return invoke("create_playlist", { name });
}

export async function deletePlaylist(playlistId: number): Promise<void> {
  return invoke("delete_playlist", { playlistId });
}

export async function getPlaylistTracks(playlistId: number): Promise<Track[]> {
  return invoke("get_playlist_tracks", { playlistId });
}

export async function deleteTrack(trackId: number): Promise<void> {
  return invoke("delete_track", { trackId });
}

export async function importTracks(
  playlistId: number,
  files: { path: string; title: string; artist: string; duration_seconds: number }[]
): Promise<{ imported: { id: number; title: string; artist: string }[] }> {
  return invoke("import_tracks", { playlistId, files });
}

export async function setGamePlaylist(playlistId: number): Promise<void> {
  return invoke("set_game_playlist", { playlistId });
}

export async function startRound(pattern: string, roundNumber: number): Promise<void> {
  return invoke("start_round", { pattern, roundNumber });
}

export async function nextTrack(): Promise<CurrentTrack> {
  return invoke("next_track");
}

export async function endRound(): Promise<void> {
  return invoke("end_round");
}

export async function resetGame(): Promise<void> {
  return invoke("reset_game");
}

export async function getGameState(): Promise<GameStateResponse> {
  return invoke("get_game_state");
}

export async function getPlayers(): Promise<Player[]> {
  return invoke("get_players");
}

export async function confirmBingo(playerId: string): Promise<{ valid: boolean }> {
  return invoke("confirm_bingo", { playerId });
}

export async function generateQr(text: string): Promise<string> {
  return invoke("generate_qr", { text });
}
