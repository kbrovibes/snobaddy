"use client";

import { useState } from "react";
import NavLink from "@/components/NavLink";
import type { PlayerSessionStats } from "@/lib/db/matches";
import { VerifiedBadge, AdminBadge } from "./PlayerBadges";

type SortKey = "name" | "matches_played" | "wins" | "losses" | "win_pct" | "points";
type SortDir = "asc" | "desc";

const COLUMNS: { key: SortKey; label: string; className: string }[] = [
  { key: "name",          label: "Player", className: "flex-1 text-left px-0"  },
  { key: "matches_played",label: "M",      className: "w-8 text-center"        },
  { key: "wins",          label: "W",      className: "w-8 text-center"        },
  { key: "losses",        label: "L",      className: "w-8 text-center"        },
  { key: "points",        label: "Pts",    className: "w-10 text-center"       },
  { key: "win_pct",       label: "Win%",   className: "w-12 text-right"        },
];

function winPct(p: PlayerSessionStats) {
  return p.matches_played === 0 ? -1 : p.wins / p.matches_played;
}

interface Props {
  scoreboard: PlayerSessionStats[];
  playerId?: string;
  matchCount: number;
}

export default function SessionScoreboard({ scoreboard, playerId, matchCount }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("matches_played");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "name" ? "asc" : "desc");
    }
  }

  const sorted = [...scoreboard].sort((a, b) => {
    let av: number | string;
    let bv: number | string;

    if (sortKey === "win_pct") {
      av = winPct(a); bv = winPct(b);
    } else if (sortKey === "name") {
      av = a.name.toLowerCase(); bv = b.name.toLowerCase();
    } else {
      av = a[sortKey]; bv = b[sortKey];
    }

    if (av < bv) return sortDir === "asc" ? -1 : 1;
    if (av > bv) return sortDir === "asc" ? 1 : -1;
    if (sortKey !== "matches_played") {
      if (b.matches_played !== a.matches_played) return b.matches_played - a.matches_played;
    }
    return a.name.localeCompare(b.name);
  });

  function indicator(key: SortKey) {
    if (key !== sortKey) return <span className="text-stone-300 ml-0.5">↕</span>;
    return <span className="text-sky-500 ml-0.5">{sortDir === "asc" ? "↑" : "↓"}</span>;
  }

  return (
    <div className="bg-white rounded-xl shadow-sm px-4 py-3">
      <h2 className="text-sm font-semibold text-stone-500 uppercase tracking-wide mb-3">
        Tonight's Scores · {matchCount} {matchCount === 1 ? "match" : "matches"}
      </h2>
      {scoreboard.length === 0 ? (
        <p className="text-sm text-stone-400">No matches recorded yet.</p>
      ) : (
        <>
          {/* Header */}
          <div className="flex items-center px-1 mb-1">
            {COLUMNS.map(({ key, label, className }) => (
              <button
                key={key}
                onClick={() => handleSort(key)}
                className={`${className} text-xs font-semibold uppercase tracking-wide cursor-pointer select-none whitespace-nowrap
                  ${sortKey === key ? "text-sky-600" : "text-stone-400 hover:text-stone-700"}`}
              >
                {label}{indicator(key)}
              </button>
            ))}
          </div>

          {/* Rows */}
          <div className="flex flex-col gap-2">
            {sorted.map((p) => {
              const pct = p.matches_played ? Math.round((p.wins / p.matches_played) * 100) : 0;
              return (
                <div key={p.player_id} className="flex items-center px-1">
                  <span className="flex-1 flex items-center gap-1 min-w-0">
                    <NavLink
                      href={`/players/${p.player_id}`}
                      className="text-sm font-medium truncate text-sky-600 hover:underline active:opacity-60"
                    >
                      {p.name}
                    </NavLink>
                    {p.user_id && <VerifiedBadge />}
                    {p.is_admin && <AdminBadge />}
                  </span>
                  <span className="w-8 text-center text-sm tabular-nums text-stone-500">{p.matches_played}</span>
                  <span className="w-8 text-center text-sm font-bold text-green-600">{p.wins}</span>
                  <span className="w-8 text-center text-sm font-bold text-red-400">{p.losses}</span>
                  <span className="w-10 text-center text-sm tabular-nums text-stone-500">{p.points}</span>
                  <span className="w-12 text-right text-sm text-stone-500">{p.matches_played ? `${pct}%` : <span className="text-stone-300">—</span>}</span>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
