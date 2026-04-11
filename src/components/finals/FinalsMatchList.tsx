"use client";

import React, { useState } from "react";

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

function getTeamLabel(
  p1Id: string,
  p2Id: string,
  pairsMap: Map<string, PairInfo>,
  playerNames: Map<string, string>
): { label: string; names: string } {
  // Try pair info first
  for (const pair of pairsMap.values()) {
    if (
      (pair.player1_id === p1Id && pair.player2_id === p2Id) ||
      (pair.player1_id === p2Id && pair.player2_id === p1Id)
    ) {
      return { label: pair.label, names: `${pair.player1_name} & ${pair.player2_name}` };
    }
  }
  // Fall back to player names
  const n1 = playerNames.get(p1Id) ?? "?";
  const n2 = playerNames.get(p2Id) ?? "?";
  return { label: `${n1} & ${n2}`, names: `${n1} & ${n2}` };
}

function MatchCard({
  match,
  pairsMap,
  playerNames,
  matchNumber,
  sessionId,
  isActive,
}: {
  match: FinalsMatch;
  pairsMap: Map<string, PairInfo>;
  playerNames: Map<string, string>;
  matchNumber: number;
  sessionId: string;
  isActive: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [score1, setScore1] = useState(match.team1_score || "");
  const [score2, setScore2] = useState(match.team2_score || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const team1 = getTeamLabel(match.team1_player1, match.team1_player2, pairsMap, playerNames);
  const team2 = getTeamLabel(match.team2_player1, match.team2_player2, pairsMap, playerNames);
  const isPlayed = match.winning_team != null;

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
      window.location.reload();
    }
    setSaving(false);
  }

  return (
    <div className={`rounded-lg border px-3 py-2 ${isPlayed ? "bg-stone-50 border-stone-200" : "bg-white border-stone-200"}`}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] font-bold text-stone-400 uppercase">Match {matchNumber}</span>
        {isPlayed && !editing && isActive && (
          <button onClick={() => setEditing(true)} className="text-[10px] text-sky-600 hover:text-sky-800">Edit</button>
        )}
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <span className={`text-sm font-semibold truncate ${isPlayed && match.winning_team === 1 ? "text-green-600" : "text-stone-700"}`}>
          {team1.label}
        </span>
        <span className="text-stone-300 text-xs">vs</span>
        <span className={`text-sm font-semibold truncate text-right ${isPlayed && match.winning_team === 2 ? "text-green-600" : "text-stone-700"}`}>
          {team2.label}
        </span>
      </div>

      {/* Show player names subtitle only when using pair labels */}
      {pairsMap.size > 0 && team1.label !== team1.names && (
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 mt-0.5">
          <p className="text-[11px] text-stone-400 truncate">{team1.names}</p>
          <span />
          <p className="text-[11px] text-stone-400 truncate text-right">{team2.names}</p>
        </div>
      )}

      {isPlayed && !editing && (
        <div className="text-center text-xs text-stone-500 mt-1">
          {match.team1_score} – {match.team2_score}
        </div>
      )}

      {((!isPlayed && isActive) || editing) && (
        <div className="flex items-center gap-2 mt-2">
          <input type="number" min="0" max="99" value={score1} onChange={(e) => setScore1(e.target.value)}
            className="w-14 text-center border border-stone-200 rounded-lg px-1 py-1 text-sm" placeholder="0" />
          <span className="text-stone-300 text-xs">–</span>
          <input type="number" min="0" max="99" value={score2} onChange={(e) => setScore2(e.target.value)}
            className="w-14 text-center border border-stone-200 rounded-lg px-1 py-1 text-sm" placeholder="0" />
          <button onClick={handleSave} disabled={saving}
            className="flex-1 text-xs font-semibold text-white bg-stone-900 hover:bg-stone-800 rounded-lg py-1.5 disabled:opacity-40">
            {saving ? "…" : "Save"}
          </button>
          {editing && (
            <button onClick={() => setEditing(false)} className="text-xs text-stone-400 hover:text-stone-600">Cancel</button>
          )}
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
}: {
  matches: FinalsMatch[];
  pairsInfo: Record<string, PairInfo[]>;
  playerNames?: Map<string, string>;
  sessionId: string;
  isActive: boolean;
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
          />
        ))}
      </div>
    </div>
  );
}
