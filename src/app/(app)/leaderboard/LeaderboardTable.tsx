"use client";

import { useEffect, useState } from "react";
import NavLink from "@/components/NavLink";
import type { PlayerStats } from "@/lib/db/players";
import { VerifiedBadge, AdminBadge } from "@/components/PlayerBadges";
import { buildNameMap, shortName } from "@/lib/display-name";
import type { UbrRating } from "@/lib/db/ubr";

// removed: test sessions toggle (LS_KEY)

type SortKey = "name" | "matches_played" | "wins" | "losses" | "win_pct" | "ubr";
type SortDir = "asc" | "desc";

function winPct(p: PlayerStats) {
  return p.matches_played === 0 ? -1 : p.wins / p.matches_played;
}

function formatPct(p: PlayerStats) {
  if (p.matches_played === 0) return <span className="text-muted-lighter">—</span>;
  return `${Math.round((p.wins / p.matches_played) * 100)}%`;
}

function AwardCard({ emoji, title, description, name, stat }: {
  emoji: string; title: string; description: string; name: string; stat: string;
}) {
  return (
    <div className="bg-surface rounded-xl shadow-sm border border-border-light px-3 py-2 flex flex-col items-center gap-0.5 text-center">
      <span className="text-xl">{emoji}</span>
      <span className="text-xs font-semibold text-text leading-tight">{title}</span>
      <span className="text-[11px] text-muted-light leading-tight">{description}</span>
      <span className="text-sm font-bold text-heading leading-tight mt-0.5">{name}</span>
      <span className="text-[11px] text-muted-light">{stat}</span>
    </div>
  );
}

const RUNNER_MEDALS = ["🥈", "🥉"];

function RunnerUpCard({ title, runners }: {
  title: string;
  runners: Array<{ name: string; stat: string }>;
}) {
  if (runners.length === 0) return null;
  return (
    <div className="bg-surface rounded-xl shadow-sm border border-border-light px-3 py-2 flex flex-col gap-1.5">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-lighter leading-none">{title}</span>
      {runners.map((r, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="text-base leading-none">{RUNNER_MEDALS[i]}</span>
          <span className="text-sm font-bold text-heading flex-1 truncate">{r.name}</span>
          <span className="text-[11px] text-muted-light tabular-nums">{r.stat}</span>
        </div>
      ))}
    </div>
  );
}

const BASE_COLUMNS: { key: SortKey; label: string; title: string }[] = [
  { key: "name",          label: "Player",  title: "Player"         },
  { key: "matches_played",label: "M",       title: "Matches played" },
  { key: "wins",          label: "W",       title: "Wins"           },
  { key: "losses",        label: "L",       title: "Losses"         },
  { key: "win_pct",       label: "W%",      title: "Win percentage" },
];

const UBR_COLUMN = { key: "ubr" as SortKey, label: "UBR", title: "Universal Badminton Rating" };

const LS_UBR_KEY = "snobaddy:leaderboard-show-ubr";

