import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { encrypt } from "@/lib/crypto";
import { isAuthenticated } from "@/lib/auth";

/** GET: whether Ocado credentials are saved (never returns the password). */
export async function GET() {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }
  const cred = await db.credential.findUnique({ where: { service: "ocado" } });
  return NextResponse.json({
    configured: Boolean(cred),
    username: cred?.username ?? null,
  });
}

/** POST: save/update Ocado credentials (password encrypted at rest). */
export async function POST(request: Request) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }
  const { username, password } = await request.json();
  if (!username || !password) {
    return NextResponse.json(
      { error: "username and password required" },
      { status: 400 },
    );
  }
  const encryptedPassword = encrypt(String(password));
  await db.credential.upsert({
    where: { service: "ocado" },
    create: { service: "ocado", username: String(username), encryptedPassword },
    update: { username: String(username), encryptedPassword },
  });
  return NextResponse.json({ ok: true });
}
