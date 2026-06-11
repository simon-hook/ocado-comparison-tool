import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isAuthenticated } from "@/lib/auth";

/** "Fix match": persist a confirmed Ocado SKU <-> ASIN mapping. */
export async function POST(request: Request) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }
  const { ocadoSku, asin } = await request.json();
  if (!ocadoSku || !asin) {
    return NextResponse.json({ error: "ocadoSku and asin required" }, { status: 400 });
  }
  const mapping = await db.productMapping.upsert({
    where: { ocadoSku: String(ocadoSku) },
    create: { ocadoSku: String(ocadoSku), asin: String(asin) },
    update: { asin: String(asin), confirmedAt: new Date() },
  });
  return NextResponse.json({ mapping });
}

export async function DELETE(request: Request) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }
  const { ocadoSku } = await request.json();
  await db.productMapping
    .delete({ where: { ocadoSku: String(ocadoSku) } })
    .catch(() => null);
  return NextResponse.json({ ok: true });
}
