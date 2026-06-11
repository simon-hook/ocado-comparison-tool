"use client";

import { useEffect, useState } from "react";

interface WatchlistEntry {
  ocadoSku: string;
  title: string;
  addedAt: string;
}

export default function WatchlistPage() {
  const [items, setItems] = useState<WatchlistEntry[] | null>(null);

  useEffect(() => {
    fetch("/api/watchlist")
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((data) => setItems(data.items ?? []))
      .catch(() => setItems([]));
  }, []);

  async function remove(sku: string) {
    setItems((prev) => prev?.filter((i) => i.ocadoSku !== sku) ?? null);
    await fetch("/api/watchlist", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ocadoSku: sku }),
    }).catch(() => {});
  }

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-bold">Watchlist</h1>
        <p className="text-sm text-gray-500">
          Starred items — tick “⭐ only” on the Compare tab to check just these.
        </p>
      </header>

      {items === null && (
        <p className="text-center text-sm text-gray-400">Loading…</p>
      )}

      {items?.length === 0 && (
        <p className="pt-8 text-center text-sm text-gray-400">
          Nothing starred yet. Star items from a comparison to track them here.
        </p>
      )}

      <ul className="space-y-2">
        {items?.map((item) => (
          <li
            key={item.ocadoSku}
            className="flex items-center justify-between gap-2 rounded-xl border border-gray-200 bg-white p-3 shadow-sm"
          >
            <span className="min-w-0 truncate text-sm">{item.title}</span>
            <button
              onClick={() => remove(item.ocadoSku)}
              className="shrink-0 text-xs font-medium text-red-600 underline"
            >
              Remove
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
