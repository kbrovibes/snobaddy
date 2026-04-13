"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export interface FinalsMatch {
  id: string;
  team1_player1: string;
  team1_player2: string;
  team2_player1: string;
  team2_player2: string;
  team1_score: number;
  team2_score: number;
  winning_team: number | null;
  finals_group: string;
}

export interface PairInfo {
  label: string;
  player1_name: string;
  player2_name: string;
  player1_id: string;
  player2_id: string;
}

// Generate a fun blended team name from two first names
// e.g. Karthik + Sahit → KarHit, Varun + Vasu → VaVa
function generateFunName(name1: string, name2: string): string {
  const a = name1.split(" ")[0];
  const b = name2.split(" ")[0];

  // Find a good split point for each name (prefer syllable-ish breaks)
  // Try splitting at vowel→consonant boundaries for natural feel
  function splitPoints(name: string): number[] {
    const vowels = new Set("aeiouAEIOU");
    const pts: number[] = [];
    for (let i = 2; i <= Math.min(name.length - 1, 5); i++) {
      // Prefer right after a vowel (syllable break)
      if (vowels.has(name[i - 1]) && !vowels.has(name[i])) pts.unshift(i);
      else pts.push(i);
    }
    if (pts.length === 0) pts.push(Math.ceil(name.length / 2));
    return pts;
  }

  const aSplits = splitPoints(a);
  const bSplits = splitPoints(b);

  // Take prefix of first name + suffix of second name
  const aPrefix = a.slice(0, aSplits[0]);
  const bSuffix = b.slice(bSplits[0]);

  // Capitalize nicely
  const fun = aPrefix + bSuffix.charAt(0).toUpperCase() + bSuffix.slice(1);

  // If too short (< 3), fallback to first 2 + first 2
  if (fun.length < 3) {
    return a.slice(0, 2) + b.slice(0, 2).charAt(0).toUpperCase() + b.slice(1, 2);
  }

  return fun;
}

function getTeamLabel(
  p1Id: string,
  p2Id: string,
  pairsMap: Map<string, PairInfo>,
  playerNames: Map<string, string>,
  funNames?: boolean
): { label: string; names: string } {
  // Try pair info first
  for (const pair of pairsMap.values()) {
    if (
      (pair.player1_id === p1Id && pair.player2_id === p2Id) ||
      (pair.player1_id === p2Id && pair.player2_id === p1Id)
    ) {
      return { label: pair.label, names: `${pair.player1_name.split(" ")[0]} & ${pair.player2_name.split(" ")[0]}` };
    }
  }
  // Fall back to player names (first name only)
  const n1 = (playerNames.get(p1Id) ?? "?").split(" ")[0];
  const n2 = (playerNames.get(p2Id) ?? "?").split(" ")[0];
  const label = funNames ? generateFunName(n1, n2) : `${n1} & ${n2}`;
  return { label, names: `${n1} & ${n2}` };
}

