export interface Track {
  id: string;
  title: string;
  artist: string;
  file: File;
  durationSeconds: number;
}

export interface Playlist {
  id: string;
  name: string;
  tracks: Track[];
}

export interface CardCell {
  trackId: string;
  title: string;
  artist: string;
  marked: boolean;
}

export interface PlayerPublic {
  id: string;
  name: string;
  bingoClaimed: boolean;
  bingoConfirmed: boolean;
}

export interface RoomState {
  phase: "lobby" | "playing" | "roundover" | "gameover";
  roundNumber: number;
  pattern: string | null;
  currentTrackId: string | null;
  currentTrackTitle: string | null;
}

export const PATTERNS = [
  { value: "line_horizontal", label: "Одна линия (горизонталь)" },
  { value: "line_vertical", label: "Одна линия (вертикаль)" },
  { value: "two_lines", label: "Две линии" },
  { value: "three_lines", label: "Три линии" },
  { value: "four_corners", label: "Четыре угла" },
  { value: "x", label: "Буква X" },
  { value: "full_house", label: "Полный дом" },
];

export interface HostConfig {
  hostName: string;
  roomCode: string;
  totalRounds: number;
}
