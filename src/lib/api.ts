/**
 * API adapter that works both in a browser (dev / standalone web server)
 * and inside the Tauri desktop shell.
 *
 * In Tauri the backend is handled by Rust commands; in a browser we fall back
 * to the Next.js API routes.
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
  const res = await fetch("/api/license/activate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key, fingerprint }),
  });
  const data = (await res.json()) as ActivateResponse;
  if (!res.ok || !data.ok) {
    throw new Error(data.error || "Не удалось активировать ключ.");
  }
  return data;
}

export async function licenseVerify(
  key: string,
  fingerprint: string
): Promise<VerifyResponse> {
  if (isTauri()) {
    return invoke<VerifyResponse>("license_verify", { key, fingerprint });
  }
  const res = await fetch("/api/license/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key, fingerprint }),
  });
  const data = (await res.json()) as VerifyResponse;
  if (!res.ok || !data.ok) {
    throw new Error(data.error || "Ключ недействителен на этом устройстве.");
  }
  return data;
}
