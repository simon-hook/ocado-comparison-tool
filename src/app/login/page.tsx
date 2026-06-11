"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    }).catch(() => null);
    setBusy(false);
    if (res?.ok) {
      router.push("/");
      router.refresh();
    } else {
      setError("Wrong password");
    }
  }

  return (
    <div className="flex min-h-[70vh] flex-col justify-center space-y-4">
      <h1 className="text-center text-xl font-bold">Basket Compare</h1>
      <form onSubmit={submit} className="space-y-3">
        <input
          type="password"
          required
          placeholder="App password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-lg border border-gray-300 p-3 text-base"
        />
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-xl bg-green-600 py-3 font-semibold text-white disabled:opacity-50"
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
      {error && <p className="text-center text-sm text-red-600">{error}</p>}
    </div>
  );
}
