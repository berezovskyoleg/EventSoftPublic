import type { Track } from "./types";

export interface FileSystemDirectoryHandle {
  kind: "directory";
  name: string;
  values(): AsyncIterable<
    | { kind: "file"; name: string; getFile(): Promise<File> }
    | { kind: "directory"; name: string }
  >;
}

declare global {
  interface Window {
    showDirectoryPicker?(): Promise<FileSystemDirectoryHandle>;
  }
}

export function supportsDirectoryPicker(): boolean {
  return typeof window.showDirectoryPicker === "function";
}

export async function pickMusicFolder(): Promise<Track[]> {
  if (!window.showDirectoryPicker) {
    throw new Error("Ваш браузер не поддерживает выбор папки. Используйте Chrome или Edge.");
  }
  const dirHandle = await window.showDirectoryPicker();
  const tracks: Track[] = [];
  for await (const entry of dirHandle.values()) {
    if (entry.kind === "file" && entry.name.toLowerCase().endsWith(".mp3")) {
      const file = await entry.getFile();
      tracks.push({
        id: Math.random().toString(36).slice(2) + Date.now().toString(36),
        title: file.name.replace(/\.mp3$/i, ""),
        artist: "",
        file,
        durationSeconds: 30,
      });
    }
  }
  return tracks.sort((a, b) => a.title.localeCompare(b.title));
}

export async function pickMusicFiles(): Promise<Track[]> {
  return new Promise((resolve, reject) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "audio/mp3,audio/mpeg";
    input.multiple = true;
    input.onchange = async () => {
      if (!input.files) return resolve([]);
      const tracks: Track[] = [];
      for (const file of Array.from(input.files)) {
        if (file.name.toLowerCase().endsWith(".mp3")) {
          tracks.push({
            id: Math.random().toString(36).slice(2) + Date.now().toString(36),
            title: file.name.replace(/\.mp3$/i, ""),
            artist: "",
            file,
            durationSeconds: 30,
          });
        }
      }
      resolve(tracks);
    };
    input.onerror = () => reject(new Error("Не удалось выбрать файлы"));
    input.click();
  });
}
