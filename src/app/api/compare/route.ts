import { NextResponse } from "next/server";
import { compareBasket } from "@/lib/compare";
import { isAuthenticated } from "@/lib/auth";
import { BasketAuthError } from "@/providers/types";

// Playwright + per-item Amazon searches can take a while on a live run.
export const maxDuration = 300;

export async function POST(request: Request) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }
  const body = await request.json().catch(() => ({}));
  try {
    const report = await compareBasket({
      watchlistOnly: Boolean(body.watchlistOnly),
    });
    return NextResponse.json(report);
  } catch (err) {
    if (err instanceof BasketAuthError) {
      return NextResponse.json(
        { error: err.message, needsManualSignIn: true },
        { status: 409 },
      );
    }
    console.error("compareBasket failed:", err);
    const message = err instanceof Error ? err.message : "Comparison failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
