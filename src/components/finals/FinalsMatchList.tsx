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
  label: string; // "Pair 1", "Pair 2", etc.
  player1_name: string;
  player2_name: string;
  player1_id: string;
  player2_id: string;
}

function getPairLabel(
  p1Id: string,
  p2Id: string,
  pairsMap: Map<string, PairInfo>
): PairInfo | null {
  // Match by both player IDs (order-independent)
  for (const pair of pairsMap.values()) {
    if (
      (pair.player1_id === p1Id && pair.player2_id === p2Id) ||
      (pair.player1_id === p2Id && pair.player2_id === p1Id)
    ) {
      return pair;
    }
  }
  return null;
}

function MatchCard({
  match,
  pairsMap,
  matchNumber,
  sessionId,
  isActive,
}: {
  match: FinalsMatch;
  pairsMap: Map<string, PairInfo>;
  matchNumber: number;
  sessionId: string;
  isActive: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [score1, setScore1] = useState(match.team1_score || "");
  const [score2, setScore2] = useState(match.team2_score || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pair1 = getPairLabel(match.team1_player1, match.team1_player2, pairsMap);
  const pair2 = getPairLabel(match.team2_player1, match.team2_player2, pairsMap);

  const isPlayed = match.winning_team != null;

  async function handleSave() {
    const s1 = Number(score1);
    const s2 = Number(score2);
    if (isNaN(s1) || isNaN(s2) || s1 < 0 || s2 < 0) {
      setError("Enter valid scores");
      return;
    }
    if (s1 === s2) {
      setError("Scores cannot be tied");
      return;
    }

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
      // Refresh the page to show updated scores
      window.location.reload();
    }
    setSaving(false);
  }

  return (
    <div className={`rounded-lg border px-3 py-2.5 ${isPlayed ? "bg-stone-50 border-stone-200" : "bg-white border-stone-200"}`}>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[10px] font-bold text-stone-400 uppercase">
          Match {matchNumber}
        </span>
        {isPlayed && !editing && isActive && (
          <button
            onClick={() => setEditing(true)}
            className="text-[10px] text-sky-600 hover:text-sky-800"
          >
            Edit
          </button>
        )}
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <div className={`text-sm font-semibold truncate ${isPlayed && match.winning_team === 1 ? "text-green-600" : "text-stone-700"}`}>
          {pair1 ? (
            <span title={`${pair1.player1_name} & ${pair1.player2_name}`}>
              {pair1.label}
            </span>
          ) : (
            "Team 1"
          )}
        </div>
        <span className="text-stone-300 text-xs">vs</span>
        <div className={`text-sm font-semibold truncate text-right ${isPlayed && match.winning_team === 2 ? "text-green-600" : "text-stone-700"}`}>
          {pair2 ? (
            <span title={`${pair2.player1_name} & ${pair2.player2_name}`}>
              {pair2.label}
            </span>
          ) : (
            "Team 2"
          )}
        </div>
      </div>

      {/* Player names subtitle */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 mt-0.5">
        <p className="text-[11px] text-stone-400 truncate">
          {pair1 ? `${pair1.player1_name} & ${pair1.player2_name}` : ""}
        </p>
        <span />
        <p className="text-[11px] text-stone-400 truncate text-right">
          {pair2 ? `${pair2.player1_name} & ${pair2.player2_name}` : ""}
        </p>
      </div>

      {/* Scores */}
      {isPlayed && !editing && (
        <div className="text-center text-xs text-stone-500 mt-1.5">
          {match.team1_score} – {match.team2_score}
        </div>
      )}

      {/* Score entry / edit */}
      {((!isPlayed && isActive) || editing) && (
        <div className="flex items-center gap-2 mt-2">
          <input
            type="number"
            min="0"
            max="99"
            value={score1}
            onChange={(e) => setScore1(e.target.value)}
            className="w-14 text-center border border-stone-200 rounded-lg px-1 py-1 text-sm"
            placeholder="0"
          />
          <span className="text-stone-300 text-xs">–</span>
          <input
            type="number"
            min="0"
            max="99"
            value={score2}
            onChange={(e) => setScore2(e.target.value)}
            className="w-14 text-center border border-stone-200 rounded-lg px-1 py-1 text-sm"
            placeholder="0"
          />
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 text-xs font-semibold text-white bg-stone-900 hover:bg-stone-800 rounded-lg py-1.5 disabled:opacity-40"
          >
            {saving ? "…" : "Save"}
          </button>
          {editing && (
            <button
              onClick={() => setEditing(false)}
              className="text-xs text-stone-400 hover:text-stone-600"
            >
              Cancel
            </button>
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
  sessionId,
  isActive,
}: {
  matches: FinalsMatch[];
  pairsInfo: Record<string, PairInfo[]>; // { A: [...], B: [...] }
  sessionId: string;
  isActive: boolean;
}) {
  const groups = [...new Set(matches.map((m) => m.finals_group))].sort();
  const [activeGroup, setActiveGroup] = useState(groups[0] ?? "A");

  // Build pairs map for active group
  const pairsMap = new Map<string, PairInfo>();
  for (const pair of pairsInfo[activeGroup] ?? []) {
    pairsMap.set(`${pair.player1_id}-${pair.player2_id}`, pair);
  }

  const groupMatches = matches.filter((m) => m.finals_group === activeGroup);
  const playedCount = groupMatches.filter((m) => m.winning_team != null).length;

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold text-stone-500 uppercase tracking-wide">
        Matches
      </h2>

      {/* Group tabs */}
      {groups.length > 1 && (
        <div className="flex gap-1 bg-stone-100 rounded-lg p-0.5">
          {groups.map((g) => {
            const gMatches = matches.filter((m) => m.finals_group === g);
            const gPlayed = gMatches.filter((m) => m.winning_team != null).length;
            return (
              <button
                key={g}
                onClick={() => setActiveGroup(g)}
                className={`flex-1 text-sm font-semibold py-1.5 rounded-md transition-colors ${
                  activeGroup === g
                    ? "bg-white text-stone-900 shadow-sm"
                    : "text-stone-500 hover:text-stone-700"
                }`}
              >
                Group {g}
                <span className="ml-1 text-xs font-normal text-stone-400">
                  {gPlayed}/{gMatches.length}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Progress */}
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1.5 bg-stone-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-sky-600 rounded-full transition-all"
            style={{ width: `${groupMatches.length > 0 ? (playedCount / groupMatches.length) * 100 : 0}%` }}
          />
        </div>
        <span className="text-xs text-stone-400">{playedCount}/{groupMatches.length}</span>
      </div>

      {/* Match cards */}
      <div className="flex flex-col gap-2">
        {groupMatches.map((m, i) => (
          <MatchCard
            key={m.id}
            match={m}
            pairsMap={pairsMap}
            matchNumber={i + 1}
            sessionId={sessionId}
            isActive={isActive}
          />
        ))}
      </div>
    </div>
  );
}
