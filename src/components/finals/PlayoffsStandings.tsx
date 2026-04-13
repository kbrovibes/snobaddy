"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { FinalsMatch } from "./FinalsMatchList";

interface PlayerStanding {
  playerId: string;
  name: string;
  wins: number;
  losses: number;
  played: number;
  total: number;
  pts: number;
  pf: number;
  rank: number;
  advancesTop4: boolean;
}

function computeIndividualStandings(
  matches: FinalsMatch[],
  playerNames: Map<string, string>
): PlayerStanding[] {
  const stats = new Map<string, { wins: number; losses: number; pf: number; played: number; total: number }>();

  // Count how many matches each player is assigned to (played or not)
  const totalPerPlayer = new Map<string, number>();
  for (const id of playerNames.keys()) totalPerPlayer.set(id, 0);
  for (const m of matches) {
    for (const pid of [m.team1_player1, m.team1_player2, m.team2_player1, m.team2_player2]) {
      totalPerPlayer.set(pid, (totalPerPlayer.get(pid) ?? 0) + 1);
    }
  }

  for (const id of playerNames.keys()) {
    stats.set(id, { wins: 0, losses: 0, pf: 0, played: 0, total: totalPerPlayer.get(id) ?? 0 });
  }

  for (const m of matches) {
    if (m.winning_team == null) continue;

    const team1 = [m.team1_player1, m.team1_player2];
    const team2 = [m.team2_player1, m.team2_player2];

    for (const pid of team1) {
      const s = stats.get(pid);
      if (!s) continue;
      s.played++;
      s.pf += m.team1_score;
      if (m.winning_team === 1) s.wins++;
      else s.losses++;
    }
    for (const pid of team2) {
      const s = stats.get(pid);
      if (!s) continue;
      s.played++;
      s.pf += m.team2_score;
      if (m.winning_team === 2) s.wins++;
      else s.losses++;
    }
  }

  const standings: PlayerStanding[] = [];
  for (const [pid, s] of stats) {
    standings.push({
      playerId: pid,
      name: playerNames.get(pid) ?? "Unknown",
      wins: s.wins,
      losses: s.losses,
      played: s.played,
      total: s.total,
      pts: s.pf + s.wins * 2,
      pf: s.pf,
      rank: 0,
      advancesTop4: false,
    });
  }

  // Sort: pts desc → pf desc → alphabetical
  standings.sort((a, b) => {
    if (b.pts !== a.pts) return b.pts - a.pts;
    if (b.pf !== a.pf) return b.pf - a.pf;
    return a.name.localeCompare(b.name);
  });

  standings.forEach((s, i) => {
    s.rank = i + 1;
    s.advancesTop4 = i < 4;
  });

  return standings;
}

export default function PlayoffsStandings({
  matches,
  playerNames,
  sessionId,
  finalsGroup,
  formatId,
  formatStatus,
  isGodMode,
}: {
  matches: FinalsMatch[];
  playerNames: Map<string, string>;
  sessionId: string;
  finalsGroup: string;
  formatId: string;
  formatStatus: string;
  isGodMode: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const standings = computeIndividualStandings(matches, playerNames);
  const totalMatches = matches.length;
  const playedMatches = matches.filter((m) => m.winning_team != null).length;
  const allPlayed = totalMatches > 0 && playedMatches === totalMatches;
  const canGenerateFinals = allPlayed && formatStatus === "matches_generated" && isGodMode;

  async function handleGenerateFinals() {
    setGenerating(true);
    setError(null);
    const top4 = standings.slice(0, 4).map((s) => s.playerId);
    const res = await fetch(`/api/sessions/${sessionId}/finals-series`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ finals_group: finalsGroup, format_id: formatId, top4 }),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? "Failed to generate finals");
    } else {
      startTransition(() => router.refresh());
    }
    setGenerating(false);
  }

  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-xs font-semibold text-stone-500 uppercase tracking-wide">
        Standings
      </h3>

      {/* Progress */}
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1.5 bg-stone-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-sky-600 rounded-full transition-all"
            style={{ width: `${totalMatches > 0 ? (playedMatches / totalMatches) * 100 : 0}%` }}
          />
        </div>
        <span className="text-xs text-stone-400">{playedMatches}/{totalMatches}</span>
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-stone-100 bg-stone-50 text-[11px] text-stone-400 uppercase">
              <th className="text-left px-3 py-1.5 font-medium w-8">#</th>
              <th className="text-left px-2 py-1.5 font-medium">Player</th>
              <th className="text-center px-2 py-1.5 font-medium w-12">M</th>
              <th className="text-center px-2 py-1.5 font-medium w-10">W</th>
              <th className="text-center px-2 py-1.5 font-medium w-10">L</th>
              <th className="text-center px-2 py-1.5 font-medium w-10">Pts</th>
            </tr>
          </thead>
          <tbody>
            {standings.map((s) => (
              <tr
                key={s.playerId}
                className={[
                  "border-b border-stone-100 last:border-0",
                  allPlayed && s.advancesTop4 ? "bg-green-50" : "",
                ].join(" ")}
              >
                <td className="px-3 py-1.5 text-xs text-stone-400">{s.rank}</td>
                <td className="px-2 py-1.5">
                  <span className="text-stone-800">{s.name}</span>
                  {allPlayed && s.advancesTop4 && (
                    <span className="ml-1 text-[10px] text-green-600 font-semibold">🏁 Top 4</span>
                  )}
                </td>
                <td className="text-center px-2 py-1.5 text-xs text-stone-400">{s.played}/{s.total}</td>
                <td className="text-center px-2 py-1.5 font-semibold text-green-600">{s.wins}</td>
                <td className="text-center px-2 py-1.5 font-semibold text-red-400">{s.losses}</td>
                <td className="text-center px-2 py-1.5 font-bold text-stone-700">{s.pts}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {error && (
        <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
      )}

      {canGenerateFinals && (
        <button
          onClick={handleGenerateFinals}
          disabled={generating || isPending}
          className="w-full py-2.5 text-sm font-semibold text-white bg-sky-700 hover:bg-sky-600 rounded-xl disabled:opacity-40 transition-colors"
        >
          {generating ? "Generating…" : "Generate Best-of-3 Finals →"}
        </button>
      )}

      {allPlayed && formatStatus === "matches_generated" && !isGodMode && (
        <p className="text-xs text-stone-400 text-center">
          All group matches complete. Admin will set up the finals.
        </p>
      )}
    </div>
  );
}
