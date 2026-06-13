import { NextResponse } from "next/server";
import { existsSync, statSync } from "node:fs";
import { isAuthenticated } from "@/lib/auth";
import { SESSION_FILE } from "@/providers/ocado/session";

/** Reports whether an Ocado session has been saved (via `npm run ocado:login`). */
export async function GET() {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }
  const exists = existsSync(SESSION_FILE);
  return NextResponse.json({
    configured: exists,
    savedAt: exists ? statSync(SESSION_FILE).mtime.toISOString() : null,
  });
}
