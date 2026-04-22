"use client";

import { useRouter } from "next/navigation";
import { useState, useRef, useCallback } from "react";

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
  isAdmin: boolean;
}

interface TallyChange {
  player_id: string;
  name: string;
  field: "wins" | "losses";
  timestamp: number;
}

export default function WhiteboardTally({ sessionId, players, isAdmin }: Props) {
  const router = useRouter();
  const [tallies, setTallies] = useState<Record<string, { wins: number; losses: number }>>(
    () => Object.fromEntries(players.map((p) => [p.player_id, { wins: p.wins, losses: p.losses }]))
  );
  const [toggling, setToggling] = useState(false);
  const [matchFlash, setMatchFlash] = useState<string | null>(null);
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

    // Auto-save the match
    const label = `${wins.map((w) => w.name).join(" & ")} beat ${losses.map((l) => l.name).join(" & ")}`;
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

  async function handleTap(playerId: string, playerName: string, field: "wins" | "losses", delta: 1 | -1) {
    const current = tallies[playerId] ?? { wins: 0, losses: 0 };
    if (delta === -1 && current[field] <= 0) return;

    // Optimistic update
    setTallies((prev) => ({
      ...prev,
      [playerId]: { ...prev[playerId], [field]: Math.max(0, (prev[playerId]?.[field] ?? 0) + delta) },
    }));

    if (delta === 1) {
      recentChangesRef.current = [...recentChangesRef.current, { player_id: playerId, name: playerName, field, timestamp: Date.now() }];
      autoSaveMatch(recentChangesRef.current);
    }

    try {
      const res = await fetch(`/api/sessions/${sessionId}/tally/increment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ player_id: playerId, field, delta }),
      });
      const data = await res.json();
      if (res.ok) {
        setTallies((prev) => ({ ...prev, [playerId]: { wins: data.wins, losses: data.losses } }));
      } else {
        setTallies((prev) => ({ ...prev, [playerId]: current }));
      }
    } catch {
      setTallies((prev) => ({ ...prev, [playerId]: current }));
    }
    scheduleRefresh();
  }

  async function toggleOff() {
    if (!isAdmin) return;
    setToggling(true);
    const res = await fetch(`/api/sessions/${sessionId}/whiteboard-mode`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ whiteboard_mode: false }),
    });
    if (!res.ok) {
      const data = await res.json();
      alert(data.error ?? "Cannot disable whiteboard mode");
    }
    router.refresh();
    setToggling(false);
  }

  function PlayerRow({ player }: { player: WhiteboardPlayer }) {
    const t = tallies[player.player_id] ?? { wins: 0, losses: 0 };
    const out = player.checked_out;

    return (
      <div className={`flex items-center gap-2 py-2 px-2 ${out ? "opacity-40" : ""}`}>
        {/* Name */}
        <span className={`flex-1 text-sm font-medium truncate ${out ? "text-stone-400" : "text-stone-800"}`}>
          {player.name}
        </span>

        {/* Wins */}
        {!out && (
          <button
            onClick={() => handleTap(player.player_id, player.name, "wins", -1)}
            disabled={t.wins <= 0}
            className="w-6 h-7 flex items-center justify-center rounded text-stone-400 text-xs font-bold disabled:opacity-20 active:bg-stone-100"
          >
            −
          </button>
        )}
        <span className={`text-sm font-bold w-6 text-center ${out ? "text-stone-400" : "text-green-700"}`}>
          {t.wins}
        </span>
        <span className={`text-xs font-bold ${out ? "text-stone-300" : "text-green-600"}`}>W</span>
        {!out && (
          <button
            onClick={() => handleTap(player.player_id, player.name, "wins", 1)}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-green-100 text-green-700 text-base font-bold active:bg-green-300 transition-colors"
          >
            +
          </button>
        )}

        <div className="w-2" />

        {/* Losses */}
        {!out && (
          <button
            onClick={() => handleTap(player.player_id, player.name, "losses", -1)}
            disabled={t.losses <= 0}
            className="w-6 h-7 flex items-center justify-center rounded text-stone-400 text-xs font-bold disabled:opacity-20 active:bg-stone-100"
          >
            −
          </button>
        )}
        <span className={`text-sm font-bold w-6 text-center ${out ? "text-stone-400" : "text-orange-600"}`}>
          {t.losses}
        </span>
        <span className={`text-xs font-bold ${out ? "text-stone-300" : "text-orange-500"}`}>L</span>
        {!out && (
          <button
            onClick={() => handleTap(player.player_id, player.name, "losses", 1)}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-orange-100 text-orange-600 text-base font-bold active:bg-orange-300 transition-colors"
          >
            +
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm px-2 py-3 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-2 mb-2">
        <h2 className="text-sm font-semibold text-stone-500 uppercase tracking-wide">Whiteboard</h2>
        {isAdmin && (
          <button
            onClick={toggleOff}
            disabled={toggling}
            className="flex items-center gap-2 disabled:opacity-50"
          >
            <span className="text-xs text-stone-500">Whiteboard</span>
            <span className="relative inline-flex w-10 h-6 rounded-full transition-colors duration-200 bg-sky-500">
              <span className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 translate-x-4" />
            </span>
          </button>
        )}
      </div>

      {/* Match auto-saved flash */}
      {matchFlash && (
        <div className="mx-2 mb-2 px-3 py-1.5 bg-green-50 border border-green-200 rounded-lg text-xs text-green-700 font-medium">
          Match saved: {matchFlash}
        </div>
      )}

      {/* Active players */}
      <div className="flex flex-col divide-y divide-stone-100">
        {activePlayers.map((p) => (
          <PlayerRow key={p.player_id} player={p} />
        ))}
      </div>

      {/* Checked-out players */}
      {checkedOutPlayers.length > 0 && (
        <>
          <div className="flex items-center gap-2 mt-2 mb-1 px-2">
            <div className="flex-1 h-px bg-stone-200" />
            <span className="text-xs text-stone-400">left early</span>
            <div className="flex-1 h-px bg-stone-200" />
          </div>
          <div className="flex flex-col">
            {checkedOutPlayers.map((p) => (
              <PlayerRow key={p.player_id} player={p} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
