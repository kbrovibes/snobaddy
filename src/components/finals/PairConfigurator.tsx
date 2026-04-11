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

export interface PairConfiguratorProps {
  sessionId: string;
  groups: Record<string, PairPlayer[]>; // { A: [...], B: [...] }
  savedPairs: Record<string, SavedPair[]>; // { A: [...], B: [...] }
  isLocked: boolean;
}

type Pair = [string | null, string | null]; // [player1_id, player2_id]

function buildInitialPairs(
  players: PairPlayer[],
  saved: SavedPair[]
): Pair[] {
  if (saved.length > 0) {
    return saved.map((s) => [s.player1_id, s.player2_id]);
  }
  // Empty pairs for half the players
  const pairCount = Math.floor(players.length / 2);
  return Array.from({ length: pairCount }, () => [null, null]);
}

function autoSuggestPairs(players: PairPlayer[]): Pair[] {
  // Sort by finals_score descending, then pair #1+#2, #3+#4, etc.
  const sorted = [...players].sort(
    (a, b) => (b.finals_score ?? 0) - (a.finals_score ?? 0)
  );
  const pairs: Pair[] = [];
  for (let i = 0; i + 1 < sorted.length; i += 2) {
    pairs.push([sorted[i].player_id, sorted[i + 1].player_id]);
  }
  return pairs;
}

function GroupPairEditor({
  groupLabel,
  players,
  pairs,
  onChange,
  disabled,
}: {
  groupLabel: string;
  players: PairPlayer[];
  pairs: Pair[];
  onChange: (pairs: Pair[]) => void;
  disabled: boolean;
}) {
  const playerMap = new Map(players.map((p) => [p.player_id, p]));
  const isOdd = players.length % 2 !== 0;

  // All assigned player IDs across all pairs in this group
  const assignedIds = new Set(pairs.flatMap((p) => p.filter(Boolean) as string[]));

  function updatePair(pairIdx: number, slot: 0 | 1, playerId: string | null) {
    const next = pairs.map((p) => [...p] as Pair);
    next[pairIdx][slot] = playerId;
    onChange(next);
  }

  function handleAutoSuggest() {
    onChange(autoSuggestPairs(players));
  }

  // Unassigned players
  const unassigned = players.filter((p) => !assignedIds.has(p.player_id));

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-stone-700">
          Group {groupLabel}
          <span className="ml-2 text-xs font-normal text-stone-400">
            {players.length} players · {pairs.length} pairs
          </span>
        </h3>
        {!disabled && (
          <button
            onClick={handleAutoSuggest}
            className="text-xs text-sky-600 hover:text-sky-800 font-medium"
          >
            Auto-suggest
          </button>
        )}
      </div>

      {isOdd && (
        <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-lg">
          Group {groupLabel} has an odd number of players ({players.length}). All groups must have an even number to form pairs. Adjust group assignments on the Finals Event page.
        </p>
      )}

      {pairs.map((pair, pairIdx) => (
        <div key={pairIdx} className="flex items-center gap-2 bg-stone-50 rounded-lg px-3 py-2">
          <span className="text-xs font-semibold text-stone-400 w-12 shrink-0">
            Pair {pairIdx + 1}
          </span>
          <PlayerDropdown
            players={players}
            value={pair[0]}
            assignedIds={assignedIds}
            currentSlotValue={pair[0]}
            onChange={(id) => updatePair(pairIdx, 0, id)}
            disabled={disabled}
          />
          <span className="text-xs text-stone-300">&</span>
          <PlayerDropdown
            players={players}
            value={pair[1]}
            assignedIds={assignedIds}
            currentSlotValue={pair[1]}
            onChange={(id) => updatePair(pairIdx, 1, id)}
            disabled={disabled}
          />
        </div>
      ))}

      {unassigned.length > 0 && !isOdd && (
        <p className="text-xs text-amber-600">
          {unassigned.length} unassigned: {unassigned.map((p) => p.name).join(", ")}
        </p>
      )}
    </div>
  );
}

function PlayerDropdown({
  players,
  value,
  assignedIds,
  currentSlotValue,
  onChange,
  disabled,
}: {
  players: PairPlayer[];
  value: string | null;
  assignedIds: Set<string>;
  currentSlotValue: string | null;
  onChange: (id: string | null) => void;
  disabled: boolean;
}) {
  return (
    <select
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value || null)}
      disabled={disabled}
      className="flex-1 min-w-0 text-sm border border-stone-200 rounded-lg px-2 py-1.5 bg-white text-stone-800 disabled:opacity-50 disabled:bg-stone-100"
    >
      <option value="">Select player…</option>
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
  groups,
  savedPairs,
  isLocked,
}: PairConfiguratorProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // State per group
  const groupLabels = Object.keys(groups).sort();
  const [pairState, setPairState] = useState<Record<string, Pair[]>>(() => {
    const init: Record<string, Pair[]> = {};
    for (const label of groupLabels) {
      init[label] = buildInitialPairs(groups[label], savedPairs[label] ?? []);
    }
    return init;
  });

  const handleGroupChange = useCallback((label: string, pairs: Pair[]) => {
    setPairState((prev) => ({ ...prev, [label]: pairs }));
    setSuccess(false);
  }, []);

  // Validation
  const validationErrors: string[] = [];
  for (const label of groupLabels) {
    const players = groups[label];
    const pairs = pairState[label];
    if (players.length % 2 !== 0) {
      validationErrors.push(`Group ${label} has an odd number of players.`);
    }
    const allAssigned = pairs.every((p) => p[0] && p[1]);
    if (!allAssigned) {
      validationErrors.push(`Group ${label} has unassigned slots.`);
    }
    // Check for duplicate assignments within this group
    const ids = pairs.flatMap((p) => p.filter(Boolean) as string[]);
    if (new Set(ids).size !== ids.length) {
      validationErrors.push(`Group ${label} has duplicate player assignments.`);
    }
  }
  const canSave = validationErrors.length === 0 && !isLocked;

  async function handleSave() {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    setSuccess(false);

    const pairsPayload: Record<string, SavedPair[]> = {};
    for (const label of groupLabels) {
      pairsPayload[label] = pairState[label].map((p) => ({
        player1_id: p[0]!,
        player2_id: p[1]!,
      }));
    }

    const res = await fetch(`/api/sessions/${sessionId}/finals-format/pairs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pairs: pairsPayload }),
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
    <div className="flex flex-col gap-4">
      <h2 className="text-sm font-semibold text-stone-500 uppercase tracking-wide">
        Partner Pairs
      </h2>

      {error && (
        <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
      )}

      {groupLabels.map((label) => (
        <GroupPairEditor
          key={label}
          groupLabel={label}
          players={groups[label]}
          pairs={pairState[label]}
          onChange={(pairs) => handleGroupChange(label, pairs)}
          disabled={isLocked || saving || isPending}
        />
      ))}

      {!isLocked && (
        <div className="flex flex-col gap-2">
          {validationErrors.length > 0 && (
            <div className="text-xs text-amber-600 space-y-0.5">
              {validationErrors.map((e, i) => (
                <p key={i}>• {e}</p>
              ))}
            </div>
          )}
          <button
            onClick={handleSave}
            disabled={!canSave || saving || isPending}
            className="w-full py-2.5 rounded-xl text-sm font-semibold text-white bg-stone-900 hover:bg-stone-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? "Saving…" : success ? "Pairs Saved ✓" : "Save Pairs"}
          </button>
        </div>
      )}

      {isLocked && (
        <p className="text-xs text-stone-400 text-center">
          Pairs are locked — matches have already been generated.
        </p>
      )}
    </div>
  );
}