export default function LeaderboardTable({
  players,
  totalMatches,
  isAdmin,
  ubrRatings,
  lockedSessionCount = 0,
}: {
  players: PlayerStats[];
  totalMatches: number;
  isAdmin: boolean;
  ubrRatings?: Record<string, UbrRating>;
  lockedSessionCount?: number;
}) {
  const [sortKey, setSortKey] = useState<SortKey>("wins");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [showUbr, setShowUbr] = useState(false);

  useEffect(() => {
    try { setShowUbr(localStorage.getItem(LS_UBR_KEY) === "true"); } catch {}
  }, []);

  function toggleShowUbr() {
    const next = !showUbr;
    setShowUbr(next);
    try { localStorage.setItem(LS_UBR_KEY, String(next)); } catch {}
  }

  const hasUbr = !!ubrRatings && Object.keys(ubrRatings).length > 0;
  const ubrVisible = hasUbr && showUbr;

  const activePlayers = players;
  const matchCount = totalMatches;

  // Award card computation — reactive to toggle
  const nameMap = buildNameMap(activePlayers.map(p => p.name));

  // Badminton Nut top 3: most matches played
  const badmintonTop3 = [...activePlayers]
    .sort((a, b) => b.matches_played - a.matches_played || a.name.localeCompare(b.name))
    .slice(0, 3);
  const badmintonNut = badmintonTop3[0] ?? null;
  const badmintonRunners = badmintonTop3.slice(1).map(p => ({
    name: shortName(p.name, nameMap),
    stat: `${p.matches_played} matches`,
  }));

  // Nut Cracker top 3: best win rate (min half of top player's matches)
  const minMatches = badmintonNut ? Math.floor(badmintonNut.matches_played / 2) : 0;
  const nutTop3 = [...activePlayers]
    .filter(p => p.matches_played >= minMatches && p.matches_played > 0)
    .sort((a, b) => {
      const pctA = a.wins / a.matches_played;
      const pctB = b.wins / b.matches_played;
      if (pctB !== pctA) return pctB - pctA;
      return b.matches_played - a.matches_played;
    })
    .slice(0, 3);
  const nutCracker = nutTop3[0] ?? null;
  const nutRunners = nutTop3.slice(1).map(p => ({
    name: shortName(p.name, nameMap),
    stat: `${Math.round((p.wins / p.matches_played) * 100)}% win rate`,
  }));

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "name" ? "asc" : "desc");
    }
  }

  const sorted = [...activePlayers].sort((a, b) => {
    let av: number | string;
    let bv: number | string;

    if (sortKey === "win_pct") {
      av = winPct(a); bv = winPct(b);
    } else if (sortKey === "name") {
      av = a.name.toLowerCase(); bv = b.name.toLowerCase();
    } else if (sortKey === "ubr") {
      av = ubrRatings?.[a.id]?.rating ?? 0;
      bv = ubrRatings?.[b.id]?.rating ?? 0;
    } else {
      av = a[sortKey]; bv = b[sortKey];
    }

    if (av < bv) return sortDir === "asc" ? -1 : 1;
    if (av > bv) return sortDir === "asc" ? 1 : -1;

    if (sortKey !== "matches_played") {
      if (b.matches_played !== a.matches_played)
        return b.matches_played - a.matches_played;
    }
    return a.name.localeCompare(b.name);
  });

  function indicator(key: SortKey) {
    if (key !== sortKey) return <span className="text-muted-lighter ml-0.5">↕</span>;
    return <span className="text-sky-500 ml-0.5">{sortDir === "asc" ? "↑" : "↓"}</span>;
  }

  function getRankColor(playerId: string) {
    if (playerId === nutCracker?.id) return "bg-yellow-50 dark:bg-yellow-500/10";
    return "";
  }

  function getRankBadge(index: number, playerId: string) {
    if (playerId === nutCracker?.id) return "🏆";
    if (playerId === badmintonNut?.id) return "🥜";
    return index + 1;
  }

  return (
    <>
      {/* Header row: player count + toggles */}
      <div className="flex items-center justify-between mb-4 gap-3">
        <span className="text-sm text-muted-light shrink-0">{activePlayers.length} players</span>
        <div className="flex items-center gap-4">
          {hasUbr && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-light">UBR</span>
              <button
                onClick={toggleShowUbr}
                className="relative inline-flex w-9 h-5 rounded-full transition-colors duration-200 focus:outline-none"
                style={{ background: showUbr ? "#0ea5e9" : "var(--muted-lighter)" }}
              >
                <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${showUbr ? "translate-x-4" : "translate-x-0"}`} />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Award cards */}
      {(badmintonNut || nutCracker) && (
        <div className="flex flex-col gap-2 mb-4">
          <div className="grid grid-cols-2 gap-3">
            {badmintonNut && (
              <AwardCard
                emoji="🏸"
                title="Badminton Nut"
                description="Most matches played"
                name={shortName(badmintonNut.name, nameMap)}
                stat={`${badmintonNut.matches_played} matches`}
              />
            )}
            {nutCracker && (
              <AwardCard
                emoji="🎯"
                title="Nut Cracker"
                description={`Best win rate (min ${minMatches} matches)`}
                name={shortName(nutCracker.name, nameMap)}
                stat={`${Math.round((nutCracker.wins / nutCracker.matches_played) * 100)}% win rate`}
              />
            )}
          </div>
          {(badmintonRunners.length > 0 || nutRunners.length > 0) && (
            <div className="grid grid-cols-2 gap-3">
              <RunnerUpCard title="Badminton Nut" runners={badmintonRunners} />
              <RunnerUpCard title="Nut Cracker" runners={nutRunners} />
            </div>
          )}
        </div>
      )}

      {activePlayers.length === 0 ? (
        <p className="text-center text-muted-light text-sm py-12">No active players yet.</p>
      ) : (
        <div className="overflow-x-auto">
          {(() => {
            const columns = ubrVisible
              ? [...BASE_COLUMNS, UBR_COLUMN]
              : BASE_COLUMNS;
            return (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border-light">
                    <th className="w-8 px-4 py-2 text-left text-xs font-medium text-muted-light">#</th>
                    {columns.map(({ key, label, title }) => (
                      <th
                        key={key}
                        title={title}
                        onClick={() => handleSort(key)}
                        className={`py-2 text-xs font-semibold uppercase tracking-wide cursor-pointer select-none whitespace-nowrap
                          ${key === "name" ? "px-2 text-left w-full" : "px-1.5 text-right"}
                          ${key === "ubr" ? "text-purple-600 dark:text-purple-400" : ""}
                          ${sortKey === key ? "text-sky-600" : key === "ubr" ? "" : "text-muted-light hover:text-text"}`}
                      >
                        {label}{indicator(key)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((player, i) => {
                    const ubr = ubrRatings?.[player.id];
                    return (
                      <tr
                        key={player.id}
                        className={`border-b border-border-light hover:bg-surface-alt/50 transition-colors ${getRankColor(player.id)}`}
                      >
                        <td className={`px-4 py-1.5 text-xs font-bold text-right ${player.id === nutCracker?.id || player.id === badmintonNut?.id ? "text-heading" : "text-muted-lighter"}`}>
                          {getRankBadge(i, player.id)}
                        </td>
                        <td className="px-2 py-1.5 font-medium text-heading">
                          <span className="flex items-center gap-1 min-w-0">
                            <NavLink href={`/players/${player.id}`} className="truncate text-sky-600 dark:text-sky-400 hover:underline active:opacity-60">
                              {ubrVisible ? shortName(player.name, nameMap) : player.name}
                            </NavLink>
                            {!ubrVisible && player.user_id && <VerifiedBadge />}
                            {!ubrVisible && player.is_admin && <AdminBadge />}
                          </span>
                        </td>
                        <td className="px-1.5 py-1.5 text-right tabular-nums text-text">{player.matches_played}</td>
                        <td className="px-1.5 py-1.5 text-right tabular-nums text-text">{player.wins}</td>
                        <td className="px-1.5 py-1.5 text-right tabular-nums text-text">{player.losses}</td>
                        <td className="px-1.5 py-1.5 text-right tabular-nums font-bold text-heading">
                          {formatPct(player)}
                        </td>
                        {ubrVisible && (
                          <td className="px-1.5 py-1.5 text-right tabular-nums font-bold text-purple-700 dark:text-purple-400">
                            {ubr ? Math.round(ubr.rating) : <span className="text-muted-lighter">—</span>}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            );
          })()}
        </div>
      )}

      <div className="mt-8 pt-8 border-t border-border-light text-center">
        <div className="text-sm text-muted-light">Total matches recorded this season</div>
        <div className="text-2xl font-bold text-heading mt-1">{matchCount}</div>
        {lockedSessionCount > 0 && (
          <div className="mt-2 text-[11px] text-muted-lighter">
            🔒 {lockedSessionCount} session{lockedSessionCount > 1 ? "s" : ""} excluded · stats locked
          </div>
        )}
      </div>
    </>
  );
}
