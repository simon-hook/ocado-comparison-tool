import { cookies } from "next/headers";
import { sign, verify } from "./crypto";

/**
 * Minimal single-user session: when APP_PASSWORD is set, a signed cookie
 * gates the app. When unset (e.g. trusted home network), auth is disabled.
 */

const COOKIE = "ocado_tool_session";
const SESSION_VALUE = "authenticated";
const MAX_AGE_S = 30 * 24 * 60 * 60; // 30 days

export function authEnabled(): boolean {
  return Boolean(process.env.APP_PASSWORD);
}

export function checkPassword(password: string): boolean {
  return authEnabled() && password === process.env.APP_PASSWORD;
}

export async function createSession(): Promise<void> {
  const jar = await cookies();
  jar.set(COOKIE, sign(SESSION_VALUE), {
    httpOnly: true,
    sameSite: "lax",
    maxAge: MAX_AGE_S,
    path: "/",
  });
}

export async function isAuthenticated(): Promise<boolean> {
  if (!authEnabled()) return true;
  const jar = await cookies();
  const cookie = jar.get(COOKIE)?.value;
  return cookie ? verify(cookie) === SESSION_VALUE : false;
}
