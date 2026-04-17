"use client";

import React, { useState } from "react";
import type { FinalsFormatData } from "./FormatPicker";
import type { PairPlayer } from "./PairConfigurator";
import type { FinalsMatch } from "./FinalsMatchList";

interface SeriesData {
  id: string;
  team1_player1_id: string;
  team1_player2_id: string;
  team1_seed: string | null;
  team2_player1_id: string;
  team2_player2_id: string;
  team2_seed: string | null;
  team1_wins: number;
  team2_wins: number;
  winning_team: number | null;
  status: string;
}

interface SavedPair {
  player1_id: string;
  player2_id: string;
}

interface FinalsCompletedViewProps {
  formats: Record<string, FinalsFormatData>;
  groups: Record<string, PairPlayer[]>;
  matches: FinalsMatch[];
  seriesMap: Record<string, SeriesData>;
}

function firstName(name: string) {
  return name.split(" ")[0];
}

interface GroupResult {
  group: string;
  winner: string | null;
  runnerUp: string | null;
  format: string;
}

interface PlayerRanking {
  name: string;
  group: string;
  wins: number;
  losses: number;
  pf: number;
  pts: number;
}

function getFixedPartnerResults(
  group: string,
  format: FinalsFormatData,
  matches: FinalsMatch[],
  players: PairPlayer[]
): { result: GroupResult; rankings: PlayerRanking[] } {
  const savedPairs: SavedPair[] = (format.config as { pairs?: SavedPair[] })?.pairs ?? [];
  const playerMap = new Map(players.map((p) => [p.player_id, p.name]));
  const groupMatches = matches.filter((m) => m.finals_group === group);

  const pairStats = savedPairs.map((pair) => {
    const p1 = playerMap.get(pair.player1_id) ?? "Unknown";
    const p2 = playerMap.get(pair.player2_id) ?? "Unknown";
    let pf = 0, wins = 0, losses = 0;
    for (const m of groupMatches) {
      if (m.winning_team == null) continue;
      const isT1 =
        (m.team1_player1 === pair.player1_id && m.team1_player2 === pair.player2_id) ||
        (m.team1_player1 === pair.player2_id && m.team1_player2 === pair.player1_id);
      const isT2 =
        (m.team2_player1 === pair.player1_id && m.team2_player2 === pair.player2_id) ||
        (m.team2_player1 === pair.player2_id && m.team2_player2 === pair.player1_id);
      if (isT1) {
        pf += m.team1_score;
        if (m.winning_team === 1) wins++;
        else losses++;
      }
      if (isT2) {
        pf += m.team2_score;
        if (m.winning_team === 2) wins++;
        else losses++;
      }
    }
    return {
      pair,
      label: `${firstName(p1)} & ${firstName(p2)}`,
      p1,
      p2,
      wins,
      losses,
      pf,
      pts: pf + wins * 2,
    };
  });

  pairStats.sort((a, b) => {
    if (b.pts !== a.pts) return b.pts - a.pts;
    if (b.wins !== a.wins) return b.wins - a.wins;
    return 0;
  });

  const winner = pairStats[0] ? pairStats[0].label : null;
  const runnerUp = pairStats[1] ? pairStats[1].label : null;

  // Build individual rankings from pair stats
  const rankings: PlayerRanking[] = [];
  for (const ps of pairStats) {
    // Each player in the pair shares the pair's record
    for (const pid of [ps.pair.player1_id, ps.pair.player2_id]) {
      const name = playerMap.get(pid) ?? "Unknown";
      rankings.push({
        name: firstName(name),
        group,
        wins: ps.wins,
        losses: ps.losses,
        pf: ps.pf,
        pts: ps.pts,
      });
    }
  }

  return {
    result: { group, winner, runnerUp, format: "Fixed Partner" },
    rankings,
  };
}

