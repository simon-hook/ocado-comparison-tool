"use client";

import { useEffect, useState } from "react";

export default function SettingsPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [savedUsername, setSavedUsername] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/credentials")
      .then((r) => (r.ok ? r.json() : { configured: false }))
      .then((data) => {
        setConfigured(Boolean(data.configured));
        setSavedUsername(data.username ?? null);
      })
      .catch(() => setConfigured(false));
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      setConfigured(true);
      setSavedUsername(username);
      setPassword("");
      setMessage("Saved — password encrypted at rest.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-bold">Settings</h1>
        <p className="text-sm text-gray-500">Ocado account for basket access</p>
      </header>

      {configured && (
        <div className="rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-800">
          Ocado credentials saved{savedUsername ? ` for ${savedUsername}` : ""}.
          Submit again to replace them.
        </div>
      )}

      <form onSubmit={save} className="space-y-3">
        <label className="block">
          <span className="text-sm font-medium text-gray-700">
            Ocado email
          </span>
          <input
            type="email"
            required
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            className="mt-1 w-full rounded-lg border border-gray-300 p-3 text-base"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-gray-700">
            Ocado password
          </span>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            className="mt-1 w-full rounded-lg border border-gray-300 p-3 text-base"
          />
        </label>
        <button
          type="submit"
          disabled={saving}
          className="w-full rounded-xl bg-green-600 py-3 font-semibold text-white shadow-sm active:bg-green-700 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save credentials"}
        </button>
      </form>

      {message && <p className="text-sm text-gray-600">{message}</p>}

      <div className="rounded-xl border border-gray-200 bg-white p-3 text-xs text-gray-500">
        <p className="font-medium text-gray-700">How your password is stored</p>
        <p className="mt-1">
          Encrypted with AES-256-GCM using a key that lives only on this
          server. It is sent to Ocado for sign-in and nowhere else. Automating
          Ocado login is likely against their terms — this tool is for
          personal, low-volume use.
        </p>
      </div>
    </div>
  );
}
