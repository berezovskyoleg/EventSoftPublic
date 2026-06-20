import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";

const ADMIN_SECRET =
  process.env.ADMIN_SECRET || "toast-admin-secret-change-me";

export async function GET(request: Request) {
  const provided = request.headers.get("x-admin-secret") ?? "";
  if (!provided || provided !== ADMIN_SECRET) {
    return NextResponse.json(
      { ok: false, error: "Доступ запрещён." },
      { status: 401 }
    );
  }

  const keys = await db.licenseKey.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      key: true,
      isActive: true,
      activatedAt: true,
      lastVerifiedAt: true,
      createdAt: true,
    },
  });

  const data = keys.map((k, i) => ({
    index: i + 1,
    key: k.key,
    status: !k.isActive
      ? "revoked"
      : k.activatedAt
        ? "activated"
        : "available",
    activatedAt: k.activatedAt,
    lastVerifiedAt: k.lastVerifiedAt,
    createdAt: k.createdAt,
  }));

  return NextResponse.json({
    ok: true,
    total: data.length,
    available: data.filter((k) => k.status === "available").length,
    activated: data.filter((k) => k.status === "activated").length,
    revoked: data.filter((k) => k.status === "revoked").length,
    keys: data,
  });
}
