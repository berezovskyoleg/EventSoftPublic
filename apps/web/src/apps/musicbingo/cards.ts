import type { CardCell, Track } from "./types";

const CARD_SIZE = 25;

export function generateCard(tracks: Track[]): CardCell[] {
  if (tracks.length < CARD_SIZE) {
    throw new Error("Недостаточно треков для генерации карточки");
  }
  const shuffled = [...tracks].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, CARD_SIZE).map((t) => ({
    trackId: t.id,
    title: t.title,
    artist: t.artist,
    marked: false,
  }));
}

export function checkPattern(pattern: string, marked: boolean[]): boolean {
  if (marked.length !== 25) return false;

  const rows: number[][] = [];
  for (let r = 0; r < 5; r++) {
    rows.push(Array.from({ length: 5 }, (_, c) => r * 5 + c));
  }
  const cols: number[][] = [];
  for (let c = 0; c < 5; c++) {
    cols.push(Array.from({ length: 5 }, (_, r) => r * 5 + c));
  }
  const diag1 = [0, 6, 12, 18, 24];
  const diag2 = [4, 8, 12, 16, 20];
  const corners = [0, 4, 20, 24];
  const all = Array.from({ length: 25 }, (_, i) => i);

  switch (pattern) {
    case "line_horizontal":
      return rows.some((line) => line.every((i) => marked[i]));
    case "line_vertical":
      return cols.some((line) => line.every((i) => marked[i]));
    case "two_lines": {
      let completed = 0;
      const lines = [...rows, ...cols];
      for (const line of lines) {
        if (line.every((i) => marked[i])) completed++;
      }
      return completed >= 2;
    }
    case "three_lines": {
      let completed = 0;
      const lines = [...rows, ...cols];
      for (const line of lines) {
        if (line.every((i) => marked[i])) completed++;
      }
      return completed >= 3;
    }
    case "four_corners":
      return corners.every((i) => marked[i]);
    case "x":
      return diag1.every((i) => marked[i]) && diag2.every((i) => marked[i]);
    case "full_house":
      return all.every((i) => marked[i]);
    default:
      return false;
  }
}
