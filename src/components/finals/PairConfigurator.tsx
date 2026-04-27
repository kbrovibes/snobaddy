"use client";

import React, { useState, useTransition, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";

export interface PairPlayer {
  player_id: string;
  name: string;
  finals_score: number | null;
  group_label: string;
}

export interface SavedPair {
  player1_id: string;
  player2_id: string;
}

type Pair = [string | null, string | null];

function buildInitialPairs(players: PairPlayer[], saved: SavedPair[]): Pair[] {
  if (saved.length > 0) {
    return saved.map((s) => [s.player1_id, s.player2_id]);
  }
  const pairCount = Math.floor(players.length / 2);
  return Array.from({ length: pairCount }, () => [null, null]);
}

function autoSuggestPairs(players: PairPlayer[]): Pair[] {
  const sorted = [...players].sort((a, b) => (b.finals_score ?? 0) - (a.finals_score ?? 0));
  const pairs: Pair[] = [];
  const half = Math.floor(sorted.length / 2);
  for (let i = 0; i < half; i++) {
    pairs.push([sorted[i].player_id, sorted[sorted.length - 1 - i].player_id]);
  }
  return pairs;
}

function firstName(name: string) {
  return name.split(" ")[0];
}

// --- Custom player picker ---

function PlayerPicker({
  players, value, assignedIds, currentSlotValue, onChange, disabled, label,
}: {
  players: PairPlayer[];
  value: string | null;
  assignedIds: Set<string>;
  currentSlotValue: string | null;
  onChange: (id: string | null) => void;
  disabled: boolean;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const selected = value ? players.find((p) => p.player_id === value) : null;

  return (
    <div className="flex-1 min-w-0 relative" ref={ref}>
      <button
        type="button"
        onClick={() => !disabled && setOpen(!open)}
        disabled={disabled}
        className={[
          "w-full text-left px-3 py-2 rounded-lg text-sm transition-colors",
          "border",
          selected
            ? "bg-surface border-border text-heading"
            : "bg-surface-alt border-dashed border-stone-300 dark:border-border text-muted-light",
          disabled ? "opacity-50 cursor-not-allowed" : "hover:border-sky-300 active:border-sky-400",
          open ? "ring-2 ring-sky-200 border-sky-300" : "",
        ].join(" ")}
      >
        <span className="block truncate">
          {selected ? firstName(selected.name) : label}
        </span>
        {!disabled && (
          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-lighter text-[10px]">
            ▼
          </span>
        )}
      </button>

      {open && (
        <div className="absolute z-30 mt-1 w-full bg-surface rounded-xl shadow-lg border border-border py-1 max-h-52 overflow-y-auto">
          {/* Clear option */}
          {value && (
            <button
              type="button"
              onClick={() => { onChange(null); setOpen(false); }}
              className="w-full text-left px-3 py-2 text-sm text-muted-light hover:bg-surface-alt transition-colors"
            >
              Clear
            </button>
          )}
          {players.map((p) => {
            const taken = assignedIds.has(p.player_id) && p.player_id !== currentSlotValue;
            const isSelected = p.player_id === value;
            return (
              <button
                key={p.player_id}
                type="button"
                onClick={() => {
                  if (!taken) { onChange(p.player_id); setOpen(false); }
                }}
                disabled={taken}
                className={[
                  "w-full text-left px-3 py-2 text-sm transition-colors flex items-center justify-between",
                  isSelected ? "bg-sky-50 dark:bg-sky-500/10 text-sky-700 font-semibold" : "",
                  taken ? "text-muted-lighter cursor-not-allowed" : "hover:bg-surface-alt text-heading",
                ].join(" ")}
              >
                <span className="truncate">{firstName(p.name)}</span>
                <span className="text-[11px] text-muted-light ml-2 shrink-0">
                  {p.finals_score != null ? p.finals_score.toFixed(1) : ""}
                  {isSelected && " ✓"}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// --- Main component ---

export default function PairConfigurator({
  sessionId,
  finalsGroup,
  players,
  savedPairs,
  isLocked,
}: {
  sessionId: string;
  finalsGroup: string;
  players: PairPlayer[];
  savedPairs: SavedPair[];
  isLocked: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [pairs, setPairs] = useState<Pair[]>(() => buildInitialPairs(players, savedPairs));

  const isOdd = players.length % 2 !== 0;
  const assignedIds = new Set(pairs.flatMap((p) => p.filter(Boolean) as string[]));
  const unassigned = players.filter((p) => !assignedIds.has(p.player_id));

  function updatePair(pairIdx: number, slot: 0 | 1, playerId: string | null) {
    const next = pairs.map((p) => [...p] as Pair);
    next[pairIdx][slot] = playerId;
    setPairs(next);
    setSuccess(false);
  }

  const validationErrors: string[] = [];
  if (isOdd) validationErrors.push(`Odd number of players (${players.length}).`);
  if (!pairs.every((p) => p[0] && p[1])) validationErrors.push("Unassigned slots.");
  const ids = pairs.flatMap((p) => p.filter(Boolean) as string[]);
  if (new Set(ids).size !== ids.length) validationErrors.push("Duplicate assignments.");
  const canSave = validationErrors.length === 0 && !isLocked;

  async function handleSave() {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    setSuccess(false);

    const pairsPayload = pairs.map((p) => ({ player1_id: p[0]!, player2_id: p[1]! }));
    const res = await fetch(`/api/sessions/${sessionId}/finals-format/pairs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ finals_group: finalsGroup, pairs: pairsPayload }),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? "Failed to save teams");
      setSaving(false);
      return;
    }

    const genRes = await fetch(`/api/sessions/${sessionId}/finals-format/generate-matches`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ finals_group: finalsGroup }),
    });
    const genJson = await genRes.json();
    if (!genRes.ok) {
      setError(genJson.error ?? "Teams saved but failed to generate matches");
      setSaving(false);
      startTransition(() => router.refresh());
      return;
    }

    setSuccess(true);
    startTransition(() => router.refresh());
    setSaving(false);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-text-light uppercase tracking-wide">
          Teams
        </h3>
        {!isLocked && (
          <button
            onClick={() => { setPairs(autoSuggestPairs(players)); setSuccess(false); }}
            className="text-xs text-sky-600 dark:text-sky-400 hover:text-sky-800 dark:hover:text-sky-300 font-medium"
          >
            Auto-suggest
          </button>
        )}
      </div>

      {error && <p className="text-xs text-red-500 bg-red-50 dark:bg-red-500/10 px-3 py-2 rounded-lg">{error}</p>}

      {isOdd && (
        <p className="text-xs text-red-500 bg-red-50 dark:bg-red-500/10 px-3 py-2 rounded-lg">
          Odd number of players ({players.length}). Adjust groups on the Finals Event page.
        </p>
      )}

      {pairs.map((pair, pairIdx) => {
        const p1 = pair[0] ? players.find((p) => p.player_id === pair[0]) : null;
        const p2 = pair[1] ? players.find((p) => p.player_id === pair[1]) : null;
        const teamScore = (p1?.finals_score ?? 0) + (p2?.finals_score ?? 0);
        const showScore = p1?.finals_score != null && p2?.finals_score != null;
        const isComplete = !!p1 && !!p2;
        return (
          <div key={pairIdx} className={[
            "flex flex-col gap-1.5 rounded-xl px-3 py-2.5 border transition-colors",
            isComplete ? "bg-surface border-border" : "bg-background border-dashed border-border",
          ].join(" ")}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-text-light">
                Team {pairIdx + 1}
              </span>
              {showScore && (
                <span className="text-[11px] text-muted-light bg-surface-alt px-1.5 py-0.5 rounded-full">
                  {teamScore.toFixed(1)} pts
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <PlayerPicker
                players={players} value={pair[0]} assignedIds={assignedIds}
                currentSlotValue={pair[0]} onChange={(id) => updatePair(pairIdx, 0, id)}
                disabled={isLocked || saving || isPending} label="Player 1"
              />
              <span className="text-xs text-muted-lighter font-medium">&</span>
              <PlayerPicker
                players={players} value={pair[1]} assignedIds={assignedIds}
                currentSlotValue={pair[1]} onChange={(id) => updatePair(pairIdx, 1, id)}
                disabled={isLocked || saving || isPending} label="Player 2"
              />
            </div>
          </div>
        );
      })}

      {unassigned.length > 0 && !isOdd && (
        <p className="text-xs text-amber-600 dark:text-amber-400">
          {unassigned.length} unassigned: {unassigned.map((p) => firstName(p.name)).join(", ")}
        </p>
      )}

      {!isLocked && (
        <button
          onClick={handleSave}
          disabled={!canSave || saving || isPending}
          className="w-full py-2.5 rounded-xl text-sm font-semibold text-white bg-stone-900 hover:bg-stone-800 dark:hover:bg-sky-500 disabled:opacity-40 transition-colors"
        >
          {saving ? "Saving & generating matches…" : success ? "Saved ✓" : "Confirm Teams & Generate Matches"}
        </button>
      )}

      {isLocked && (
        <p className="text-xs text-muted-light text-center">Teams locked — matches generated.</p>
      )}
    </div>
  );
}
