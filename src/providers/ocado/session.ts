import path from "node:path";

/**
 * Location of the saved Ocado session (cookies/localStorage) produced by
 * `npm run ocado:login` and reused by OcadoBasketProvider. Kept in its own
 * module so lightweight callers (e.g. the session-status API route) don't
 * pull in Playwright.
 */
export const SESSION_DIR = path.join(process.cwd(), ".data");
export const SESSION_FILE = path.join(SESSION_DIR, "ocado-session.json");
