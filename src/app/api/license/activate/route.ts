import { execFileSync } from "child_process";
import { NextRequest, NextResponse } from "next/server";
import path from "path";

function adminBinaryPath(): string {
  const bin = process.platform === "win32" ? "admin.exe" : "admin";
  return path.join(process.cwd(), "src-tauri", "target", "release", bin);
}

export async function POST(req: NextRequest) {
  try {
    const { key, fingerprint } = (await req.json()) as {
      key?: string;
      fingerprint?: string;
    };

    if (!key || !fingerprint) {
      return NextResponse.json(
        { ok: false, error: "Укажите ключ и fingerprint." },
        { status: 400 }
      );
    }

    const admin = adminBinaryPath();
    const stdout = execFileSync(admin, ["activate", key, fingerprint], {
      encoding: "utf-8",
      timeout: 10000,
    });

    const data = JSON.parse(stdout.trim());
    return NextResponse.json(data);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Не удалось активировать ключ.";
    let parsedError: string | undefined;
    try {
      const m = message.match(/\{"error":"(.+)"\}/);
      if (m) parsedError = m[1];
    } catch {
      // ignore
    }
    return NextResponse.json(
      { ok: false, error: parsedError || message },
      { status: 400 }
    );
  }
}
