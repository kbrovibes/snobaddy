"use client";

import { useState } from "react";
import Link from "next/link";
import type { TallyEntry } from "@/lib/db/tally";

async function getSignedPhotoUrl(sessionId: string): Promise<string | null> {
  try {
    const res = await fetch(`/api/sessions/${sessionId}/tally/photo-url`);
    if (!res.ok) return null;
    const data = await res.json();
    return data.url ?? null;
  } catch {
    return null;
  }
}

type SortKey = "name" | "matches" | "wins" | "losses" | "win_pct";
type SortDir = "asc" | "desc";

const COLUMNS: { key: SortKey; label: string; className: string }[] = [
  { key: "name",    label: "Player", className: "flex-1 text-left px-0" },
  { key: "matches", label: "M",      className: "w-8 text-center"       },
  { key: "wins",    label: "W",      className: "w-8 text-center"       },
  { key: "losses",  label: "L",      className: "w-8 text-center"       },
  { key: "win_pct", label: "Win%",   className: "w-12 text-right"       },
];

function winPct(e: TallyEntry) {
  const total = e.wins + e.losses;
  return total === 0 ? -1 : e.wins / total;
}

interface Props {
  entries: TallyEntry[];
  sessionId?: string;
  isGodMode?: boolean;
  hasPhoto?: boolean;
}

export default function TallyScoreboard({ entries, sessionId, isGodMode, hasPhoto }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("wins");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [loadingPhoto, setLoadingPhoto] = useState(false);

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "name" ? "asc" : "desc");
    }
  }

  const sorted = [...entries].sort((a, b) => {
    let av: number | string;
    let bv: number | string;

    if (sortKey === "win_pct") {
      av = winPct(a); bv = winPct(b);
    } else if (sortKey === "name") {
      av = a.player_name.toLowerCase(); bv = b.player_name.toLowerCase();
    } else if (sortKey === "matches") {
      av = a.wins + a.losses; bv = b.wins + b.losses;
    } else {
      av = a[sortKey]; bv = b[sortKey];
    }

    if (av < bv) return sortDir === "asc" ? -1 : 1;
    if (av > bv) return sortDir === "asc" ? 1 : -1;
    if (sortKey !== "matches") {
      const am = a.wins + a.losses, bm = b.wins + b.losses;
      if (bm !== am) return bm - am;
    }
    return a.player_name.localeCompare(b.player_name);
  });

  function indicator(key: SortKey) {
    if (key !== sortKey) return <span className="text-stone-300 ml-0.5">↕</span>;
    return <span className="text-sky-500 ml-0.5">{sortDir === "asc" ? "↑" : "↓"}</span>;
  }

  return (
    <div className="bg-white rounded-xl shadow-sm px-4 py-3">
      <h2 className="text-sm font-semibold text-stone-500 uppercase tracking-wide mb-3">
        Final Scores · Tally-only
      </h2>
      {entries.length === 0 ? (
        <p className="text-sm text-stone-400">No tally data.</p>
      ) : (
        <>
          {/* Header */}
          <div className="flex items-center px-1 mb-1">
            <span className="w-5 shrink-0" />
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
            {sorted.map((e) => {
              const total = e.wins + e.losses;
              const pct = total > 0 ? Math.round((e.wins / total) * 100) : 0;
              return (
                <div key={e.player_id} className="flex items-center px-1">
                  <span className="text-xs text-stone-300 w-5 shrink-0" />
                  <Link
                    href={`/players/${e.player_id}`}
                    className="flex-1 text-sm font-medium truncate text-sky-600 hover:underline"
                  >
                    {e.player_name}
                  </Link>
                  <span className="w-8 text-center text-sm tabular-nums text-stone-500">{total}</span>
                  <span className="w-8 text-center text-sm font-bold text-green-600">{e.wins}</span>
                  <span className="w-8 text-center text-sm font-bold text-red-400">{e.losses}</span>
                  <span className="w-12 text-right text-sm text-stone-500">
                    {total > 0 ? `${pct}%` : <span className="text-stone-300">—</span>}
                  </span>
                </div>
              );
            })}
          </div>
        </>
      )}

      {isGodMode && hasPhoto && sessionId && (
        <button
          onClick={async () => {
            setLoadingPhoto(true);
            const url = await getSignedPhotoUrl(sessionId);
            setLoadingPhoto(false);
            if (url) window.open(url, "_blank");
          }}
          disabled={loadingPhoto}
          className="mt-2 text-xs text-purple-500 hover:text-purple-700 hover:underline disabled:opacity-50"
        >
          {loadingPhoto ? "Loading…" : "Source photo →"}
        </button>
      )}
    </div>
  );
}