function MatchCard({
  match,
  pairsMap,
  playerNames,
  matchNumber,
  sessionId,
  isActive,
  funNames,
  allComplete,
}: {
  match: FinalsMatch;
  pairsMap: Map<string, PairInfo>;
  playerNames: Map<string, string>;
  matchNumber: number;
  funNames: boolean;
  allComplete: boolean;
  sessionId: string;
  isActive: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [score1, setScore1] = useState(String(match.team1_score || ""));
  const [score2, setScore2] = useState(String(match.team2_score || ""));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const team1 = getTeamLabel(match.team1_player1, match.team1_player2, pairsMap, playerNames, funNames);
  const team2 = getTeamLabel(match.team2_player1, match.team2_player2, pairsMap, playerNames, funNames);
  const isPlayed = match.winning_team != null;
  const winnerName = isPlayed
    ? match.winning_team === 1 ? team1.label : team2.label
    : null;

  async function handleSave() {
    const s1 = Number(score1);
    const s2 = Number(score2);
    if (isNaN(s1) || isNaN(s2) || s1 < 0 || s2 < 0) { setError("Enter valid scores"); return; }
    if (s1 === s2) { setError("Scores cannot be tied"); return; }
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/matches/${match.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ team1_score: s1, team2_score: s2 }),
    });
    if (!res.ok) {
      const json = await res.json();
      setError(json.error ?? "Failed to save");
    } else {
      setEditing(false);
      startTransition(() => router.refresh());
    }
    setSaving(false);
  }

  return (
    <div className={`rounded-xl border px-3 py-2.5 transition-colors ${
      isPlayed && !allComplete ? "bg-emerald-50/50 border-emerald-200" : "bg-white border-stone-200"
    }`}>
      {/* Header: match number + status */}
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[10px] font-bold text-stone-400 uppercase">Match {matchNumber}</span>
        <div className="flex items-center gap-2">
          {isPlayed && !editing && isActive && (
            <button onClick={() => { setEditing(true); setScore1(String(match.team1_score)); setScore2(String(match.team2_score)); }}
              className="text-[10px] text-sky-600 hover:text-sky-800">
              Edit
            </button>
          )}
          {isPlayed && !editing && !allComplete && (
            <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-100 px-1.5 py-0.5 rounded-full">
              ✓
            </span>
          )}
        </div>
      </div>

      {/* Teams — same layout as normal session match cards */}
      <div className="text-sm">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          <span className={`font-semibold truncate text-left ${isPlayed ? (match.winning_team === 1 ? "text-green-600" : "text-stone-400") : "text-stone-700"}`}>
            {team1.label}
          </span>
          <span className="text-stone-300 text-center w-6">vs</span>
          <span className={`font-semibold truncate text-left ${isPlayed ? (match.winning_team === 2 ? "text-green-600" : "text-stone-400") : "text-stone-700"}`}>
            {team2.label}
          </span>
        </div>

        {/* Player names subtitle for pair labels */}
        {pairsMap.size > 0 && team1.label !== team1.names && (
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 mt-0.5">
            <p className="text-[11px] text-stone-400 truncate">{team1.names}</p>
            <span className="w-6" />
            <p className="text-[11px] text-stone-400 truncate">{team2.names}</p>
          </div>
        )}

        {/* Score + winner line */}
        {isPlayed && !editing && (
          <div className="text-xs text-stone-400 mt-0.5">
            {match.team1_score} – {match.team2_score} · {winnerName} won
          </div>
        )}
      </div>

      {/* Score entry (unplayed or editing) */}
      {((!isPlayed && isActive) || editing) && (
        <div className="mt-2 flex flex-col gap-2">
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
            <input type="text" inputMode="numeric" pattern="[0-9]*" value={score1} onChange={(e) => setScore1(e.target.value.replace(/\D/g, ""))}
              className="w-full text-center border border-stone-200 rounded-lg py-1.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-sky-300 bg-stone-50" placeholder="—" />
            <span className="text-stone-300 text-center w-6">–</span>
            <input type="text" inputMode="numeric" pattern="[0-9]*" value={score2} onChange={(e) => setScore2(e.target.value.replace(/\D/g, ""))}
              className="w-full text-center border border-stone-200 rounded-lg py-1.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-sky-300 bg-stone-50" placeholder="—" />
          </div>
          <div className="flex justify-center gap-2">
            <button onClick={handleSave} disabled={saving || isPending}
              className="px-5 text-xs font-semibold text-white bg-stone-900 hover:bg-stone-800 rounded-lg py-2 disabled:opacity-40 transition-colors">
              {saving ? "Saving…" : "Save"}
            </button>
            {editing && (
              <button onClick={() => setEditing(false)}
                className="px-4 text-xs text-stone-400 hover:text-stone-600 border border-stone-200 rounded-lg py-2 transition-colors">
                Cancel
              </button>
            )}
          </div>
        </div>
      )}

      {error && <p className="text-[10px] text-red-500 mt-1">{error}</p>}
    </div>
  );
}

export default function FinalsMatchList({
  matches,
  pairsInfo,
  playerNames: playerNamesProp,
  sessionId,
  isActive,
  funNames = false,
  forceAllComplete = false,
}: {
  matches: FinalsMatch[];
  pairsInfo: Record<string, PairInfo[]>;
  playerNames?: Map<string, string>;
  sessionId: string;
  isActive: boolean;
  funNames?: boolean;
  forceAllComplete?: boolean;
}) {
  // Build pairs map from all groups (usually just one since parent filters)
  const pairsMap = new Map<string, PairInfo>();
  for (const pairs of Object.values(pairsInfo)) {
    for (const pair of pairs) {
      pairsMap.set(`${pair.player1_id}-${pair.player2_id}`, pair);
    }
  }

  const playerNames = playerNamesProp ?? new Map<string, string>();
  const playedCount = matches.filter((m) => m.winning_team != null).length;
  const allComplete = forceAllComplete || (matches.length > 0 && playedCount === matches.length);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold text-stone-500 uppercase tracking-wide">
          Matches
        </h2>
        <span className="text-xs text-stone-400">{playedCount}/{matches.length} played</span>
      </div>

      {/* Progress */}
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1.5 bg-stone-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-sky-600 rounded-full transition-all"
            style={{ width: `${matches.length > 0 ? (playedCount / matches.length) * 100 : 0}%` }}
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {matches.map((m, i) => (
          <MatchCard
            key={m.id}
            match={m}
            pairsMap={pairsMap}
            playerNames={playerNames}
            matchNumber={i + 1}
            sessionId={sessionId}
            isActive={isActive}
            funNames={funNames}
            allComplete={allComplete}
          />
        ))}
      </div>
    </div>
  );
}
