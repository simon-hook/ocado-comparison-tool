import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isAuthenticated } from "@/lib/auth";

async function guard() {
  return (await isAuthenticated())
    ? null
    : NextResponse.json({ error: "Unauthorised" }, { status: 401 });
}

export async function GET() {
  const denied = await guard();
  if (denied) return denied;
  const items = await db.watchlistItem.findMany({ orderBy: { addedAt: "desc" } });
  return NextResponse.json({ items });
}

export async function POST(request: Request) {
  const denied = await guard();
  if (denied) return denied;
  const { ocadoSku, title } = await request.json();
  if (!ocadoSku || !title) {
    return NextResponse.json({ error: "ocadoSku and title required" }, { status: 400 });
  }
  const item = await db.watchlistItem.upsert({
    where: { ocadoSku: String(ocadoSku) },
    create: { ocadoSku: String(ocadoSku), title: String(title) },
    update: { title: String(title) },
  });
  return NextResponse.json({ item });
}

export async function DELETE(request: Request) {
  const denied = await guard();
  if (denied) return denied;
  const { ocadoSku } = await request.json();
  await db.watchlistItem
    .delete({ where: { ocadoSku: String(ocadoSku) } })
    .catch(() => null); // already gone is fine
  return NextResponse.json({ ok: true });
}
