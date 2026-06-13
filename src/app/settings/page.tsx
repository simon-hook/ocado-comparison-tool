"use client";

import { useEffect, useState } from "react";

export default function SettingsPage() {
  const [status, setStatus] = useState<
    { configured: boolean; savedAt: string | null } | null
  >(null);

  function refresh() {
    fetch("/api/ocado-session")
      .then((r) => (r.ok ? r.json() : { configured: false, savedAt: null }))
      .then(setStatus)
      .catch(() => setStatus({ configured: false, savedAt: null }));
  }

  useEffect(refresh, []);

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-bold">Settings</h1>
        <p className="text-sm text-gray-500">Ocado sign-in status</p>
      </header>

      {status === null ? (
        <p className="text-center text-sm text-gray-400">Loading…</p>
      ) : status.configured ? (
        <div className="rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-800">
          ✓ Ocado session saved
          {status.savedAt
            ? ` (${new Date(status.savedAt).toLocaleString("en-GB")})`
            : ""}
          . You&apos;re ready to compare your basket.
        </div>
      ) : (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          No Ocado session yet — follow the steps below to sign in.
        </div>
      )}

      <div className="rounded-xl border border-gray-200 bg-white p-3 text-sm">
        <p className="font-medium text-gray-800">How to sign in to Ocado</p>
        <p className="mt-1 text-gray-600">
          Sign-in happens once, in a real browser window, on the computer
          hosting this app. In a terminal there, run:
        </p>
        <pre className="mt-2 overflow-x-auto rounded-lg bg-gray-900 p-3 text-xs text-gray-100">
          npm run ocado:login
        </pre>
        <p className="mt-2 text-gray-600">
          A browser opens — sign in to Ocado (including any 2-step
          verification), then press Enter in the terminal. Your session is
          saved and reused automatically. Re-run this if a comparison ever says
          your session has expired.
        </p>
        <button
          onClick={refresh}
          className="mt-3 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700"
        >
          Refresh status
        </button>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-3 text-xs text-gray-500">
        <p className="font-medium text-gray-700">Why no password field?</p>
        <p className="mt-1">
          Automating Ocado&apos;s login is unreliable and can&apos;t clear
          2-step verification, so the app never stores your Ocado password — it
          reuses the browser session you create above. Automating Ocado is
          likely against their terms; this tool is for personal, low-volume use
          on your own account only.
        </p>
      </div>
    </div>
  );
}
