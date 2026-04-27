"use client";

import { useState } from "react";
import NavLink from "@/components/NavLink";
import { useRouter } from "next/navigation";
import { VerifiedBadge, AdminBadge } from "./PlayerBadges";

interface Player {
  player_id: string;
  name: string;
  skill_level: number;
  checked_in_at: string;
  user_id?: string | null;
  is_admin?: boolean;
}

type SortKey = "checked_in_at" | "name" | "skill_level";
type SortDir = "asc" | "desc";

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "America/Los_Angeles",
  });
}

function SkillDots({ level }: { level: number }) {
  return (
    <span className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={`text-xs ${i <= level ? "text-sky-500" : "text-stone-200 dark:text-neutral-700"}`}>●</span>
      ))}
    </span>
  );
}

function SortHeader({
  label, sortKey, current, dir, onSort,
}: {
  label: string;
  sortKey: SortKey;
  current: SortKey;
  dir: SortDir;
  onSort: (k: SortKey) => void;
}) {
  const active = current === sortKey;
  return (
    <button
      onClick={() => onSort(sortKey)}
      className={`flex items-center gap-0.5 text-xs font-semibold uppercase tracking-wide select-none ${
        active ? "text-sky-500" : "text-muted-light hover:text-text"
      }`}
    >
      {label}
      <span className="text-[10px]">
        {active ? (dir === "asc" ? " ▲" : " ▼") : " ⇅"}
      </span>
    </button>
  );
}

export default function WhoIsHere({
  players,
  onlinePlayerIds,
  isAdmin,
  sessionId,
}: {
  players: Player[];
  onlinePlayerIds?: Set<string>;
  isAdmin?: boolean;
  sessionId?: string;
}) {
  const router = useRouter();
  const [sortKey, setSortKey] = useState<SortKey>("checked_in_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [checkingOut, setCheckingOut] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  const PREVIEW = 2;

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  async function handleCheckout(playerId: string) {
    if (!sessionId) return;
    setCheckingOut(playerId);
    try {
      await fetch(`/api/sessions/${sessionId}/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ player_id: playerId }),
      });
      router.refresh();
    } finally {
      setCheckingOut(null);
    }
  }

  const sorted = [...players].sort((a, b) => {
    let cmp = 0;
    if (sortKey === "checked_in_at") {
      cmp = new Date(a.checked_in_at).getTime() - new Date(b.checked_in_at).getTime();
    } else if (sortKey === "name") {
      cmp = a.name.localeCompare(b.name);
    } else if (sortKey === "skill_level") {
      cmp = a.skill_level - b.skill_level;
    }
    return sortDir === "asc" ? cmp : -cmp;
  });

  if (players.length === 0) {
    return <p className="text-sm text-muted-light">No one checked in yet</p>;
  }

  return (
    <div>
      {/* Column headers */}
      <div className="flex items-center px-1 mb-2 gap-2">
        <div className="flex-1">
          <SortHeader label="Name" sortKey="name" current={sortKey} dir={sortDir} onSort={handleSort} />
        </div>
        <div className="w-24 flex justify-center">
          <SortHeader label="Skill" sortKey="skill_level" current={sortKey} dir={sortDir} onSort={handleSort} />
        </div>
        <div className={`flex justify-end ${isAdmin ? "w-28" : "w-16"}`}>
          <SortHeader label="Arrived" sortKey="checked_in_at" current={sortKey} dir={sortDir} onSort={handleSort} />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {(expanded ? sorted : sorted.slice(0, PREVIEW)).map((p) => (
          <div key={p.player_id} className="flex items-center gap-2 px-1">
            <span className="flex items-center gap-1.5 flex-1 min-w-0">
              {onlinePlayerIds?.has(p.player_id) && (
                <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" title="Online now" />
              )}
              <NavLink href={`/players/${p.player_id}`} className="font-medium text-sky-600 text-sm truncate hover:underline active:opacity-60">
                {p.name}
              </NavLink>
              {p.user_id && <VerifiedBadge />}
              {p.is_admin && <AdminBadge />}
            </span>
            <div className="w-24 flex justify-center">
              <SkillDots level={p.skill_level} />
            </div>
            {isAdmin ? (
              <div className="w-28 flex items-center justify-end gap-2">
                <span className="text-[10px] text-muted-light tabular-nums">{formatTime(p.checked_in_at)}</span>
                <button
                  onClick={() => handleCheckout(p.player_id)}
                  disabled={checkingOut === p.player_id}
                  className="text-xs text-red-400 hover:text-red-600 dark:text-red-400 font-medium disabled:opacity-40"
                >
                  {checkingOut === p.player_id ? "…" : "Checkout"}
                </button>
              </div>
            ) : (
              <span className="w-16 text-right text-xs text-muted-light tabular-nums">
                {formatTime(p.checked_in_at)}
              </span>
            )}
          </div>
        ))}
      </div>

      {sorted.length > PREVIEW && (
        <button
          onClick={() => setExpanded(e => !e)}
          className="mt-2 text-xs text-sky-500 hover:text-sky-700 font-medium"
        >
          {expanded ? "See Less" : `See More (${sorted.length - PREVIEW} more)`}
        </button>
      )}
    </div>
  );
}
