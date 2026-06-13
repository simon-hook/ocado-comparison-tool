import { NextRequest, NextResponse } from "next/server";
import { verify } from "@/lib/crypto";

// Renamed from middleware -> proxy for Next.js 16 (the "middleware" file
// convention is deprecated). Proxy defaults to the Node.js runtime, so the
// HMAC cookie verification from lib/crypto works without any runtime config
// (the `runtime` option is not allowed in proxy files).

const PUBLIC_PATHS = ["/login", "/api/auth/login", "/manifest.json", "/sw.js"];

export function proxy(request: NextRequest) {
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
