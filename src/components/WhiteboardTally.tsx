"use client";

import { useRouter } from "next/navigation";
import { useState, useRef, useCallback, useEffect } from "react";

interface WhiteboardPlayer {
  player_id: string;
  name: string;
  wins: number;
  losses: number;
  checked_out: boolean;
}

interface Props {
  sessionId: string;
  players: WhiteboardPlayer[];
  nameMap?: Record<string, string>;
}

interface TallyChange {
  player_id: string;
  name: string;
  field: "wins" | "losses";
  timestamp: number;
}

export default function WhiteboardTally({ sessionId, players, nameMap }: Props) {
  const router = useRouter();
  const [tallies, setTallies] = useState<Record<string, { wins: number; losses: number }>>(
    () => Object.fromEntries(players.map((p) => [p.player_id, { wins: p.wins, losses: p.losses }]))
  );

  // Sync local tallies when server props change (e.g. after undo triggers router.refresh)
  useEffect(() => {
    setTallies(Object.fromEntries(players.map((p) => [p.player_id, { wins: p.wins, losses: p.losses }])));
  }, [players]);
  const [matchFlash, setMatchFlash] = useState<string | null>(null);
  const [tapFlash, setTapFlash] = useState<Record<string, "wins" | "losses" | null>>({});
  const [saveStatus, setSaveStatus] = useState<Record<string, "saving" | "saved" | "error" | null>>({});
  const [editingPlayer, setEditingPlayer] = useState<string | null>(null);
  const recentChangesRef = useRef<TallyChange[]>([]);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const activePlayers = players
    .filter((p) => !p.checked_out)
    .sort((a, b) => a.name.localeCompare(b.name));
  const checkedOutPlayers = players
    .filter((p) => p.checked_out)
    .sort((a, b) => a.name.localeCompare(b.name));

  const scheduleRefresh = useCallback(() => {
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    refreshTimer.current = setTimeout(() => router.refresh(), 2000);
  }, [router]);

  async function autoSaveMatch(changes: TallyChange[]) {
    if (changes.length < 4) return;
    const last4 = changes.slice(-4);
    const wins = last4.filter((c) => c.field === "wins");
    const losses = last4.filter((c) => c.field === "losses");
    if (wins.length !== 2 || losses.length !== 2) return;
    if (new Set(last4.map((c) => c.player_id)).size !== 4) return;

    const label = `${wins.map((w) => displayName(w.name)).join(" & ")} beat ${losses.map((l) => displayName(l.name)).join(" & ")}`;
    try {
      await fetch("/api/matches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionId,
          team1: wins.map((w) => w.player_id),
          team2: losses.map((l) => l.player_id),
          team1_score: 21,
          team2_score: 15,
        }),
      });
      setMatchFlash(label);
      setTimeout(() => setMatchFlash(null), 3000);
    } catch { /* match recording is optional */ }
    recentChangesRef.current = [];
  }

  async function handleTap(playerId: string, playerName: string, field: "wins" | "losses") {
    const current = tallies[playerId] ?? { wins: 0, losses: 0 };

    // Haptic feedback + tap flash
    if (navigator.vibrate) navigator.vibrate(15);
    setTapFlash((prev) => ({ ...prev, [playerId]: field }));
    setTimeout(() => setTapFlash((prev) => ({ ...prev, [playerId]: null })), 400);

    // Optimistic update
    setTallies((prev) => ({
      ...prev,
      [playerId]: { ...prev[playerId], [field]: (prev[playerId]?.[field] ?? 0) + 1 },
    }));

    recentChangesRef.current = [...recentChangesRef.current, { player_id: playerId, name: playerName, field, timestamp: Date.now() }];
    autoSaveMatch(recentChangesRef.current);

    setSaveStatus((prev) => ({ ...prev, [playerId]: "saving" }));
    try {
      const res = await fetch(`/api/sessions/${sessionId}/tally/increment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ player_id: playerId, field, delta: 1 }),
      });
      const data = await res.json();
      if (res.ok) {
        setTallies((prev) => ({ ...prev, [playerId]: { wins: data.wins, losses: data.losses } }));
        setSaveStatus((prev) => ({ ...prev, [playerId]: "saved" }));
        setTimeout(() => setSaveStatus((prev) => ({ ...prev, [playerId]: null })), 1200);
      } else {
        setTallies((prev) => ({ ...prev, [playerId]: current }));
        setSaveStatus((prev) => ({ ...prev, [playerId]: "error" }));
        setTimeout(() => setSaveStatus((prev) => ({ ...prev, [playerId]: null })), 2000);
      }
    } catch {
      setTallies((prev) => ({ ...prev, [playerId]: current }));
      setSaveStatus((prev) => ({ ...prev, [playerId]: "error" }));
      setTimeout(() => setSaveStatus((prev) => ({ ...prev, [playerId]: null })), 2000);
    }
    scheduleRefresh();
  }

  async function handleDecrement(playerId: string, field: "wins" | "losses") {
    const current = tallies[playerId] ?? { wins: 0, losses: 0 };
    if (current[field] <= 0) return;

    if (navigator.vibrate) navigator.vibrate(15);

    setTallies((prev) => ({
      ...prev,
      [playerId]: { ...prev[playerId], [field]: Math.max(0, (prev[playerId]?.[field] ?? 0) - 1) },
    }));

    setSaveStatus((prev) => ({ ...prev, [playerId]: "saving" }));
    try {
      const res = await fetch(`/api/sessions/${sessionId}/tally/increment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ player_id: playerId, field, delta: -1 }),
      });
      const data = await res.json();
      if (res.ok) {
        setTallies((prev) => ({ ...prev, [playerId]: { wins: data.wins, losses: data.losses } }));
        setSaveStatus((prev) => ({ ...prev, [playerId]: "saved" }));
        setTimeout(() => setSaveStatus((prev) => ({ ...prev, [playerId]: null })), 1200);
      } else {
        setTallies((prev) => ({ ...prev, [playerId]: current }));
        setSaveStatus((prev) => ({ ...prev, [playerId]: "error" }));
        setTimeout(() => setSaveStatus((prev) => ({ ...prev, [playerId]: null })), 2000);
      }
    } catch {
      setTallies((prev) => ({ ...prev, [playerId]: current }));
      setSaveStatus((prev) => ({ ...prev, [playerId]: "error" }));
      setTimeout(() => setSaveStatus((prev) => ({ ...prev, [playerId]: null })), 2000);
    }
    scheduleRefresh();
  }

  function displayName(name: string) {
    if (nameMap?.[name]) return nameMap[name];
    return name.trim().split(/\s+/)[0];
  }

  function StatusIcon({ playerId }: { playerId: string }) {
    const status = saveStatus[playerId];
    if (status === "saving") return <span className="w-3 h-3 shrink-0 rounded-full border-2 border-stone-300 dark:border-border border-t-stone-600 animate-spin" />;
    if (status === "saved") return <span className="text-green-500 text-xs shrink-0">&#10003;</span>;
    if (status === "error") return <span className="text-red-500 text-xs shrink-0">&#10007;</span>;
    return null;
  }

  function PlayerTableRow({ player }: { player: WhiteboardPlayer }) {
    const t = tallies[player.player_id] ?? { wins: 0, losses: 0 };
    const out = player.checked_out;
    const flash = tapFlash[player.player_id];

    return (
      <tr className={`transition-colors duration-300 ${
        flash === "wins" ? "bg-green-50 dark:bg-green-500/10" : flash === "losses" ? "bg-orange-50 dark:bg-orange-500/10" : ""
      }`}>
        {/* Name + status */}
        <td className="py-1.5 pl-2 pr-0.5">
          <div className="flex items-center gap-1">
            <span className={`text-xs font-medium truncate ${out ? "text-stone-400 dark:text-stone-500" : "text-heading"}`}>
              {displayName(player.name)}
            </span>
            <StatusIcon playerId={player.player_id} />
          </div>
        </td>
        {/* W count */}
        <td className="py-1.5 px-0.5 text-center">
          <span className={`text-sm font-bold tabular-nums transition-transform duration-150 inline-block ${
            flash === "wins" ? "scale-125" : ""
          } ${out ? "text-stone-400 dark:text-stone-500" : "text-green-700 dark:text-green-400"}`}>
            {t.wins}
          </span>
        </td>
        {/* L count */}
        <td className="py-1.5 px-0.5 text-center">
          <span className={`text-sm font-bold tabular-nums transition-transform duration-150 inline-block ${
            flash === "losses" ? "scale-125" : ""
          } ${out ? "text-stone-400 dark:text-stone-500" : "text-orange-600 dark:text-orange-400"}`}>
            {t.losses}
          </span>
        </td>
        {/* Action buttons */}
        <td className="py-1.5 pr-1 pl-0.5">
          {!out && editingPlayer === player.player_id ? (
            <div className="flex flex-col gap-0.5">
              <div className="flex items-center gap-0.5 justify-end">
                <button
                  onClick={() => handleDecrement(player.player_id, "wins")}
                  disabled={t.wins <= 0}
                  className="h-6 w-6 rounded bg-stone-100 dark:bg-stone-700 text-stone-500 dark:text-stone-300 text-[10px] font-bold active:bg-stone-200 dark:active:bg-stone-600 transition-colors disabled:opacity-30"
                >
                  −
                </button>
                <span className="text-[10px] font-bold text-green-700 dark:text-green-400 w-4 text-center">W</span>
                <button
                  onClick={() => handleTap(player.player_id, player.name, "wins")}
                  className="h-6 w-6 rounded bg-green-100 dark:bg-green-500/15 text-green-700 dark:text-green-400 text-[10px] font-bold active:bg-green-300 transition-colors"
                >
                  +
                </button>
              </div>
              <div className="flex items-center gap-0.5 justify-end">
                <button
                  onClick={() => handleDecrement(player.player_id, "losses")}
                  disabled={t.losses <= 0}
                  className="h-6 w-6 rounded bg-stone-100 dark:bg-stone-700 text-stone-500 dark:text-stone-300 text-[10px] font-bold active:bg-stone-200 dark:active:bg-stone-600 transition-colors disabled:opacity-30"
                >
                  −
                </button>
                <span className="text-[10px] font-bold text-orange-600 dark:text-orange-400 w-4 text-center">L</span>
                <button
                  onClick={() => handleTap(player.player_id, player.name, "losses")}
                  className="h-6 w-6 rounded bg-orange-100 dark:bg-orange-500/15 text-orange-600 dark:text-orange-400 text-[10px] font-bold active:bg-orange-300 transition-colors"
                >
                  +
                </button>
              </div>
              <button
                onClick={() => setEditingPlayer(null)}
                className="text-[9px] text-sky-600 dark:text-sky-400 font-medium mt-0.5"
              >
                done
              </button>
            </div>
          ) : !out ? (
            <div className="flex gap-0.5 justify-end">
              <button
                onClick={() => handleTap(player.player_id, player.name, "wins")}
                className="h-7 w-8 rounded-md bg-green-100 dark:bg-green-500/15 text-green-700 dark:text-green-400 text-[10px] font-bold active:bg-green-300 transition-colors"
              >
                +W
              </button>
              <button
                onClick={() => handleTap(player.player_id, player.name, "losses")}
                className="h-7 w-8 rounded-md bg-orange-100 dark:bg-orange-500/15 text-orange-600 dark:text-orange-400 text-[10px] font-bold active:bg-orange-300 transition-colors"
              >
                +L
              </button>
              <button
                onClick={() => setEditingPlayer(player.player_id)}
                className="h-7 w-7 rounded-md bg-stone-100 dark:bg-stone-700 text-stone-500 dark:text-stone-400 text-[9px] font-bold active:bg-stone-200 dark:active:bg-stone-600 transition-colors"
              >
                ✎
              </button>
            </div>
          ) : null}
        </td>
      </tr>
    );
  }

  function HalfTable({ players, showHeader }: { players: WhiteboardPlayer[]; showHeader: boolean }) {
    return (
      <table className="w-full">
        {showHeader && (
          <thead className="sticky top-0 bg-surface z-10">
            <tr className="border-b border-border">
              <th className="py-1.5 pl-2 pr-0.5 text-left text-[10px] font-semibold text-muted-light uppercase">Player</th>
              <th className="py-1.5 px-0.5 text-center text-[10px] font-semibold text-green-600 dark:text-green-400 uppercase w-6">W</th>
              <th className="py-1.5 px-0.5 text-center text-[10px] font-semibold text-orange-500 uppercase w-6">L</th>
              <th className="py-1.5 pr-1 pl-0.5 w-[6rem]"></th>
            </tr>
          </thead>
        )}
        <tbody className="divide-y divide-border-light">
          {players.map((p) => (
            <PlayerTableRow key={p.player_id} player={p} />
          ))}
        </tbody>
      </table>
    );
  }

  const leftActive = activePlayers.filter((_, i) => i % 2 === 0);
  const rightActive = activePlayers.filter((_, i) => i % 2 === 1);
  const leftOut = checkedOutPlayers.filter((_, i) => i % 2 === 0);
  const rightOut = checkedOutPlayers.filter((_, i) => i % 2 === 1);

  return (
    <div className="bg-surface rounded-xl shadow-sm flex flex-col">
      {/* Match auto-saved flash */}
      {matchFlash && (
        <div className="mx-3 mt-2 px-3 py-1.5 bg-sky-50 dark:bg-sky-500/10 border border-sky-200 rounded-lg text-xs text-sky-700 font-medium">
          Match saved: {matchFlash}
        </div>
      )}

      {/* 2-column tables */}
      <div className="grid grid-cols-[1fr_1px_1fr]">
        <HalfTable players={leftActive} showHeader={true} />
        <div className="bg-stone-200 dark:bg-border my-2" />
        <HalfTable players={rightActive} showHeader={true} />
      </div>

      {/* Checked-out players */}
      {checkedOutPlayers.length > 0 && (
        <>
          <div className="flex items-center gap-2 px-3 py-1.5">
            <div className="flex-1 h-px bg-stone-200 dark:bg-border dark:bg-border" />
            <span className="text-[10px] text-muted-light">checked out</span>
            <div className="flex-1 h-px bg-stone-200 dark:bg-border dark:bg-border" />
          </div>
          <div className="grid grid-cols-[1fr_1px_1fr]">
            <HalfTable players={leftOut} showHeader={false} />
            <div className="bg-stone-200 dark:bg-border my-1" />
            <HalfTable players={rightOut} showHeader={false} />
          </div>
        </>
      )}
    </div>
  );
}
