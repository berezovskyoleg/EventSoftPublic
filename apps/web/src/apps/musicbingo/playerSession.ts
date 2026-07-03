const PLAYER_ID_KEY = "musicbingo_player_id";
const PLAYER_NAME_KEY = "musicbingo_player_name";
const PLAYER_MARKS_KEY = "musicbingo_player_marks";

export function getOrCreatePlayerId(): string {
  let id = localStorage.getItem(PLAYER_ID_KEY);
  if (!id) {
    id = Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem(PLAYER_ID_KEY, id);
  }
  return id;
}

export function getStoredPlayerName(): string {
  return localStorage.getItem(PLAYER_NAME_KEY) || "";
}

export function storePlayerName(name: string) {
  localStorage.setItem(PLAYER_NAME_KEY, name);
}

export function clearPlayerSession() {
  localStorage.removeItem(PLAYER_ID_KEY);
  localStorage.removeItem(PLAYER_NAME_KEY);
  localStorage.removeItem(PLAYER_MARKS_KEY);
}

export function loadMarkedIds(): Set<string> {
  try {
    const raw = localStorage.getItem(PLAYER_MARKS_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw));
  } catch {
    return new Set();
  }
}

export function saveMarkedIds(markedIds: Set<string>) {
  localStorage.setItem(PLAYER_MARKS_KEY, JSON.stringify(Array.from(markedIds)));
}
