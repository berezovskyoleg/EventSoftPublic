import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";

const ADMIN_SECRET =
  process.env.ADMIN_SECRET || "toast-admin-secret-change-me";

interface RevokeBody {
  key?: string;
  revoke?: boolean;
}

function normalizeKey(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, "");
}

export async function POST(request: Request) {
  const provided = request.headers.get("x-admin-secret") ?? "";
  if (!provided || provided !== ADMIN_SECRET) {
    return NextResponse.json(
      { ok: false, error: "Доступ запрещён." },
      { status: 401 }
    );
  }

  let body: RevokeBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Неверный формат запроса." },
      { status: 400 }
    );
  }

  const key = normalizeKey(body.key ?? "");
  const revoke = body.revoke !== false; // default true

  if (!key) {
    return NextResponse.json(
      { ok: false, error: "Укажите ключ." },
      { status: 400 }
    );
  }

  const license = await db.licenseKey.findUnique({ where: { key } });
  if (!license) {
    return NextResponse.json(
      { ok: false, error: "Ключ не найден." },
      { status: 404 }
    );
  }

  await db.licenseKey.update({
    where: { id: license.id },
    data: { isActive: revoke ? false : true },
  });

  return NextResponse.json({
    ok: true,
    key: license.key,
    isActive: revoke ? false : true,
  });
}
