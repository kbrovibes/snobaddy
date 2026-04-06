"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { PlayerStats } from "@/lib/db/players";
import { VerifiedBadge, AdminBadge } from "@/components/PlayerBadges";

const LS_KEY = "snobaddy:leaderboard-show-test";

type SortKey = "name" | "matches_played" | "wins" | "losses" | "win_pct";
type SortDir = "asc" | "desc";

function winPct(p: PlayerStats) {
  return p.matches_played === 0 ? -1 : p.wins / p.matches_played;
}

function formatPct(p: PlayerStats) {
  if (p.matches_played === 0) return <span className="text-gray-300">—</span>;
  return `${Math.round((p.wins / p.matches_played) * 100)}%`;
}

const COLUMNS: { key: SortKey; label: string; title: string }[] = [
  { key: "name",          label: "Player",  title: "Player"         },
  { key: "matches_played",label: "M",       title: "Matches played" },
  { key: "wins",          label: "W",       title: "Wins"           },
  { key: "losses",        label: "L",       title: "Losses"         },
  { key: "win_pct",       label: "W%",      title: "Win percentage" },
];

export default function LeaderboardTable({
  players,
  playersWithTest,
  nutCrackerId,
  badmintonNutId,
  totalMatches,
  totalMatchesWithTest,
  isAdmin,
}: {
  players: PlayerStats[];
  playersWithTest: PlayerStats[];
  nutCrackerId: string | null;
  badmintonNutId: string | null;
  totalMatches: number;
  totalMatchesWithTest: number;
  isAdmin: boolean;
}) {
  const [sortKey, setSortKey] = useState<SortKey>("win_pct");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [showTest, setShowTest] = useState(false);

  useEffect(() => {
    try { setShowTest(localStorage.getItem(LS_KEY) === "true"); } catch {}
  }, []);

  function toggleShowTest() {
    const next = !showTest;
    setShowTest(next);
    try { localStorage.setItem(LS_KEY, String(next)); } catch {}
  }

  const activePlayers = showTest ? playersWithTest : players;
  const matchCount = showTest ? totalMatchesWithTest : totalMatches;

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
      av = winPct(a);
      bv = winPct(b);
    } else if (sortKey === "name") {
      av = a.name.toLowerCase();
      bv = b.name.toLowerCase();
    } else {
      av = a[sortKey];
      bv = b[sortKey];
    }

    if (av < bv) return sortDir === "asc" ? -1 : 1;
    if (av > bv) return sortDir === "asc" ? 1 : -1;

    // Tiebreak: more matches first, then name
    if (sortKey !== "matches_played") {
      if (b.matches_played !== a.matches_played)
        return b.matches_played - a.matches_played;
    }
    return a.name.localeCompare(b.name);
  });

  function indicator(key: SortKey) {
    if (key !== sortKey) return <span className="text-gray-300 ml-0.5">↕</span>;
    return (
      <span className="text-blue-500 ml-0.5">
        {sortDir === "asc" ? "↑" : "↓"}
      </span>
    );
  }

  function getRankColor(playerId: string) {
    if (playerId === nutCrackerId) return "bg-yellow-50 border-yellow-100";
    return "border-gray-50";
  }

  function getRankBadge(index: number, playerId: string) {
    if (playerId === nutCrackerId) return "🏆";
    if (playerId === badmintonNutId) return "🥜";
    return index + 1;
  }

  if (activePlayers.length === 0) {
    return (
      <p className="text-center text-gray-400 text-sm py-12">
        No active players yet.
      </p>
    );
  }

  return (
    <>
    {isAdmin && (
      <div className="flex items-center justify-end gap-2 mb-3">
        <span className="text-xs text-gray-400">Include Test Sessions</span>
        <button
          onClick={toggleShowTest}
          className="relative inline-flex w-9 h-5 rounded-full transition-colors duration-200 focus:outline-none"
          style={{ background: showTest ? "#f97316" : "#e5e7eb" }}
        >
          <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${showTest ? "translate-x-4" : "translate-x-0"}`} />
        </button>
      </div>
    )}
    <div className="overflow-x-auto -mx-4">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100">
            <th className="w-8 px-4 py-2 text-left text-xs font-medium text-gray-400">#</th>
            {COLUMNS.map(({ key, label, title }) => (
              <th
                key={key}
                title={title}
                onClick={() => handleSort(key)}
                className={`py-2 text-xs font-semibold uppercase tracking-wide cursor-pointer select-none whitespace-nowrap
                  ${key === "name" ? "px-2 text-left" : "px-3 text-right"}
                  ${sortKey === key ? "text-blue-600" : "text-gray-400 hover:text-gray-700"}`}
              >
                {label}{indicator(key)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((player, i) => (
            <tr
              key={player.id}
              className={`border-b hover:bg-gray-100/50 transition-colors ${getRankColor(player.id)}`}
            >
              <td className={`px-4 py-3 text-xs font-bold text-right ${player.id === nutCrackerId || player.id === badmintonNutId ? "text-gray-900" : "text-gray-300"}`}>
                {getRankBadge(i, player.id)}
              </td>
              <td className="px-2 py-3 font-medium text-gray-900 max-w-[120px]">
                <span className="flex items-center gap-1 min-w-0">
                  <Link href={`/players/${player.id}`} className="truncate text-blue-700 hover:underline">
                    {player.name}
                  </Link>
                  {player.user_id && <VerifiedBadge />}
                  {player.is_admin && <AdminBadge />}
                </span>
              </td>
              <td className="px-3 py-3 text-right tabular-nums text-gray-700">{player.matches_played}</td>
              <td className="px-3 py-3 text-right tabular-nums text-gray-700">{player.wins}</td>
              <td className="px-3 py-3 text-right tabular-nums text-gray-700">{player.losses}</td>
              <td className="px-3 py-3 text-right tabular-nums font-bold text-gray-900">
                {formatPct(player)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>

    <div className="mt-8 pt-8 border-t border-gray-100 text-center">
      <div className="text-sm text-gray-400">
        Total matches recorded this season
      </div>
      <div className="text-2xl font-bold text-gray-900 mt-1">
        {matchCount}
      </div>
    </div>
    </>
  );
}
