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
}

interface TallyChange {
  player_id: string;
  name: string;
  field: "wins" | "losses";
  timestamp: number;
}

export default function WhiteboardTally({ sessionId, players }: Props) {
  const router = useRouter();
  const [tallies, setTallies] = useState<Record<string, { wins: number; losses: number }>>(
    () => Object.fromEntries(players.map((p) => [p.player_id, { wins: p.wins, losses: p.losses }]))
  );
  const [matchFlash, setMatchFlash] = useState<string | null>(null);
  const [saveFlash, setSaveFlash] = useState<string | null>(null);
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
        setSaveFlash(`${playerName} ${field === "wins" ? "W" : "L"} ${delta > 0 ? "+" : "−"}1`);
        setTimeout(() => setSaveFlash(null), 1500);
      } else {
        setTallies((prev) => ({ ...prev, [playerId]: current }));
      }
    } catch {
      setTallies((prev) => ({ ...prev, [playerId]: current }));
    }
    scheduleRefresh();
  }

  function PlayerRow({ player }: { player: WhiteboardPlayer }) {
    const t = tallies[player.player_id] ?? { wins: 0, losses: 0 };
    const out = player.checked_out;

    return (
      <div className={`flex flex-col gap-1 py-1.5 px-2 ${out ? "opacity-40" : ""}`}>
        {/* Name + W/L counts */}
        <div className="flex items-center justify-between">
          <span className={`text-sm font-medium truncate ${out ? "text-stone-400" : "text-stone-800"}`}>
            {player.name}
          </span>
          <span className="text-sm ml-2 shrink-0 flex items-center gap-2">
            <span className={`font-bold ${out ? "text-stone-400" : "text-green-700"}`}>{t.wins}</span>
            <span className={`text-xs ${out ? "text-stone-300" : "text-green-600"}`}>W</span>
            <span className="text-stone-200">·</span>
            <span className={`font-bold ${out ? "text-stone-400" : "text-orange-600"}`}>{t.losses}</span>
            <span className={`text-xs ${out ? "text-stone-300" : "text-orange-500"}`}>L</span>
          </span>
        </div>
        {/* Buttons row */}
        {!out && (
          <div className="flex gap-1">
            <button
              onClick={() => handleTap(player.player_id, player.name, "wins", 1)}
              className="flex-1 h-7 flex items-center justify-center rounded-md bg-green-100 text-green-700 text-xs font-bold active:bg-green-300 transition-colors"
            >
              +W
            </button>
            <button
              onClick={() => handleTap(player.player_id, player.name, "losses", 1)}
              className="flex-1 h-7 flex items-center justify-center rounded-md bg-orange-100 text-orange-600 text-xs font-bold active:bg-orange-300 transition-colors"
            >
              +L
            </button>
            <button
              onClick={() => handleTap(player.player_id, player.name, "wins", -1)}
              disabled={t.wins <= 0}
              className="w-7 h-7 flex items-center justify-center rounded-md bg-stone-100 text-stone-400 text-xs disabled:opacity-20 active:bg-stone-200"
            >
              −W
            </button>
            <button
              onClick={() => handleTap(player.player_id, player.name, "losses", -1)}
              disabled={t.losses <= 0}
              className="w-7 h-7 flex items-center justify-center rounded-md bg-stone-100 text-stone-400 text-xs disabled:opacity-20 active:bg-stone-200"
            >
              −L
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm px-2 py-3 flex flex-col">
      {/* Header + save flash */}
      <div className="flex items-center justify-between px-2 mb-2">
        <h2 className="text-sm font-semibold text-stone-500 uppercase tracking-wide">Whiteboard</h2>
        {saveFlash && (
          <span className="text-xs text-green-600 font-medium animate-pulse">
            Saved: {saveFlash}
          </span>
        )}
        {matchFlash && !saveFlash && (
          <span className="text-xs text-sky-600 font-medium">
            Match: {matchFlash}
          </span>
        )}
      </div>

      {/* Active players — 2-column grid */}
      <div className="grid grid-cols-2 gap-x-0 divide-x divide-stone-100">
        {/* Left column */}
        <div className="flex flex-col divide-y divide-stone-100">
          {activePlayers.filter((_, i) => i % 2 === 0).map((p) => (
            <PlayerRow key={p.player_id} player={p} />
          ))}
        </div>
        {/* Right column */}
        <div className="flex flex-col divide-y divide-stone-100">
          {activePlayers.filter((_, i) => i % 2 === 1).map((p) => (
            <PlayerRow key={p.player_id} player={p} />
          ))}
        </div>
      </div>

      {/* Checked-out players */}
      {checkedOutPlayers.length > 0 && (
        <>
          <div className="flex items-center gap-2 mt-2 mb-1 px-2">
            <div className="flex-1 h-px bg-stone-200" />
            <span className="text-xs text-stone-400">left early</span>
            <div className="flex-1 h-px bg-stone-200" />
          </div>
          <div className="grid grid-cols-2 gap-x-0 divide-x divide-stone-100">
            <div className="flex flex-col divide-y divide-stone-100">
              {checkedOutPlayers.filter((_, i) => i % 2 === 0).map((p) => (
                <PlayerRow key={p.player_id} player={p} />
              ))}
            </div>
            <div className="flex flex-col divide-y divide-stone-100">
              {checkedOutPlayers.filter((_, i) => i % 2 === 1).map((p) => (
                <PlayerRow key={p.player_id} player={p} />
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
