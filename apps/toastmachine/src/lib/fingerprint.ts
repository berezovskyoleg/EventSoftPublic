/**
 * Machine fingerprint used to bind a license key to one device.
 *
 * Inside the Tauri desktop shell the fingerprint is computed on the Rust side
 * from the OS machine UID and the current username. It stays the same even
 * after the app is reinstalled, as long as the OS/user account is the same.
 *
 * In a regular browser (dev / web preview) we fall back to browser signals.
 */

import { invoke } from "@tauri-apps/api/core";

async function sha256(text: string): Promise<string> {
  const enc = new TextEncoder().encode(text);
  if (globalThis.crypto?.subtle) {
    const buf = await crypto.subtle.digest("SHA-256", enc);
    return Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }
  // Fallback (very unlikely path): simple non-crypto hash.
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < text.length; i++) {
    const ch = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (h2 >>> 0).toString(16).padStart(8, "0") + (h1 >>> 0).toString(16).padStart(8, "0");
}

function canvasSignature(): string {
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 240;
    canvas.height = 60;
    const ctx = canvas.getContext("2d");
    if (!ctx) return "no-canvas";
    ctx.textBaseline = "top";
    ctx.font = "16px 'Arial'";
    ctx.fillStyle = "#f60";
    ctx.fillRect(10, 10, 100, 30);
    ctx.fillStyle = "#069";
    ctx.fillText("Toast🎰Slot-Machine-Fp-2024", 4, 4);
    ctx.strokeStyle = "rgba(102,204,0,0.7)";
    ctx.arc(60, 30, 22, 0, Math.PI * 2, true);
    ctx.stroke();
    return canvas.toDataURL();
  } catch {
    return "canvas-blocked";
  }
}

function webglSignature(): string {
  try {
    const canvas = document.createElement("canvas");
    const gl =
      (canvas.getContext("webgl") as WebGLRenderingContext | null) ||
      (canvas.getContext("experimental-webgl") as WebGLRenderingContext | null);
    if (!gl) return "no-webgl";
    const dbg = gl.getExtension("WEBGL_debug_renderer_info");
    const vendor = dbg ? gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR);
    const renderer = dbg
      ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)
      : gl.getParameter(gl.RENDERER);
    return `${vendor}~${renderer}`;
  } catch {
    return "webgl-blocked";
  }
}

function audioSignature(): string {
  try {
    const AC =
      (window as unknown as { OfflineAudioContext?: typeof OfflineAudioContext })
        .OfflineAudioContext ||
      (window as unknown as { webkitOfflineAudioContext?: typeof OfflineAudioContext })
        .webkitOfflineAudioContext;
    if (!AC) return "no-audio";
    // We don't actually render (keeps it sync & fast); the mere presence +
    // sampleRate/channelCount is enough signal.
    const ctx = new AC(1, 1, 44100);
    return `${ctx.sampleRate}-${ctx.destination.channelCount}`;
  } catch {
    return "audio-blocked";
  }
}

function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export async function getMachineFingerprint(): Promise<string> {
  if (isTauri()) {
    try {
      return await invoke<string>("get_machine_fingerprint");
    } catch {
      // Fall through to browser-based fingerprint if Rust command fails.
    }
  }

  const nav = navigator as Navigator & {
    deviceMemory?: number;
    connection?: { effectiveType?: string; downlink?: number };
  };
  const screen = window.screen;
  const signals: string[] = [];

  signals.push(`ua:${nav.userAgent}`);
  signals.push(`lang:${nav.language}|${nav.languages.join(",")}`);
  signals.push(`plat:${nav.platform}`);
  signals.push(`cores:${nav.hardwareConcurrency || "?"}`);
  signals.push(`mem:${nav.deviceMemory ?? "?"}`);
  signals.push(`screen:${screen.width}x${screen.height}x${screen.colorDepth}|dpr:${window.devicePixelRatio}`);
  signals.push(`tz:${Intl.DateTimeFormat().resolvedOptions().timeZone}`);
  signals.push(`touch:${("ontouchstart" in window) ? 1 : 0}`);
  signals.push(`net:${nav.connection?.effectiveType ?? "?"}|${nav.connection?.downlink ?? "?"}`);
  signals.push(`canvas:${canvasSignature()}`);
  signals.push(`webgl:${webglSignature()}`);
  signals.push(`audio:${audioSignature()}`);

  // Tiny extra salt tied to the install so two apps on the same browser differ.
  signals.push(`app:toast-slot-machine-v1`);

  const raw = signals.join("||");
  const hash = await sha256(raw);
  // Prefix so server can sanity-check shape.
  return `fp1.${hash}`;
}
