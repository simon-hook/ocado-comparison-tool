"use client";

import { useState } from "react";
import type { MatchResult, ScoredCandidate } from "@/types/canonical";
import { formatPence, formatUnitPrice } from "@/lib/money";
import { formatSize } from "@/matching/sizeParser";

interface Props {
  result: MatchResult;
  starred: boolean;
  onToggleStar: (sku: string, title: string, starred: boolean) => void;
  onFixMatch: (sku: string, asin: string) => void;
}

function SavingsBadge({ pence }: { pence: number }) {
  if (pence > 0) {
    return (
      <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-sm font-semibold text-green-800">
        Save {formatPence(pence)}
      </span>
    );
  }
  return (
    <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-sm text-gray-600">
      Ocado wins by {formatPence(-pence)}
    </span>
  );
}

function CandidateRow({
  candidate,
  selected,
  onSelect,
}: {
  candidate: ScoredCandidate;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className={`flex w-full items-center justify-between gap-2 rounded-lg border p-2 text-left text-sm ${
        selected ? "border-green-600 bg-green-50" : "border-gray-200 bg-white"
      }`}
    >
      <span className="min-w-0">
        <span className="block truncate">{candidate.item.title}</span>
        <span className="text-xs text-gray-500">
          {formatPence(candidate.item.pricePence)}
          {candidate.item.size ? ` · ${formatSize(candidate.item.size)}` : ""}
          {" · "}
          {Math.round(candidate.confidence * 100)}% match
        </span>
      </span>
      {selected && <span className="shrink-0 text-green-700">✓</span>}
    </button>
  );
}

export function ItemCard({ result, starred, onToggleStar, onFixMatch }: Props) {
  const [showCandidates, setShowCandidates] = useState(false);
  const { ocadoItem, bestMatch, candidates } = result;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-medium">{ocadoItem.title}</p>
          <p className="text-sm text-gray-500">
            {ocadoItem.quantity > 1 ? `${ocadoItem.quantity} × ` : ""}
            {formatPence(ocadoItem.pricePence)} at Ocado
            {ocadoItem.unitPricePence !== undefined && ocadoItem.size
              ? ` · ${formatUnitPrice(ocadoItem.unitPricePence, ocadoItem.size.unit)}`
              : ""}
          </p>
        </div>
        <button
          aria-label={starred ? "Remove from watchlist" : "Add to watchlist"}
          onClick={() => onToggleStar(ocadoItem.id, ocadoItem.title, !starred)}
          className={`shrink-0 text-2xl leading-none ${starred ? "" : "grayscale opacity-40"}`}
        >
          ⭐
        </button>
      </div>

      {bestMatch ? (
        <div className="mt-2 rounded-lg bg-gray-50 p-2">
          <div className="flex items-center justify-between gap-2">
            <a
              href={bestMatch.item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="min-w-0 truncate text-sm text-blue-700 underline"
            >
              {bestMatch.item.title}
            </a>
            <SavingsBadge pence={bestMatch.savings.savingsPence} />
          </div>
          <p className="mt-1 text-xs text-gray-500">
            {formatPence(bestMatch.item.pricePence)} on Amazon
            {bestMatch.savings.amazonUnitPricePence !== undefined &&
            bestMatch.item.size
              ? ` · ${formatUnitPrice(bestMatch.savings.amazonUnitPricePence, bestMatch.item.size.unit)}`
              : ""}
            {bestMatch.savings.basis === "unit" ? " · like-for-like by size" : " · pack price"}
            {result.fromConfirmedMapping
              ? " · ✓ confirmed match"
              : ` · ${Math.round(bestMatch.confidence * 100)}% match`}
            {bestMatch.item.primeEligible === undefined ? " · Prime unverified" : ""}
          </p>
        </div>
      ) : (
        <p className="mt-2 rounded-lg bg-gray-50 p-2 text-sm text-gray-500">
          No confident Prime match found.
        </p>
      )}

      {candidates.length > 0 && (
        <div className="mt-2">
          <button
            onClick={() => setShowCandidates((v) => !v)}
            className="text-xs font-medium text-gray-500 underline"
          >
            {showCandidates ? "Hide alternatives" : "Fix match / see alternatives"}
          </button>
          {showCandidates && (
            <div className="mt-2 space-y-1.5">
              {candidates.map((c) => (
                <CandidateRow
                  key={c.item.id}
                  candidate={c}
                  selected={bestMatch?.item.id === c.item.id}
                  onSelect={() => onFixMatch(ocadoItem.id, c.item.id)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
