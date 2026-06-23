import { invoke } from "@tauri-apps/api/core";

export async function getMachineFingerprint(): Promise<string> {
  if (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window) {
    return invoke<string>("get_machine_fingerprint");
  }

  // Browser fallback: stable-ish fingerprint from user agent + screen + locale.
  const raw = [
    navigator.userAgent,
    navigator.language,
    screen.width,
    screen.height,
    new Date().getTimezoneOffset(),
    navigator.hardwareConcurrency ?? "",
  ].join("|");

  const encoder = new TextEncoder();
  const data = encoder.encode(raw);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hash = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  return `fp1.${hash}`;
}
