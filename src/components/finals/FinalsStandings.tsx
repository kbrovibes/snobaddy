"use client";

import React, { useState } from "react";
import type { FinalsMatch, PairInfo } from "./FinalsMatchList";

interface PairStanding {
  pairIndex: number;
  label: string;
  player1_name: string;
  player2_name: string;
  player1_id: string;
  player2_id: string;
  wins: number;
  losses: number;
  pf: number; // points for
  pa: number; // points against
  diff: number; // PF - PA
}

function matchesPair(
  p1Id: string,
  p2Id: string,
  pairPlayer1: string,
  pairPlayer2: string
): boolean {
  return (
    (p1Id === pairPlayer1 && p2Id === pairPlayer2) ||
    (p1Id === pairPlayer2 && p2Id === pairPlayer1)
  );
}

function computeStandings(
  matches: FinalsMatch[],
  pairs: PairInfo[]
): PairStanding[] {
  const standings: PairStanding[] = pairs.map((pair, idx) => ({
    pairIndex: idx,
    label: pair.label,
    player1_name: pair.player1_name,
    player2_name: pair.player2_name,
    player1_id: pair.player1_id,
    player2_id: pair.player2_id,
    wins: 0,
    losses: 0,
    pf: 0,
    pa: 0,
    diff: 0,
  }));

  for (const match of matches) {
    if (match.winning_team == null) continue;

    for (const standing of standings) {
      const isTeam1 = matchesPair(
        match.team1_player1,
        match.team1_player2,
        standing.player1_id,
        standing.player2_id
      );
      const isTeam2 = matchesPair(
        match.team2_player1,
        match.team2_player2,
        standing.player1_id,
        standing.player2_id
      );

      if (isTeam1) {
        standing.pf += match.team1_score;
        standing.pa += match.team2_score;
        if (match.winning_team === 1) standing.wins++;
        else standing.losses++;
      } else if (isTeam2) {
        standing.pf += match.team2_score;
        standing.pa += match.team1_score;
        if (match.winning_team === 2) standing.wins++;
        else standing.losses++;
      }
    }
  }

  for (const s of standings) {
    s.diff = s.pf - s.pa;
  }

  // Sort: wins desc, then diff desc
  standings.sort((a, b) => b.wins - a.wins || b.diff - a.diff);

  return standings;
}

function detectTies(standings: PairStanding[]): { type: "none" | "2-way" | "3-way"; tiedPairs: PairStanding[] } {
  if (standings.length < 2) return { type: "none", tiedPairs: [] };

  const top = standings[0];
  const tied = standings.filter(
    (s) => s.wins === top.wins && s.diff === top.diff
  );

  if (tied.length === 1) return { type: "none", tiedPairs: [] };
  if (tied.length === 2) return { type: "2-way", tiedPairs: tied };
  return { type: "3-way", tiedPairs: tied };
}