function getPlayoffsResults(
  group: string,
  format: FinalsFormatData,
  matches: FinalsMatch[],
  players: PairPlayer[],
  series: SeriesData | null
): { result: GroupResult; rankings: PlayerRanking[] } {
  const playerMap = new Map(players.map((p) => [p.player_id, p.name]));
  const groupMatches = matches.filter((m) => m.finals_group === group);

  // Individual standings
  const stats = new Map<string, { wins: number; losses: number; pf: number }>();
  for (const p of players) stats.set(p.player_id, { wins: 0, losses: 0, pf: 0 });

  for (const m of groupMatches) {
    if (m.winning_team == null) continue;
    for (const pid of [m.team1_player1, m.team1_player2]) {
      const s = stats.get(pid);
      if (s) {
        s.pf += m.team1_score;
        if (m.winning_team === 1) s.wins++;
        else s.losses++;
      }
    }
    for (const pid of [m.team2_player1, m.team2_player2]) {
      const s = stats.get(pid);
      if (s) {
        s.pf += m.team2_score;
        if (m.winning_team === 2) s.wins++;
        else s.losses++;
      }
    }
  }

  const rankings: PlayerRanking[] = [];
  for (const [pid, s] of stats) {
    rankings.push({
      name: firstName(playerMap.get(pid) ?? "Unknown"),
      group,
      wins: s.wins,
      losses: s.losses,
      pf: s.pf,
      pts: s.pf + s.wins * 2,
    });
  }
  rankings.sort((a, b) => b.pts - a.pts || b.pf - a.pf);

  // Winner/runner-up from series if available
  let winner: string | null = null;
  let runnerUp: string | null = null;

  if (series?.winning_team != null) {
    const wIds = series.winning_team === 1
      ? [series.team1_player1_id, series.team1_player2_id]
      : [series.team2_player1_id, series.team2_player2_id];
    const rIds = series.winning_team === 1
      ? [series.team2_player1_id, series.team2_player2_id]
      : [series.team1_player1_id, series.team1_player2_id];
    winner = wIds.map((id) => firstName(playerMap.get(id) ?? "?")).join(" & ");
    runnerUp = rIds.map((id) => firstName(playerMap.get(id) ?? "?")).join(" & ");
  }

  return {
    result: { group, winner, runnerUp, format: "Playoffs" },
    rankings,
  };
}

export default function FinalsCompletedView({
  formats,
  groups,
  matches,
  seriesMap,
}: FinalsCompletedViewProps) {
  const groupLabels = Object.keys(groups).sort();

  const allResults: GroupResult[] = [];
  const allRankings: PlayerRanking[] = [];

  for (const g of groupLabels) {
    const format = formats[g];
    const players = groups[g] ?? [];
    if (!format) continue;

    if (format.format_type === "fixed_partner") {
      const { result, rankings } = getFixedPartnerResults(g, format, matches, players);
      allResults.push(result);
      allRankings.push(...rankings);
    } else {
      const { result, rankings } = getPlayoffsResults(g, format, matches, players, seriesMap[g] ?? null);
      allResults.push(result);
      allRankings.push(...rankings);
    }
  }

  // Sort overall rankings by pts desc
  allRankings.sort((a, b) => b.pts - a.pts || b.pf - a.pf);

  return (
    <div className="flex flex-col gap-4">
      {/* Winner & runner-up cards per group */}
      {allResults.map((r) => (
        <div key={r.group} className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-stone-500 uppercase tracking-wide">
            Group {r.group}
          </h2>
          <div className="grid grid-cols-2 gap-2">
            {r.winner && (
              <div className="bg-white rounded-xl shadow-sm border border-stone-100 px-3 py-3 flex flex-col items-center gap-1 text-center">
                <span className="text-2xl">🏆</span>
                <span className="text-xs font-semibold text-stone-700">Winner</span>
                <span className="text-sm font-bold text-stone-900">{r.winner}</span>
              </div>
            )}
            {r.runnerUp && (
              <div className="bg-white rounded-xl shadow-sm border border-stone-100 px-3 py-3 flex flex-col items-center gap-1 text-center">
                <span className="text-2xl">🥈</span>
                <span className="text-xs font-semibold text-stone-700">Runner-up</span>
                <span className="text-sm font-bold text-stone-900">{r.runnerUp}</span>
              </div>
            )}
          </div>
          {!r.winner && !r.runnerUp && (
            <p className="text-xs text-stone-400 text-center py-2">No results recorded</p>
          )}
        </div>
      ))}

      {/* Overall rankings table */}
      {allRankings.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="bg-stone-50 px-4 py-2 border-b border-stone-100">
            <h3 className="text-xs font-semibold text-stone-500 uppercase tracking-wide">
              Overall Rankings
            </h3>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-100 text-[11px] text-stone-400 uppercase">
                <th className="text-left px-4 py-1.5 font-medium w-8">#</th>
                <th className="text-left px-2 py-1.5 font-medium">Player</th>
                <th className="text-center px-2 py-1.5 font-medium w-10">Grp</th>
                <th className="text-center px-2 py-1.5 font-medium w-10">W</th>
                <th className="text-center px-2 py-1.5 font-medium w-10">L</th>
                <th className="text-center px-2 py-1.5 font-medium w-12">Pts</th>
              </tr>
            </thead>
            <tbody>
              {allRankings.map((r, i) => (
                <tr key={`${r.name}-${r.group}`} className="border-b border-stone-100 last:border-0">
                  <td className="px-4 py-1.5 text-xs text-stone-400">{i + 1}</td>
                  <td className="px-2 py-1.5 text-stone-800">{r.name}</td>
                  <td className="text-center px-2 py-1.5 text-xs text-stone-400">{r.group}</td>
                  <td className="text-center px-2 py-1.5 font-semibold text-green-600">{r.wins}</td>
                  <td className="text-center px-2 py-1.5 font-semibold text-red-400">{r.losses}</td>
                  <td className="text-center px-2 py-1.5 font-bold text-stone-700">{r.pts}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
