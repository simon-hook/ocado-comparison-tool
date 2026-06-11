import { NextResponse } from "next/server";
import { checkPassword, createSession } from "@/lib/auth";

export async function POST(request: Request) {
  const { password } = await request.json();
  if (!checkPassword(String(password ?? ""))) {
    return NextResponse.json({ error: "Wrong password" }, { status: 401 });
  }
  await createSession();
  return NextResponse.json({ ok: true });
}
