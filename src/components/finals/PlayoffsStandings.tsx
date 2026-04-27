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
    });
  }

  // Sort: pts desc → pf desc → alphabetical (alphabetical is display-only
  // tiebreaker; true ties are surfaced to the admin via the boundary picker)
  standings.sort((a, b) => {
    if (b.pts !== a.pts) return b.pts - a.pts;
    if (b.pf !== a.pf) return b.pf - a.pf;
    return a.name.localeCompare(b.name);
  });

  standings.forEach((s, i) => { s.rank = i + 1; });

  return standings;
}

// Group consecutive players with identical (pts, pf) into bands.
function computeBands(standings: PlayerStanding[]): PlayerStanding[][] {
  const bands: PlayerStanding[][] = [];
  for (const s of standings) {
    const last = bands[bands.length - 1];
    if (last && last[0].pts === s.pts && last[0].pf === s.pf) {
      last.push(s);
    } else {
      bands.push([s]);
    }
  }
  return bands;
}

interface Top4Result {
  top4: PlayerStanding[] | null; // null → unresolved boundary tie
  guaranteed: PlayerStanding[];
  boundaryBand: PlayerStanding[] | null;
  spotsToFill: number;
}

function computeTop4(bands: PlayerStanding[][], picks: Set<string>): Top4Result {
  const guaranteed: PlayerStanding[] = [];
  for (const band of bands) {
    if (guaranteed.length + band.length <= 4) {
      guaranteed.push(...band);
      if (guaranteed.length === 4) break;
    } else {
      const spotsToFill = 4 - guaranteed.length;
      const picked = band.filter((s) => picks.has(s.playerId));
      if (picked.length !== spotsToFill) {
        return { top4: null, guaranteed, boundaryBand: band, spotsToFill };
      }
      return { top4: [...guaranteed, ...picked], guaranteed, boundaryBand: band, spotsToFill };
    }
  }
  return { top4: guaranteed.length === 4 ? guaranteed : null, guaranteed, boundaryBand: null, spotsToFill: 0 };
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
  const [picks, setPicks] = useState<Set<string>>(new Set());

  const standings = computeIndividualStandings(matches, playerNames);
  const bands = computeBands(standings);
  const top4Result = computeTop4(bands, picks);

  const totalMatches = matches.length;
  const playedMatches = matches.filter((m) => m.winning_team != null).length;
  const allPlayed = totalMatches > 0 && playedMatches === totalMatches;

  const top4Ids = new Set(top4Result.top4?.map((s) => s.playerId) ?? []);
  const boundaryIds = new Set(top4Result.boundaryBand?.map((s) => s.playerId) ?? []);
  const hasBoundaryTie = top4Result.boundaryBand !== null;

  const canGenerateFinals =
    allPlayed &&
    formatStatus === "matches_generated" &&
    isGodMode &&
    top4Result.top4 !== null;

  async function handleGenerateFinals() {
    if (!top4Result.top4) return;
    setGenerating(true);
    setError(null);
    const top4 = top4Result.top4.map((s) => s.playerId);
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

  function togglePick(playerId: string) {
    setPicks((prev) => {
      const next = new Set(prev);
      if (next.has(playerId)) {
        next.delete(playerId);
      } else {
        // Enforce max picks = spotsToFill by dropping oldest if over
        next.add(playerId);
        // Drop any picks that are no longer in boundary band
        for (const id of next) {
          if (!boundaryIds.has(id)) next.delete(id);
        }
        while (next.size > top4Result.spotsToFill) {
          // Remove the first one that wasn't just added
          for (const id of next) {
            if (id !== playerId) { next.delete(id); break; }
          }
        }
      }
      return next;
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-xs font-semibold text-text-light uppercase tracking-wide">
        Standings
      </h3>

      {/* Progress */}
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1.5 bg-surface-alt rounded-full overflow-hidden">
          <div
            className="h-full bg-sky-600 rounded-full transition-all"
            style={{ width: `${totalMatches > 0 ? (playedMatches / totalMatches) * 100 : 0}%` }}
          />
        </div>
        <span className="text-xs text-muted-light">{playedMatches}/{totalMatches}</span>
      </div>

      <div className="bg-surface rounded-xl shadow-sm dark:shadow-none dark:ring-1 dark:ring-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border-light bg-background text-[11px] text-muted-light uppercase">
              <th className="text-left px-3 py-1.5 font-medium w-8">#</th>
              <th className="text-left px-2 py-1.5 font-medium">Player</th>
              <th className="text-center px-2 py-1.5 font-medium w-12">M</th>
              <th className="text-center px-2 py-1.5 font-medium w-10">W</th>
              <th className="text-center px-2 py-1.5 font-medium w-10">L</th>
              <th className="text-center px-2 py-1.5 font-medium w-10">Pts</th>
            </tr>
          </thead>
          <tbody>
            {standings.map((s) => {
              const advancing = allPlayed && top4Ids.has(s.playerId);
              const inBoundary = allPlayed && hasBoundaryTie && boundaryIds.has(s.playerId);
              const rowClass = advancing
                ? "bg-green-50"
                : inBoundary
                  ? "bg-amber-50"
                  : "";
              return (
                <tr
                  key={s.playerId}
                  className={`border-b border-border-light last:border-0 ${rowClass}`}
                >
                  <td className="px-3 py-1.5 text-xs text-muted-light">{s.rank}</td>
                  <td className="px-2 py-1.5">
                    <span className="text-heading">{s.name}</span>
                    {advancing && (
                      <span className="ml-1 text-[10px] text-green-600 dark:text-green-400 font-semibold">🏁 Top 4</span>
                    )}
                    {inBoundary && !advancing && (
                      <span className="ml-1 text-[10px] text-amber-600 dark:text-amber-400 font-semibold">Tied</span>
                    )}
                  </td>
                  <td className="text-center px-2 py-1.5 text-xs text-muted-light">{s.played}/{s.total}</td>
                  <td className="text-center px-2 py-1.5 font-semibold text-green-600 dark:text-green-400">{s.wins}</td>
                  <td className="text-center px-2 py-1.5 font-semibold text-red-400">{s.losses}</td>
                  <td className="text-center px-2 py-1.5 font-bold text-text">{s.pts}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Tie-breaker picker — boundary tie at the Top-4 cutoff */}
      {allPlayed && hasBoundaryTie && top4Result.top4 === null && isGodMode && (
        <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 rounded-xl px-4 py-3 text-sm">
          <p className="font-semibold text-amber-800 mb-1">
            {top4Result.boundaryBand!.length}-way tie for{" "}
            {top4Result.spotsToFill === 1
              ? "the last Top 4 spot"
              : `the last ${top4Result.spotsToFill} Top 4 spots`}
          </p>
          <p className="text-amber-700 text-xs mb-3">
            {top4Result.boundaryBand!.map((p) => p.name).join(", ")} have identical records ({top4Result.boundaryBand![0].wins}W, {top4Result.boundaryBand![0].pts} Pts).
            Pick {top4Result.spotsToFill === 1 ? "one" : top4Result.spotsToFill} to advance to the Best-of-3 Finals:
          </p>
          <div className="flex flex-col gap-1.5">
            {top4Result.boundaryBand!.map((p) => {
              const checked = picks.has(p.playerId);
              const atCap = !checked && picks.size >= top4Result.spotsToFill;
              return (
                <label
                  key={p.playerId}
                  className={`flex items-center gap-2 text-sm py-1 px-2 rounded-lg bg-surface border border-amber-100 ${atCap ? "opacity-40" : "cursor-pointer hover:bg-amber-50"}`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={atCap}
                    onChange={() => togglePick(p.playerId)}
                    className="accent-amber-600"
                  />
                  <span className="text-heading font-medium">{p.name}</span>
                  <span className="ml-auto text-[11px] text-muted-light">
                    {p.wins}W · {p.pts} Pts
                  </span>
                </label>
              );
            })}
          </div>
          <p className="text-[11px] text-amber-700 mt-2">
            {picks.size}/{top4Result.spotsToFill} selected
          </p>
        </div>
      )}

      {/* Non-god-mode view of an unresolved tie */}
      {allPlayed && hasBoundaryTie && top4Result.top4 === null && !isGodMode && (
        <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 rounded-xl px-4 py-3 text-sm">
          <p className="text-amber-800">
            Tie at the Top&nbsp;4 boundary — waiting for an admin to decide who advances.
          </p>
        </div>
      )}

      {error && (
        <p className="text-xs text-red-500 bg-red-50 dark:bg-red-500/10 px-3 py-2 rounded-lg">{error}</p>
      )}

      {allPlayed && formatStatus === "matches_generated" && isGodMode && (
        <button
          onClick={handleGenerateFinals}
          disabled={!canGenerateFinals || generating || isPending}
          className="w-full py-2.5 text-sm font-semibold text-white bg-sky-700 hover:bg-sky-600 rounded-xl disabled:opacity-40 transition-colors"
        >
          {generating
            ? "Generating…"
            : top4Result.top4 === null
              ? `Resolve tie to continue (${picks.size}/${top4Result.spotsToFill})`
              : "Generate Best-of-3 Finals →"}
        </button>
      )}

      {allPlayed && formatStatus === "matches_generated" && !isGodMode && top4Result.top4 !== null && (
        <p className="text-xs text-muted-light text-center">
          All group matches complete. Admin will set up the finals.
        </p>
      )}
    </div>
  );
}
