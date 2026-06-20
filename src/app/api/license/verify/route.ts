import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hashFingerprint } from "@/lib/license";

export const runtime = "nodejs";

interface VerifyBody {
  key?: string;
  fingerprint?: string;
}

function normalizeKey(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, "");
}

export async function POST(request: Request) {
  let body: VerifyBody;
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

  if (!rawKey || !rawFp) {
    return NextResponse.json(
      { ok: false, error: "Неверный формат запроса." },
      { status: 400 }
    );
  }

  const normalizedKey = normalizeKey(rawKey);
  const fpHash = hashFingerprint(rawFp);

  const license = await db.licenseKey.findUnique({
    where: { key: normalizedKey },
  });

  if (!license) {
    return NextResponse.json({ ok: false, error: "Ключ не найден." }, { status: 404 });
  }

  if (!license.isActive) {
    return NextResponse.json(
      { ok: false, error: "Ключ отозван." },
      { status: 403 }
    );
  }

  if (!license.machineFingerprint || license.machineFingerprint !== fpHash) {
    return NextResponse.json(
      { ok: false, error: "Ключ не привязан к этому устройству." },
      { status: 403 }
    );
  }

  await db.licenseKey.update({
    where: { id: license.id },
    data: { lastVerifiedAt: new Date() },
  });

  return NextResponse.json({ ok: true, key: license.key });
}