export default function FinalsStandings({
  matches,
  pairsInfo,
  sessionId,
  formatStatus,
  isGodMode,
}: {
  matches: FinalsMatch[];
  pairsInfo: Record<string, PairInfo[]>;
  sessionId: string;
  formatStatus: string;
  isGodMode: boolean;
}) {
  const groups = Object.keys(pairsInfo).sort();
  const [activeGroup, setActiveGroup] = useState(groups[0] ?? "A");
  const [tiebreakWinner, setTiebreakWinner] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const groupMatches = matches.filter((m) => m.finals_group === activeGroup);
  const groupPairs = pairsInfo[activeGroup] ?? [];
  const standings = computeStandings(groupMatches, groupPairs);

  const totalMatches = groupMatches.length;
  const playedMatches = groupMatches.filter((m) => m.winning_team != null).length;
  const allPlayed = totalMatches > 0 && playedMatches === totalMatches;

  const tie = allPlayed ? detectTies(standings) : { type: "none" as const, tiedPairs: [] };

  // Winner: first place if all played and no tie (or tie resolved)
  const winner = allPlayed && tie.type === "none" ? standings[0] : null;

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold text-stone-500 uppercase tracking-wide">
        Standings
      </h2>

      {/* Group tabs */}
      {groups.length > 1 && (
        <div className="flex gap-1 bg-stone-100 rounded-lg p-0.5">
          {groups.map((g) => (
            <button
              key={g}
              onClick={() => { setActiveGroup(g); setTiebreakWinner(null); }}
              className={`flex-1 text-sm font-semibold py-1.5 rounded-md transition-colors ${
                activeGroup === g
                  ? "bg-white text-stone-900 shadow-sm"
                  : "text-stone-500 hover:text-stone-700"
              }`}
            >
              Group {g}
            </button>
          ))}
        </div>
      )}

      {/* Standings table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-stone-400 uppercase">
              <th className="text-left py-1.5 pr-2">#</th>
              <th className="text-left py-1.5">Team</th>
              <th className="text-center py-1.5 px-1.5">W</th>
              <th className="text-center py-1.5 px-1.5">L</th>
              <th className="text-center py-1.5 px-1.5">PF</th>
              <th className="text-center py-1.5 px-1.5">PA</th>
              <th className="text-center py-1.5 px-1.5">+/-</th>
            </tr>
          </thead>
          <tbody>
            {standings.map((s, idx) => {
              const isWinner = winner && idx === 0;
              const isTied = tie.tiedPairs.some((t) => t.pairIndex === s.pairIndex);
              return (
                <tr
                  key={s.pairIndex}
                  className={[
                    "border-t border-stone-100",
                    isWinner ? "bg-green-50" : "",
                    isTied ? "bg-amber-50" : "",
                  ].join(" ")}
                >
                  <td className="py-2 pr-2 text-stone-400 font-mono text-xs">{idx + 1}</td>
                  <td className="py-2">
                    <span className="font-semibold text-stone-800">
                      {s.label}
                      {isWinner && " 🏆"}
                    </span>
                  </td>
                  <td className="text-center font-semibold text-green-600">{s.wins}</td>
                  <td className="text-center font-semibold text-red-400">{s.losses}</td>
                  <td className="text-center text-stone-500">{s.pf}</td>
                  <td className="text-center text-stone-500">{s.pa}</td>
                  <td className={`text-center font-semibold ${s.diff > 0 ? "text-green-600" : s.diff < 0 ? "text-red-400" : "text-stone-400"}`}>
                    {s.diff > 0 ? `+${s.diff}` : s.diff}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Tie resolution */}
      {allPlayed && tie.type === "2-way" && isGodMode && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm">
          <p className="font-semibold text-amber-800 mb-1">
            2-way tie in Group {activeGroup}!
          </p>
          <p className="text-amber-700 text-xs mb-2">
            {tie.tiedPairs.map((t) => t.label).join(" and ")} are tied at {tie.tiedPairs[0].wins}W {tie.tiedPairs[0].diff > 0 ? "+" : ""}{tie.tiedPairs[0].diff} diff. Record a tiebreak match to decide the winner.
          </p>
        </div>
      )}

      {allPlayed && tie.type === "3-way" && isGodMode && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm">
          <p className="font-semibold text-amber-800 mb-1">
            {tie.tiedPairs.length}-way tie in Group {activeGroup}!
          </p>
          <p className="text-amber-700 text-xs mb-2">
            {tie.tiedPairs.map((t) => t.label).join(", ")} are tied. Manually select the winner:
          </p>
          <div className="flex items-center gap-2">
            <select
              value={tiebreakWinner ?? ""}
              onChange={(e) => setTiebreakWinner(e.target.value || null)}
              className="flex-1 text-sm border border-amber-200 rounded-lg px-2 py-1.5 bg-white"
            >
              <option value="">Select winner…</option>
              {tie.tiedPairs.map((t) => (
                <option key={t.pairIndex} value={t.label}>
                  {t.label} ({t.player1_name} & {t.player2_name})
                </option>
              ))}
            </select>
            <button
              disabled={!tiebreakWinner || saving}
              onClick={async () => {
                // For 3-way ties, we just display the selection visually
                // The actual winner tracking is handled by format completion in Task 9 scope
                setSaving(true);
                // TODO: persist manual winner selection to format config
                setSaving(false);
              }}
              className="text-xs font-semibold text-white bg-amber-600 hover:bg-amber-500 rounded-lg px-3 py-1.5 disabled:opacity-40"
            >
              Confirm
            </button>
          </div>
        </div>
      )}

      {/* Winner display */}
      {winner && (
        <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-center">
          <p className="text-lg font-bold text-green-700">
            🏆 Group {activeGroup} Winner
          </p>
          <p className="text-sm text-green-600">
            {winner.label}: {winner.player1_name} & {winner.player2_name}
          </p>
          <p className="text-xs text-green-500 mt-0.5">
            {winner.wins}W – {winner.losses}L · {winner.pf} PF · {winner.diff > 0 ? "+" : ""}{winner.diff} diff
          </p>
        </div>
      )}
    </div>
  );
}
