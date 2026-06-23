/**
 * License API adapter.
 *
 * In the Tauri desktop shell the backend talks directly to the online license
 * server and stores a signed offline token locally.
 * In a regular browser we fall back to the remote server API.
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
  const res = await fetch("https://soft.eventhunt.ru/api/license/activate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key, fingerprint, app: "toastmachine" }),
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
    body: JSON.stringify({ fingerprint, app: "toastmachine" }),
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
