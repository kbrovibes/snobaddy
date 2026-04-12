"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export interface FinalsFormatData {
  id: string;
  session_id: string;
  finals_group: string | null;
  format_type: "playoffs" | "fixed_partner";
  status: string;
  config: Record<string, unknown>;
}

// Compute valid matches_per_player values (must satisfy: mpp * playerCount % 4 === 0)
function validMatchesPerPlayer(playerCount: number): number[] {
  const vals: number[] = [];
  for (let m = 2; m <= Math.min(playerCount, 12); m++) {
    if ((m * playerCount) % 4 === 0) vals.push(m);
  }
  return vals;
}

function defaultMatchesPerPlayer(playerCount: number): number {
  const valid = validMatchesPerPlayer(playerCount);
  const target = Math.max(3, Math.round(playerCount * 0.4));
  let best = valid[0];
  for (const v of valid) {
    if (Math.abs(v - target) < Math.abs(best - target)) best = v;
  }
  return best;
}

const FORMATS = [
  {
    type: "fixed_partner" as const,
    title: "Fixed-Partner All-Pairs",
    subtitle: "Admin assigns partner pairs. Every pair plays every other pair once.",
    icon: "🤝",
  },
  {
    type: "playoffs" as const,
    title: "Playoffs + Finals",
    subtitle: "Players rotate partners in group stage. Top 4 advance to Best-of-3 Final.",
    icon: "🏆",
  },
];

export default function FormatPicker({
  sessionId,
  finalsGroup,
  currentFormat,
  playerCount,
}: {
  sessionId: string;
  finalsGroup: string;
  currentFormat: FinalsFormatData | null;
  playerCount: number;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selecting, setSelecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Local state — no API calls until explicit save
  const [selectedType, setSelectedType] = useState<string | null>(
    currentFormat?.format_type ?? null
  );
  const [matchesPerPlayer, setMatchesPerPlayer] = useState<number>(
    (currentFormat?.config as { matches_per_player?: number })?.matches_per_player
    ?? defaultMatchesPerPlayer(playerCount)
  );

  const isLocked = currentFormat && currentFormat.status !== "configured";
  const displayType = selectedType ?? currentFormat?.format_type;
  const validValues = validMatchesPerPlayer(playerCount);
  const totalMatches = displayType === "playoffs" ? (matchesPerPlayer * playerCount) / 4 : 0;

  // Has the user changed anything from what's saved?
  const savedType = currentFormat?.format_type ?? null;
  const savedMpp = (currentFormat?.config as { matches_per_player?: number })?.matches_per_player ?? null;
  const hasUnsavedChanges = displayType !== savedType ||
    (displayType === "playoffs" && matchesPerPlayer !== savedMpp);

  async function handleSave() {
    if (!displayType) return;
    setSelecting(true);
    setError(null);
    const config = displayType === "playoffs" ? { matches_per_player: matchesPerPlayer } : {};
    const res = await fetch(`/api/sessions/${sessionId}/finals-format`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ format_type: displayType, finals_group: finalsGroup, config }),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? "Failed to save format");
    } else {
      startTransition(() => router.refresh());
    }
    setSelecting(false);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-stone-500 uppercase tracking-wide">
          Format
        </h3>
        <span className="text-xs text-stone-400">{playerCount} players</span>
      </div>

      {error && (
        <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
      )}

      {/* Radio options */}
      <div className="flex flex-col gap-2">
        {FORMATS.map((fmt) => {
          const isSelected = displayType === fmt.type;
          const showPlayoffsConfig = fmt.type === "playoffs" && isSelected && !isLocked;
          return (
            <div
              key={fmt.type}
              onClick={() => !isLocked && setSelectedType(fmt.type)}
              className={[
                "rounded-xl border transition-all cursor-pointer",
                isSelected
                  ? "border-sky-500 bg-sky-50"
                  : "border-stone-200 bg-white hover:border-stone-300",
                isLocked ? "opacity-70 cursor-default" : "",
              ].join(" ")}
            >
              <div className="flex items-start gap-3 px-3 py-2.5">
                {/* Radio dot */}
                <div className={[
                  "w-5 h-5 rounded-full border-2 flex items-center justify-center mt-0.5 shrink-0",
                  isSelected ? "border-sky-500" : "border-stone-300",
                ].join(" ")}>
                  {isSelected && <div className="w-2.5 h-2.5 rounded-full bg-sky-500" />}
                </div>
                <div className="flex-1">
                  <span className="text-sm font-semibold text-stone-800">{fmt.icon} {fmt.title}</span>
                  <p className="text-xs text-stone-500 mt-0.5">{fmt.subtitle}</p>
                </div>
              </div>

              {/* Inline playoffs config */}
              {showPlayoffsConfig && (
                <div className="border-t border-sky-200 px-3 py-2 flex items-center justify-between" onClick={(e) => e.stopPropagation()}>
                  <span className="text-xs text-stone-600">Matches per player</span>
                  <div className="flex items-center gap-2">
                    <select
                      value={matchesPerPlayer}
                      onChange={(e) => setMatchesPerPlayer(Number(e.target.value))}
                      className="text-sm border border-stone-200 rounded-lg px-2 py-0.5 bg-white focus:outline-none focus:ring-2 focus:ring-sky-300"
                    >
                      {validValues.map((v) => (
                        <option key={v} value={v}>{v}</option>
                      ))}
                    </select>
                    <span className="text-[11px] text-stone-400">{totalMatches} total</span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Show match info when locked */}
      {displayType === "playoffs" && isLocked && (
        <p className="text-xs text-stone-400 px-1">
          {matchesPerPlayer} matches per player · {totalMatches} total matches
        </p>
      )}

      {/* Save button — only when there are unsaved changes */}
      {hasUnsavedChanges && displayType && !isLocked && (
        <button
          onClick={handleSave}
          disabled={selecting || isPending}
          className="w-full py-2 rounded-xl text-sm font-semibold text-white bg-sky-600 hover:bg-sky-700 disabled:opacity-40 transition-colors"
        >
          {selecting ? "Saving…" : "Save Format"}
        </button>
      )}

      {/* Reset */}
      {currentFormat && (
        <button
          onClick={async () => {
            if (!confirm("Reset format? This will delete all matches and series for this group.")) return;
            setSelecting(true);
            const res = await fetch(`/api/sessions/${sessionId}/finals-format/reset`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ finals_group: finalsGroup }),
            });
            if (res.ok) {
              setSelectedType(null);
              startTransition(() => router.refresh());
            } else {
              const json = await res.json();
              setError(json.error ?? "Failed to reset");
            }
            setSelecting(false);
          }}
          disabled={selecting || isPending}
          className="text-xs text-red-400 hover:text-red-600 disabled:opacity-40 self-center"
        >
          Reset format
        </button>
      )}
    </div>
  );
}
