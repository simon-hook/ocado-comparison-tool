"use client";

import { useCallback, useEffect, useState } from "react";
import type { ComparisonReport } from "@/types/canonical";
import { ItemCard } from "@/components/ItemCard";
import { formatPence } from "@/lib/money";

type Status = "idle" | "loading" | "done" | "error";

export default function ComparePage() {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<ComparisonReport | null>(null);
  const [watchlistOnly, setWatchlistOnly] = useState(false);
  const [starred, setStarred] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetch("/api/watchlist")
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((data) =>
        setStarred(
          new Set((data.items ?? []).map((i: { ocadoSku: string }) => i.ocadoSku)),
        ),
      )
      .catch(() => {});
  }, []);

  const runCompare = useCallback(async () => {
    setStatus("loading");
    setError(null);
    try {
      const res = await fetch("/api/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ watchlistOnly }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Comparison failed");
      setReport(data);
      setStatus("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Comparison failed");
      setStatus("error");
    }
  }, [watchlistOnly]);

  const toggleStar = useCallback(
    async (sku: string, title: string, nowStarred: boolean) => {
      setStarred((prev) => {
        const next = new Set(prev);
        if (nowStarred) next.add(sku);
        else next.delete(sku);
        return next;
      });
      await fetch("/api/watchlist", {
        method: nowStarred ? "POST" : "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ocadoSku: sku, title }),
      }).catch(() => {});
    },
    [],
  );

  const fixMatch = useCallback(
    async (sku: string, asin: string) => {
      await fetch("/api/mappings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ocadoSku: sku, asin }),
      }).catch(() => {});
      // Re-run so the confirmed mapping is reflected in the report.
      runCompare();
    },
    [runCompare],
  );

  const cheaperCount =
    report?.items.filter(
      (i) => i.bestMatch && i.bestMatch.savings.savingsPence > 0,
    ).length ?? 0;

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-bold">Basket Compare</h1>
        <p className="text-sm text-gray-500">
          Your Ocado basket vs Amazon Prime prices
        </p>
      </header>

      <div className="flex items-center gap-3">
        <button
          onClick={runCompare}
          disabled={status === "loading"}
          className="flex-1 rounded-xl bg-green-600 py-3 font-semibold text-white shadow-sm active:bg-green-700 disabled:opacity-50"
        >
          {status === "loading" ? "Comparing…" : "Compare basket"}
        </button>
        <label className="flex items-center gap-1.5 text-sm text-gray-600">
          <input
            type="checkbox"
            checked={watchlistOnly}
            onChange={(e) => setWatchlistOnly(e.target.checked)}
            className="h-4 w-4 accent-green-600"
          />
          ⭐ only
        </label>
      </div>

      {status === "loading" && (
        <p className="text-center text-sm text-gray-500">
          Fetching basket and checking Amazon — this can take a minute…
        </p>
      )}

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {report && status === "done" && (
        <>
          <div className="rounded-xl bg-green-600 p-4 text-white shadow">
            <p className="text-sm opacity-90">Total potential saving</p>
            <p className="text-3xl font-bold">
              {formatPence(report.totalPotentialSavingsPence)}
            </p>
            <p className="mt-1 text-xs opacity-75">
              {cheaperCount} of {report.items.length} items cheaper on Amazon ·
              like-for-like by unit price where possible
            </p>
          </div>

          <div className="space-y-3">
            {[...report.items]
              .sort(
                (a, b) =>
                  (b.bestMatch?.savings.savingsPence ?? -Infinity) -
                  (a.bestMatch?.savings.savingsPence ?? -Infinity),
              )
              .map((result) => (
                <ItemCard
                  key={result.ocadoItem.id}
                  result={result}
                  starred={starred.has(result.ocadoItem.id)}
                  onToggleStar={toggleStar}
                  onFixMatch={fixMatch}
                />
              ))}
          </div>
        </>
      )}

      {status === "idle" && (
        <p className="pt-8 text-center text-sm text-gray-400">
          Tap “Compare basket” to fetch your Ocado basket and check Amazon
          prices.
        </p>
      )}
    </div>
  );
}
