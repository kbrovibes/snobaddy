"use client";

import { useState } from "react";
import NavLink from "@/components/NavLink";
import { buildNameMap } from "@/lib/display-name";
import type { GlobalPlayerStats } from "@/lib/db/global-leaderboard";

type SortKey = "name" | "matches_played" | "wins" | "losses" | "win_pct" | "ubr";
type SortDir = "asc" | "desc";

const COLUMNS: { key: SortKey; label: string; title: string }[] = [
  { key: "name",           label: "Player", title: "Player"                    },
  { key: "matches_played", label: "M",      title: "Matches played"            },
  { key: "wins",           label: "W",      title: "Wins"                      },
  { key: "losses",         label: "L",      title: "Losses"                    },
  { key: "win_pct",        label: "W%",     title: "Win percentage"            },
  { key: "ubr",            label: "UBR",    title: "Universal Badminton Rating" },
];

function winPct(p: GlobalPlayerStats) {
  return p.matches_played === 0 ? -1 : p.wins / p.matches_played;
}

function formatPct(p: GlobalPlayerStats) {
  if (p.matches_played === 0) return <span className="text-muted-lighter">—</span>;
  return `${Math.round((p.wins / p.matches_played) * 100)}%`;
}

function PlayerName({ player, nameMap }: { player: GlobalPlayerStats; nameMap: Map<string, string> }) {
  const display = nameMap.get(player.name) ?? player.name.split(" ")[0];
  return (
    <NavLink href={`/players/${player.id}`} className="truncate text-sky-600 dark:text-sky-400 hover:underline active:opacity-60">
      <span className="sm:hidden">{display}</span>
      <span className="hidden sm:inline">{player.name}</span>
    </NavLink>
  );
}

export default function GlobalLeaderboardTable({
  players,
  computedAt,
}: {
  players: GlobalPlayerStats[];
  computedAt: string;
}) {
  const [sortKey, setSortKey] = useState<SortKey>("wins");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const activePlayers = players.filter((p) => p.matches_played > 0);
  const benchPlayers  = players.filter((p) => p.matches_played === 0);

  const nameMap = buildNameMap(players.map((p) => p.name));

  function handleSort(key: SortKey) {
    if (key === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir(key === "name" ? "asc" : "desc"); }
  }

  function indicator(key: SortKey) {
    if (key !== sortKey) return <span className="text-muted-lighter ml-0.5">↕</span>;
    return <span className="text-sky-500 ml-0.5">{sortDir === "asc" ? "↑" : "↓"}</span>;
  }

  const sorted = [...activePlayers].sort((a, b) => {
    let av: number | string, bv: number | string;
    if (sortKey === "win_pct") {
      av = winPct(a); bv = winPct(b);
    } else if (sortKey === "name") {
      av = a.name.toLowerCase(); bv = b.name.toLowerCase();
    } else if (sortKey === "ubr") {
      av = a.ubr_rating ?? -1; bv = b.ubr_rating ?? -1;
    } else {
      av = a[sortKey] as number; bv = b[sortKey] as number;
    }
    if (av < bv) return sortDir === "asc" ? -1 : 1;
    if (av > bv) return sortDir === "asc" ? 1 : -1;
    return a.name.localeCompare(b.name);
  });

  const benchSorted = [...benchPlayers].sort((a, b) => a.name.localeCompare(b.name));

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  const headerRow = (
    <tr className="border-b border-border-light">
      <th className="w-8 px-4 py-2 text-left text-xs font-medium text-muted-light">#</th>
      {COLUMNS.map(({ key, label, title }) => (
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
  );

  return (
    <div>
      <div className="overflow-x-auto rounded-xl border border-border-light bg-surface shadow-sm">
        <table className="w-full text-sm">
          <thead>{headerRow}</thead>
          <tbody>
            {sorted.map((player, i) => (
              <tr
                key={player.id}
                className="border-b border-border-light last:border-0 hover:bg-surface-alt/50 transition-colors"
              >
                <td className="px-4 py-1.5 text-xs font-bold text-right text-muted-lighter">{i + 1}</td>
                <td className="px-2 py-1.5 font-medium text-heading">
                  <PlayerName player={player} nameMap={nameMap} />
                </td>
                <td className="px-1.5 py-1.5 text-right tabular-nums text-text">{player.matches_played}</td>
                <td className="px-1.5 py-1.5 text-right tabular-nums text-text">{player.wins || <span className="text-muted-lighter">—</span>}</td>
                <td className="px-1.5 py-1.5 text-right tabular-nums text-text">{player.losses || <span className="text-muted-lighter">—</span>}</td>
                <td className="px-1.5 py-1.5 text-right tabular-nums font-bold text-heading">{formatPct(player)}</td>
                <td className="px-1.5 py-1.5 text-right tabular-nums font-bold text-purple-700 dark:text-purple-400">
                  {player.ubr_rating != null ? Math.round(player.ubr_rating) : <span className="text-muted-lighter">—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {benchPlayers.length > 0 && (
        <details className="mt-3 group">
          <summary className="flex items-center justify-between px-1 mb-2 cursor-pointer list-none">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-light">
              No matches yet <span className="font-normal text-muted-lighter">({benchPlayers.length})</span>
            </p>
            <span className="text-muted-lighter text-xs transition-transform group-open:rotate-180">▼</span>
          </summary>
          <div className="overflow-x-auto rounded-xl border border-border-light bg-surface shadow-sm">
            <table className="w-full text-sm">
              <tbody>
                {benchSorted.map((player) => (
                  <tr key={player.id} className="border-b border-border-light last:border-0">
                    <td className="w-8 px-4 py-1.5 text-xs font-bold text-right text-muted-lighter">—</td>
                    <td className="px-2 py-1.5 font-medium text-muted-light">
                      <PlayerName player={player} nameMap={nameMap} />
                    </td>
                    <td className="px-1.5 py-1.5 text-right tabular-nums text-muted-lighter">—</td>
                    <td className="px-1.5 py-1.5 text-right tabular-nums text-muted-lighter">—</td>
                    <td className="px-1.5 py-1.5 text-right tabular-nums text-muted-lighter">—</td>
                    <td className="px-1.5 py-1.5 text-right tabular-nums text-muted-lighter">—</td>
                    <td className="px-1.5 py-1.5 text-right tabular-nums text-muted-lighter">—</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}

      <p className="text-[10px] text-muted-lighter text-right mt-1.5 px-1">
        Updated {fmtDate(computedAt)} · all seasons, regular + tally play
      </p>
    </div>
  );
}
