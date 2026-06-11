import { NextRequest, NextResponse } from "next/server";
import { verify } from "@/lib/crypto";

// Node runtime so we can reuse the HMAC cookie signing from lib/crypto.
export const runtime = "nodejs";

const PUBLIC_PATHS = ["/login", "/api/auth/login", "/manifest.json", "/sw.js"];

export function middleware(request: NextRequest) {
  if (!process.env.APP_PASSWORD) return NextResponse.next(); // auth disabled

  const { pathname } = request.nextUrl;
  const isPublic =
    PUBLIC_PATHS.some((p) => pathname === p) ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/icons");
  if (isPublic) return NextResponse.next();

  const cookie = request.cookies.get("ocado_tool_session")?.value;
  const valid = cookie ? verify(cookie) === "authenticated" : false;
  if (valid) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }
  const login = request.nextUrl.clone();
  login.pathname = "/login";
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/((?!favicon.ico).*)"],
};
