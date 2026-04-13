"use client";

import React, { useState, useTransition, useCallback } from "react";
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
  // Fold pairing: #1 with #N, #2 with #N-1, etc. — balances combined pair scores
  const sorted = [...players].sort((a, b) => (b.finals_score ?? 0) - (a.finals_score ?? 0));
  const pairs: Pair[] = [];
  const half = Math.floor(sorted.length / 2);
  for (let i = 0; i < half; i++) {
    pairs.push([sorted[i].player_id, sorted[sorted.length - 1 - i].player_id]);
  }
  return pairs;
}

function PlayerDropdown({
  players, value, assignedIds, currentSlotValue, onChange, disabled,
}: {
  players: PairPlayer[]; value: string | null; assignedIds: Set<string>;
  currentSlotValue: string | null; onChange: (id: string | null) => void; disabled: boolean;
}) {
  return (
    <select
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value || null)}
      disabled={disabled}
      className="flex-1 min-w-0 text-sm border border-stone-200 rounded-lg px-2 py-1.5 bg-white text-stone-800 disabled:opacity-50 disabled:bg-stone-100"
    >
      <option value="">Select…</option>
      {players.map((p) => {
        const taken = assignedIds.has(p.player_id) && p.player_id !== currentSlotValue;
        return (
          <option key={p.player_id} value={p.player_id} disabled={taken}>
            {p.name}{p.finals_score != null ? ` (${p.finals_score.toFixed(1)})` : ""}
          </option>
        );
      })}
    </select>
  );
}

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
      setError(json.error ?? "Failed to save pairs");
    } else {
      setSuccess(true);
      startTransition(() => router.refresh());
    }
    setSaving(false);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-stone-500 uppercase tracking-wide">
          Partner Pairs
        </h3>
        {!isLocked && (
          <button
            onClick={() => { setPairs(autoSuggestPairs(players)); setSuccess(false); }}
            className="text-xs text-sky-600 hover:text-sky-800 font-medium"
          >
            Auto-suggest
          </button>
        )}
      </div>

      {error && <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

      {isOdd && (
        <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-lg">
          Odd number of players ({players.length}). Adjust groups on the Finals Event page.
        </p>
      )}

      {pairs.map((pair, pairIdx) => (
        <div key={pairIdx} className="flex items-center gap-2 bg-stone-50 rounded-lg px-3 py-2">
          <span className="text-xs font-semibold text-stone-400 w-12 shrink-0">
            Pair {pairIdx + 1}
          </span>
          <PlayerDropdown
            players={players} value={pair[0]} assignedIds={assignedIds}
            currentSlotValue={pair[0]} onChange={(id) => updatePair(pairIdx, 0, id)}
            disabled={isLocked || saving || isPending}
          />
          <span className="text-xs text-stone-300">&</span>
          <PlayerDropdown
            players={players} value={pair[1]} assignedIds={assignedIds}
            currentSlotValue={pair[1]} onChange={(id) => updatePair(pairIdx, 1, id)}
            disabled={isLocked || saving || isPending}
          />
        </div>
      ))}

      {unassigned.length > 0 && !isOdd && (
        <p className="text-xs text-amber-600">
          {unassigned.length} unassigned: {unassigned.map((p) => p.name).join(", ")}
        </p>
      )}

      {!isLocked && (
        <button
          onClick={handleSave}
          disabled={!canSave || saving || isPending}
          className="w-full py-2 rounded-xl text-sm font-semibold text-white bg-stone-900 hover:bg-stone-800 disabled:opacity-40 transition-colors"
        >
          {saving ? "Saving…" : success ? "Saved ✓" : "Save Pairs"}
        </button>
      )}

      {isLocked && (
        <p className="text-xs text-stone-400 text-center">Pairs locked — matches generated.</p>
      )}
    </div>
  );
}
