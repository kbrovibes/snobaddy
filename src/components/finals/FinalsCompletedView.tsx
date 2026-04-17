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

// --- Pair standings for fixed-partner ---

interface PairStat {
  label: string;
  player1_id: string;
  player2_id: string;
  wins: number;
  losses: number;
  pf: number;
  pts: number;
}

function computeFixedPartnerStats(
  pairs: SavedPair[],
  groupMatches: FinalsMatch[],
  playerMap: Map<string, string>
): PairStat[] {
  const stats = pairs.map((pair) => {
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
      if (isT1) { pf += m.team1_score; if (m.winning_team === 1) wins++; else losses++; }
      if (isT2) { pf += m.team2_score; if (m.winning_team === 2) wins++; else losses++; }
    }
    return {
      label: `${firstName(p1)} & ${firstName(p2)}`,
      player1_id: pair.player1_id,
      player2_id: pair.player2_id,
      wins, losses, pf, pts: pf + wins * 2,
    };
  });
  stats.sort((a, b) => b.pts - a.pts || b.wins - a.wins);
  return stats;
}

// --- Individual standings for playoffs ---

interface IndividualStat {
  playerId: string;
  name: string;
  wins: number;
  losses: number;
  pf: number;
  pts: number;
}

function computePlayoffsStats(
  players: PairPlayer[],
  groupMatches: FinalsMatch[],
  playerMap: Map<string, string>
): IndividualStat[] {
  const stats = new Map<string, { wins: number; losses: number; pf: number }>();
  for (const p of players) stats.set(p.player_id, { wins: 0, losses: 0, pf: 0 });

  for (const m of groupMatches) {
    if (m.winning_team == null) continue;
    for (const pid of [m.team1_player1, m.team1_player2]) {
      const s = stats.get(pid);
      if (s) { s.pf += m.team1_score; if (m.winning_team === 1) s.wins++; else s.losses++; }
    }
    for (const pid of [m.team2_player1, m.team2_player2]) {
      const s = stats.get(pid);
      if (s) { s.pf += m.team2_score; if (m.winning_team === 2) s.wins++; else s.losses++; }
    }
  }

  const result: IndividualStat[] = [];
  for (const [pid, s] of stats) {
    result.push({ playerId: pid, name: firstName(playerMap.get(pid) ?? "Unknown"), ...s, pts: s.pf + s.wins * 2 });
  }
  result.sort((a, b) => b.pts - a.pts || b.pf - a.pf);
  return result;
}

// --- Helpers to detect series matches ---

function isSeriesMatch(m: FinalsMatch, series: SeriesData | null): boolean {
  if (!series) return false;
  return (
    m.team1_player1 === series.team1_player1_id &&
    m.team1_player2 === series.team1_player2_id &&
    m.team2_player1 === series.team2_player1_id &&
    m.team2_player2 === series.team2_player2_id
  );
}

// --- Per-group completed section ---

