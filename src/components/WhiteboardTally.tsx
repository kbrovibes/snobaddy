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
  const [saving, setSaving] = useState<string | null>(null);
  const [toggling, setToggling] = useState(false);
  const [recentChanges, setRecentChanges] = useState<TallyChange[]>([]);
  const [matchSuggestion, setMatchSuggestion] = useState<{ winners: string[]; losers: string[]; winnerNames: string[]; loserNames: string[] } | null>(null);
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
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

  function checkForMatch(changes: TallyChange[]) {
    if (changes.length < 4) return;
    const last4 = changes.slice(-4);
    const wins = last4.filter((c) => c.field === "wins");
    const losses = last4.filter((c) => c.field === "losses");
    if (wins.length !== 2 || losses.length !== 2) return;
    const allDistinct = new Set(last4.map((c) => c.player_id)).size === 4;
    if (!allDistinct) return;

    if (dismissTimer.current) clearTimeout(dismissTimer.current);
    setMatchSuggestion({
      winners: wins.map((w) => w.player_id),
      losers: losses.map((l) => l.player_id),
      winnerNames: wins.map((w) => w.name),
      loserNames: losses.map((l) => l.name),
    });
    dismissTimer.current = setTimeout(() => {
      setMatchSuggestion(null);
      setRecentChanges([]);
    }, 8000);
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
      const newChanges = [...recentChanges, { player_id: playerId, name: playerName, field, timestamp: Date.now() }];
      setRecentChanges(newChanges);
      checkForMatch(newChanges);
    }

    setSaving(playerId);
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
        // Revert on error
        setTallies((prev) => ({ ...prev, [playerId]: current }));
      }
    } catch {
      setTallies((prev) => ({ ...prev, [playerId]: current }));
    }
    setSaving(null);
    scheduleRefresh();
  }

  async function saveMatch() {
    if (!matchSuggestion) return;
    if (dismissTimer.current) clearTimeout(dismissTimer.current);
    try {
      await fetch("/api/matches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionId,
          team1: matchSuggestion.winners,
          team2: matchSuggestion.losers,
          team1_score: 21,
          team2_score: 15,
        }),
      });
    } catch { /* match recording is optional */ }
    setMatchSuggestion(null);
    setRecentChanges([]);
  }

  function dismissMatch() {
    if (dismissTimer.current) clearTimeout(dismissTimer.current);
    setMatchSuggestion(null);
    setRecentChanges([]);
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

  function PlayerCard({ player }: { player: WhiteboardPlayer }) {
    const t = tallies[player.player_id] ?? { wins: 0, losses: 0 };
    const isCheckedOut = player.checked_out;

    return (
      <div className={`rounded-xl border px-3 py-2.5 ${
        isCheckedOut
          ? "border-stone-100 bg-stone-50 opacity-50"
          : "border-stone-200 bg-white shadow-sm"
      }`}>
        <p className={`text-sm font-semibold truncate mb-1.5 ${
          isCheckedOut ? "text-stone-400" : "text-stone-800"
        }`}>
          {player.name}
        </p>
        <div className="flex items-center gap-2">
          {/* Wins */}
          <div className="flex items-center gap-1 flex-1">
            <span className="text-xs font-bold text-green-600">W</span>
            {!isCheckedOut && (
              <button
                onClick={() => handleTap(player.player_id, player.name, "wins", -1)}
                disabled={t.wins <= 0}
                className="w-6 h-6 flex items-center justify-center rounded bg-stone-100 text-stone-400 text-xs font-bold disabled:opacity-30 active:bg-stone-200"
              >
                −
              </button>
            )}
            <span className={`text-sm font-bold min-w-[1.2rem] text-center ${
              isCheckedOut ? "text-stone-400" : "text-green-700"
            }`}>
              {t.wins}
            </span>
            {!isCheckedOut && (
              <button
                onClick={() => handleTap(player.player_id, player.name, "wins", 1)}
                className="w-7 h-7 flex items-center justify-center rounded-lg bg-green-100 text-green-700 text-sm font-bold active:bg-green-200 transition-colors"
              >
                +
              </button>
            )}
          </div>
          {/* Losses */}
          <div className="flex items-center gap-1 flex-1">
            <span className="text-xs font-bold text-orange-500">L</span>
            {!isCheckedOut && (
              <button
                onClick={() => handleTap(player.player_id, player.name, "losses", -1)}
                disabled={t.losses <= 0}
                className="w-6 h-6 flex items-center justify-center rounded bg-stone-100 text-stone-400 text-xs font-bold disabled:opacity-30 active:bg-stone-200"
              >
                −
              </button>
            )}
            <span className={`text-sm font-bold min-w-[1.2rem] text-center ${
              isCheckedOut ? "text-stone-400" : "text-orange-600"
            }`}>
              {t.losses}
            </span>
            {!isCheckedOut && (
              <button
                onClick={() => handleTap(player.player_id, player.name, "losses", 1)}
                className="w-7 h-7 flex items-center justify-center rounded-lg bg-orange-100 text-orange-600 text-sm font-bold active:bg-orange-200 transition-colors"
              >
                +
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm px-4 py-3 flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between">
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

      {/* Active players grid */}
      <div className="grid grid-cols-2 gap-2">
        {activePlayers.map((p) => (
          <PlayerCard key={p.player_id} player={p} />
        ))}
      </div>

      {/* Checked-out players */}
      {checkedOutPlayers.length > 0 && (
        <>
          <div className="flex items-center gap-2 mt-1">
            <div className="flex-1 h-px bg-stone-200" />
            <span className="text-xs text-stone-400">left early</span>
            <div className="flex-1 h-px bg-stone-200" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            {checkedOutPlayers.map((p) => (
              <PlayerCard key={p.player_id} player={p} />
            ))}
          </div>
        </>
      )}

      {/* Match suggestion toast */}
      {matchSuggestion && (
        <div className="bg-sky-50 border border-sky-200 rounded-xl px-3 py-2.5 flex flex-col gap-2 animate-in fade-in">
          <p className="text-sm text-sky-800">
            <span className="font-semibold">{matchSuggestion.winnerNames.join(" & ")}</span>
            {" beat "}
            <span className="font-semibold">{matchSuggestion.loserNames.join(" & ")}</span>
            ?
          </p>
          <div className="flex gap-2">
            <button
              onClick={saveMatch}
              className="flex-1 py-1.5 bg-sky-600 text-white text-xs font-semibold rounded-lg hover:bg-sky-700 transition-colors"
            >
              Save Match
            </button>
            <button
              onClick={dismissMatch}
              className="px-3 py-1.5 bg-stone-100 text-stone-600 text-xs font-semibold rounded-lg hover:bg-stone-200 transition-colors"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
