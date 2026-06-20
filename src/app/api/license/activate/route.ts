import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hashFingerprint, createSessionToken } from "@/lib/license";

export const runtime = "nodejs";

interface ActivateBody {
  key?: string;
  fingerprint?: string;
}

function normalizeKey(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, "");
}

export async function POST(request: Request) {
  let body: ActivateBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Неверный формат запроса." },
      { status: 400 }
    );
  }

  const rawKey = body.key ?? "";
  const rawFp = body.fingerprint ?? "";

  if (!rawKey) {
    return NextResponse.json(
      { ok: false, error: "Введите лицензионный ключ." },
      { status: 400 }
    );
  }
  if (!rawFp || rawFp.length < 16) {
    return NextResponse.json(
      { ok: false, error: "Не удалось определить устройство." },
      { status: 400 }
    );
  }

  const normalizedKey = normalizeKey(rawKey);
  const fpHash = hashFingerprint(rawFp);

  const license = await db.licenseKey.findUnique({
    where: { key: normalizedKey },
  });

  if (!license) {
    return NextResponse.json(
      { ok: false, error: "Лицензионный ключ не найден." },
      { status: 404 }
    );
  }

  if (!license.isActive) {
    return NextResponse.json(
      {
        ok: false,
        error: "Этот лицензионный ключ был отозван. Обратитесь к продавцу.",
      },
      { status: 403 }
    );
  }

  const sessionSecret =
    process.env.SESSION_SECRET || "toast-slot-machine-session-secret-dev";

  // First activation — bind the key to this machine.
  if (!license.machineFingerprint) {
    await db.licenseKey.update({
      where: { id: license.id },
      data: {
        machineFingerprint: fpHash,
        activatedAt: new Date(),
        lastVerifiedAt: new Date(),
      },
    });
    return NextResponse.json({
      ok: true,
      activated: true,
      key: license.key,
      session: createSessionToken(license.id, sessionSecret),
    });
  }

  // Already activated — must be the same machine.
  if (license.machineFingerprint !== fpHash) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Этот ключ уже привязан к другому устройству и не может быть использован здесь.",
      },
      { status: 403 }
    );
  }

  // Same machine — refresh verification timestamp.
  await db.licenseKey.update({
    where: { id: license.id },
    data: { lastVerifiedAt: new Date() },
  });

  return NextResponse.json({
    ok: true,
    activated: false,
    key: license.key,
    session: createSessionToken(license.id, sessionSecret),
  });
}
