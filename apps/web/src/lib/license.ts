const LICENSE_API = "https://soft.eventhunt.ru/api/license";

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

function getFingerprint(): string {
  const stored = localStorage.getItem("eventsoft_device_id");
  if (stored) return stored;
  const id =
    Math.random().toString(36).slice(2) +
    Date.now().toString(36);
  localStorage.setItem("eventsoft_device_id", id);
  return id;
}

export async function activateKey(
  key: string,
  app: "musicbingo" | "toastmachine"
): Promise<ActivateResponse> {
  const res = await fetch(`${LICENSE_API}/activate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      key,
      app,
      fingerprint: getFingerprint(),
      name: "Web Player",
    }),
  });
  const data = (await res.json()) as ActivateResponse;
  if (!res.ok || !data.ok) {
    throw new Error(data.error || "Не удалось активировать ключ");
  }
  localStorage.setItem(`eventsoft_license_${app}`, key);
  return data;
}

export async function verifyKey(
  app: "musicbingo" | "toastmachine"
): Promise<VerifyResponse> {
  const key = localStorage.getItem(`eventsoft_license_${app}`);
  if (!key) throw new Error("Ключ не найден");
  const res = await fetch(`${LICENSE_API}/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      key,
      app,
      fingerprint: getFingerprint(),
    }),
  });
  const data = (await res.json()) as VerifyResponse;
  if (!res.ok || !data.ok) {
    throw new Error(data.error || "Ключ недействителен");
  }
  return data;
}

export function getStoredKey(app: "musicbingo" | "toastmachine"): string | null {
  return localStorage.getItem(`eventsoft_license_${app}`);
}

export function clearKey(app: "musicbingo" | "toastmachine") {
  localStorage.removeItem(`eventsoft_license_${app}`);
}