function GroupDetailSection({
  group,
  format,
  players,
  matches,
  series,
}: {
  group: string;
  format: FinalsFormatData;
  players: PairPlayer[];
  matches: FinalsMatch[];
  series: SeriesData | null;
}) {
  const [showMatches, setShowMatches] = useState(false);
  const playerMap = new Map(players.map((p) => [p.player_id, p.name]));
  const isFixedPartner = format.format_type === "fixed_partner";
  const groupMatches = matches.filter((m) => m.finals_group === group);
  const groupStageMatches = groupMatches.filter((m) => !isSeriesMatch(m, series));
  const seriesMatches = series ? groupMatches.filter((m) => isSeriesMatch(m, series)) : [];

  // Build match label helper
  function matchLabel(m: FinalsMatch) {
    const t1 = [m.team1_player1, m.team1_player2].map((id) => firstName(playerMap.get(id) ?? "?")).join(" & ");
    const t2 = [m.team2_player1, m.team2_player2].map((id) => firstName(playerMap.get(id) ?? "?")).join(" & ");
    return { t1, t2 };
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Group heading */}
      <h2 className="text-sm font-semibold text-stone-500 uppercase tracking-wide">
        Group {group} — Details
      </h2>

      {/* Series timeline — if best-of-3 happened */}
      {series && seriesMatches.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-stone-100 px-4 py-3">
          <h3 className="text-[11px] font-semibold text-stone-400 uppercase tracking-wide mb-2">
            Best-of-3 Final
          </h3>
          <div className="flex items-center gap-1.5">
            {seriesMatches.map((m, i) => {
              if (m.winning_team == null) return null;
              const { t1, t2 } = matchLabel(m);
              const winLabel = m.winning_team === 1 ? t1 : t2;
              return (
                <React.Fragment key={m.id}>
                  {i > 0 && <span className="text-stone-300 text-xs">→</span>}
                  <div className="flex-1 bg-stone-50 rounded-lg px-2.5 py-2 text-center">
                    <p className="text-[10px] text-stone-400 font-medium">Game {i + 1}</p>
                    <p className="text-sm font-bold text-stone-800">{m.team1_score}–{m.team2_score}</p>
                    <p className="text-[10px] text-green-600 font-semibold">{winLabel}</p>
                  </div>
                </React.Fragment>
              );
            })}
          </div>
        </div>
      )}

      {/* Standings table */}
      <div className="bg-white rounded-xl shadow-sm border border-stone-100 overflow-hidden">
        <div className="bg-stone-50 px-4 py-2 border-b border-stone-100">
          <h3 className="text-[11px] font-semibold text-stone-400 uppercase tracking-wide">
            {isFixedPartner ? "Pair Standings" : "Player Standings"}
          </h3>
        </div>
        {isFixedPartner ? (
          <FixedPartnerTable format={format} matches={groupStageMatches} playerMap={playerMap} />
        ) : (
          <PlayoffsTable players={players} matches={groupStageMatches} playerMap={playerMap} />
        )}
      </div>

      {/* Collapsible match history */}
      {groupStageMatches.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-stone-100 overflow-hidden">
          <button
            onClick={() => setShowMatches(!showMatches)}
            className="w-full flex items-center justify-between px-4 py-2.5 text-left hover:bg-stone-50 transition-colors"
          >
            <span className="text-[11px] font-semibold text-stone-400 uppercase tracking-wide">
              All Matches · {groupStageMatches.filter((m) => m.winning_team != null).length}
            </span>
            <span className="text-xs text-stone-400">{showMatches ? "▲" : "▼"}</span>
          </button>
          {showMatches && (
            <div className="border-t border-stone-100 px-4 py-2 flex flex-col gap-2">
              {groupStageMatches.filter((m) => m.winning_team != null).map((m) => {
                const { t1, t2 } = matchLabel(m);
                return (
                  <div key={m.id} className="text-sm">
                    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                      <span className={`font-semibold truncate text-left ${m.winning_team === 1 ? "text-green-600" : "text-stone-400"}`}>
                        {t1}
                      </span>
                      <span className="text-stone-300 text-center w-6">vs</span>
                      <span className={`font-semibold truncate text-left ${m.winning_team === 2 ? "text-green-600" : "text-stone-400"}`}>
                        {t2}
                      </span>
                    </div>
                    <p className="text-xs text-stone-400 mt-0.5">
                      {m.team1_score}–{m.team2_score} · {m.winning_team === 1 ? t1 : t2} won
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// --- Standings sub-tables ---

function FixedPartnerTable({
  format,
  matches,
  playerMap,
}: {
  format: FinalsFormatData;
  matches: FinalsMatch[];
  playerMap: Map<string, string>;
}) {
  const savedPairs: SavedPair[] = (format.config as { pairs?: SavedPair[] })?.pairs ?? [];
  const stats = computeFixedPartnerStats(savedPairs, matches, playerMap);

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-stone-100 text-[11px] text-stone-400 uppercase">
          <th className="text-left px-4 py-1.5 font-medium w-8">#</th>
          <th className="text-left px-2 py-1.5 font-medium">Team</th>
          <th className="text-center px-2 py-1.5 font-medium w-10">W</th>
          <th className="text-center px-2 py-1.5 font-medium w-10">L</th>
          <th className="text-center px-2 py-1.5 font-medium w-12">Pts</th>
        </tr>
      </thead>
      <tbody>
        {stats.map((s, i) => (
          <tr key={s.label} className={`border-b border-stone-100 last:border-0 ${i === 0 ? "bg-green-50/50" : ""}`}>
            <td className="px-4 py-1.5 text-xs text-stone-400">{i + 1}</td>
            <td className="px-2 py-1.5 text-stone-800">
              {s.label}
              {i === 0 && " 🏆"}
            </td>
            <td className="text-center px-2 py-1.5 font-semibold text-green-600">{s.wins}</td>
            <td className="text-center px-2 py-1.5 font-semibold text-red-400">{s.losses}</td>
            <td className="text-center px-2 py-1.5 font-bold text-stone-700">{s.pts}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function PlayoffsTable({
  players,
  matches,
  playerMap,
}: {
  players: PairPlayer[];
  matches: FinalsMatch[];
  playerMap: Map<string, string>;
}) {
  const stats = computePlayoffsStats(players, matches, playerMap);

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-stone-100 text-[11px] text-stone-400 uppercase">
          <th className="text-left px-4 py-1.5 font-medium w-8">#</th>
          <th className="text-left px-2 py-1.5 font-medium">Player</th>
          <th className="text-center px-2 py-1.5 font-medium w-10">W</th>
          <th className="text-center px-2 py-1.5 font-medium w-10">L</th>
          <th className="text-center px-2 py-1.5 font-medium w-12">Pts</th>
        </tr>
      </thead>
      <tbody>
        {stats.map((s, i) => (
          <tr key={s.playerId} className={`border-b border-stone-100 last:border-0 ${i < 4 ? "bg-green-50/50" : ""}`}>
            <td className="px-4 py-1.5 text-xs text-stone-400">{i + 1}</td>
            <td className="px-2 py-1.5 text-stone-800">{s.name}</td>
            <td className="text-center px-2 py-1.5 font-semibold text-green-600">{s.wins}</td>
            <td className="text-center px-2 py-1.5 font-semibold text-red-400">{s.losses}</td>
            <td className="text-center px-2 py-1.5 font-bold text-stone-700">{s.pts}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// --- Overall rankings for cross-group comparison ---

interface PlayerRanking {
  name: string;
  group: string;
  wins: number;
  losses: number;
  pf: number;
  pts: number;
}

function buildOverallRankings(
  groupLabels: string[],
  formats: Record<string, FinalsFormatData>,
  groups: Record<string, PairPlayer[]>,
  matches: FinalsMatch[],
  seriesMap: Record<string, SeriesData>
): PlayerRanking[] {
  const rankings: PlayerRanking[] = [];

  for (const g of groupLabels) {
    const format = formats[g];
    const players = groups[g] ?? [];
    if (!format) continue;
    const playerMap = new Map(players.map((p) => [p.player_id, p.name]));
    const groupMatches = matches.filter((m) => m.finals_group === g);
    const series = seriesMap[g] ?? null;
    const groupStageMatches = groupMatches.filter((m) => !isSeriesMatch(m, series));

    if (format.format_type === "fixed_partner") {
      const savedPairs: SavedPair[] = (format.config as { pairs?: SavedPair[] })?.pairs ?? [];
      const stats = computeFixedPartnerStats(savedPairs, groupStageMatches, playerMap);
      for (const ps of stats) {
        for (const pid of [ps.player1_id, ps.player2_id]) {
          rankings.push({
            name: firstName(playerMap.get(pid) ?? "Unknown"),
            group: g, wins: ps.wins, losses: ps.losses, pf: ps.pf, pts: ps.pts,
          });
        }
      }
    } else {
      const stats = computePlayoffsStats(players, groupStageMatches, playerMap);
      for (const s of stats) {
        rankings.push({ name: s.name, group: g, wins: s.wins, losses: s.losses, pf: s.pf, pts: s.pts });
      }
    }
  }

  rankings.sort((a, b) => b.pts - a.pts || b.pf - a.pf);
  return rankings;
}

// --- Main component ---

export default function FinalsCompletedView({
  formats,
  groups,
  matches,
  seriesMap,
}: FinalsCompletedViewProps) {
  const groupLabels = Object.keys(groups).sort();
  const allRankings = buildOverallRankings(groupLabels, formats, groups, matches, seriesMap);

  // Compute winners/runner-ups for all groups up front
  const groupResults = groupLabels.map((g) => {
    const format = formats[g];
    const players = groups[g] ?? [];
    if (!format) return { group: g, winner: null, runnerUp: null };
    const playerMap = new Map(players.map((p) => [p.player_id, p.name]));
    const groupMatches = matches.filter((m) => m.finals_group === g);
    const series = seriesMap[g] ?? null;
    const groupStageMatches = groupMatches.filter((m) => !isSeriesMatch(m, series));

    let winner: string | null = null;
    let runnerUp: string | null = null;

    if (format.format_type === "fixed_partner") {
      const savedPairs: SavedPair[] = (format.config as { pairs?: SavedPair[] })?.pairs ?? [];
      const stats = computeFixedPartnerStats(savedPairs, groupStageMatches, playerMap);
      if (stats.length >= 1) winner = stats[0].label;
      if (stats.length >= 2) runnerUp = stats[1].label;
    }
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
    return { group: g, winner, runnerUp };
  });

  return (
    <div className="flex flex-col gap-5">
      {/* All group winner/runner-up cards at the top */}
      {groupResults.map((r) => (
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

      {/* Per-group match details below */}
      {groupLabels.map((g) => {
        const format = formats[g];
        if (!format) return null;
        return (
          <GroupDetailSection
            key={g}
            group={g}
            format={format}
            players={groups[g] ?? []}
            matches={matches}
            series={seriesMap[g] ?? null}
          />
        );
      })}

      {/* Overall rankings */}
      {allRankings.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-stone-100 overflow-hidden">
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
