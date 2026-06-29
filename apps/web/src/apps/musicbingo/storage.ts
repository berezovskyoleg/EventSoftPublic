import type { Playlist } from "./types";

const KEY = "musicbingo_web_playlists_v1";

export function loadPlaylists(): Playlist[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    return JSON.parse(raw).map((p: Playlist) => ({ ...p, tracks: [] }));
  } catch {
    return [];
  }
}

export function savePlaylists(playlists: Playlist[]) {
  // We don't store File objects; only metadata.
  const storable = playlists.map((p) => ({
    id: p.id,
    name: p.name,
    tracks: p.tracks.map((t) => ({
      id: t.id,
      title: t.title,
      artist: t.artist,
      durationSeconds: t.durationSeconds,
    })),
  }));
  localStorage.setItem(KEY, JSON.stringify(storable));
}
