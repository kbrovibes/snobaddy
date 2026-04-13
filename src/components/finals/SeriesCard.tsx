"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { FinalsMatch } from "./FinalsMatchList";

interface SeriesData {
  id: string;
  team1_player1_id: string;
  team1_player2_id: string;
  team1_seed: string | null;
  team2_player1_id: string;
  team2_player2_id: string;
  team2_seed: string | null;
  team1_wins: number;
  team2_wins: number;
  winning_team: number | null;
  status: string;
}

function firstName(name: string) {
  return name.split(" ")[0];
}

export default function SeriesCard({
  series,
  seriesMatches,
  playerNames,
  sessionId,
  isActive,
}: {
  series: SeriesData;
  seriesMatches: FinalsMatch[];
  playerNames: Map<string, string>;
  sessionId: string;
  isActive: boolean;
}) {
  const t1p1 = firstName(playerNames.get(series.team1_player1_id) ?? "?");
  const t1p2 = firstName(playerNames.get(series.team1_player2_id) ?? "?");
  const t2p1 = firstName(playerNames.get(series.team2_player1_id) ?? "?");
  const t2p2 = firstName(playerNames.get(series.team2_player2_id) ?? "?");

  const team1Label = `${t1p1} & ${t1p2}`;
  const team2Label = `${t2p1} & ${t2p2}`;
  const seriesDecided = series.winning_team != null;

  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-xs font-semibold text-stone-500 uppercase tracking-wide">
        Best-of-3 Final
      </h3>

      {/* Teams + series score */}
      <div className="bg-stone-50 rounded-xl px-4 py-3">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
          <div className={`text-center ${series.winning_team === 1 ? "text-green-700" : "text-stone-700"}`}>
            <p className="text-sm font-bold">{team1Label}</p>
            {series.team1_seed && <p className="text-[10px] text-stone-400">{series.team1_seed}</p>}
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-stone-800">{series.team1_wins} – {series.team2_wins}</p>
          </div>
          <div className={`text-center ${series.winning_team === 2 ? "text-green-700" : "text-stone-700"}`}>
            <p className="text-sm font-bold">{team2Label}</p>
            {series.team2_seed && <p className="text-[10px] text-stone-400">{series.team2_seed}</p>}
          </div>
        </div>
      </div>

      {/* Games */}
      {seriesMatches.map((m, i) => {
        const isPlayed = m.winning_team != null;
        const isLocked = seriesDecided && !isPlayed;
        return (
          <GameCard
            key={m.id}
            gameNum={i + 1}
            match={m}
            team1Label={team1Label}
            team2Label={team2Label}
            isPlayed={isPlayed}
            isLocked={isLocked}
            sessionId={sessionId}
            isActive={isActive}
          />
        );
      })}

      {/* Winner banner handled by parent FinalsGroupView */}
    </div>
  );
}

function GameCard({
  gameNum,
  match,
  team1Label,
  team2Label,
  isPlayed,
  isLocked,
  sessionId,
  isActive,
}: {
  gameNum: number;
  match: FinalsMatch;
  team1Label: string;
  team2Label: string;
  isPlayed: boolean;
  isLocked: boolean;
  sessionId: string;
  isActive: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [score1, setScore1] = useState(isPlayed ? String(match.team1_score) : "");
  const [score2, setScore2] = useState(isPlayed ? String(match.team2_score) : "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const winnerLabel = isPlayed
    ? match.winning_team === 1 ? team1Label : team2Label
    : null;

  async function handleSave() {
    const s1 = Number(score1);
    const s2 = Number(score2);
    if (isNaN(s1) || isNaN(s2) || s1 < 0 || s2 < 0) { setError("Enter valid scores"); return; }
    if (s1 === s2) { setError("Scores cannot be tied"); return; }

    setSaving(true);
    setError(null);
    const res = await fetch(`/api/sessions/${sessionId}/finals-series`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ match_id: match.id, team1_score: s1, team2_score: s2 }),
    });
    if (!res.ok) {
      const json = await res.json();
      setError(json.error ?? "Failed to save");
    } else {
      setEditing(false);
      startTransition(() => router.refresh());
    }
    setSaving(false);
  }

  if (isLocked) {
    return (
      <div className="rounded-xl border border-dashed border-stone-200 px-3 py-2.5 bg-stone-50/50">
        <span className="text-xs text-stone-400">Game {gameNum} — not needed</span>
      </div>
    );
  }

  return (
    <div className={`rounded-xl border px-3 py-2.5 transition-colors ${
      isPlayed ? "bg-emerald-50/50 border-emerald-200" : "bg-white border-stone-200"
    }`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[10px] font-bold text-stone-400 uppercase">Game {gameNum}</span>
        <div className="flex items-center gap-2">
          {isPlayed && !editing && isActive && (
            <button onClick={() => { setEditing(true); setScore1(String(match.team1_score)); setScore2(String(match.team2_score)); }}
              className="text-[10px] text-sky-600 hover:text-sky-800">
              Edit
            </button>
          )}
          {isPlayed && !editing && (
            <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-100 px-1.5 py-0.5 rounded-full">
              ✓
            </span>
          )}
        </div>
      </div>

      {/* Teams — same 3-column layout */}
      <div className="text-sm">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          <span className={`font-semibold truncate text-left ${isPlayed ? (match.winning_team === 1 ? "text-green-600" : "text-stone-400") : "text-stone-700"}`}>
            {team1Label}
          </span>
          <span className="text-stone-300 text-center w-6">vs</span>
          <span className={`font-semibold truncate text-left ${isPlayed ? (match.winning_team === 2 ? "text-green-600" : "text-stone-400") : "text-stone-700"}`}>
            {team2Label}
          </span>
        </div>

        {/* Score + winner line */}
        {isPlayed && !editing && (
          <div className="text-xs text-stone-400 mt-0.5">
            {match.team1_score} – {match.team2_score} · {winnerLabel} won
          </div>
        )}
      </div>

      {/* Score entry */}
      {((!isPlayed && isActive) || editing) && (
        <div className="mt-2 flex flex-col gap-2">
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
            <input type="text" inputMode="numeric" pattern="[0-9]*" value={score1}
              onChange={(e) => setScore1(e.target.value.replace(/\D/g, ""))}
              className="w-full text-center border border-stone-200 rounded-lg py-1.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-sky-300 bg-stone-50" placeholder="—" />
            <span className="text-stone-300 text-center w-6">–</span>
            <input type="text" inputMode="numeric" pattern="[0-9]*" value={score2}
              onChange={(e) => setScore2(e.target.value.replace(/\D/g, ""))}
              className="w-full text-center border border-stone-200 rounded-lg py-1.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-sky-300 bg-stone-50" placeholder="—" />
          </div>
          <div className="flex justify-center gap-2">
            <button onClick={handleSave} disabled={saving || isPending}
              className="px-5 text-xs font-semibold text-white bg-stone-900 hover:bg-stone-800 rounded-lg py-2 disabled:opacity-40 transition-colors">
              {saving ? "Saving…" : "Save"}
            </button>
            {editing && (
              <button onClick={() => setEditing(false)}
                className="px-4 text-xs text-stone-400 hover:text-stone-600 border border-stone-200 rounded-lg py-2 transition-colors">
                Cancel
              </button>
            )}
          </div>
        </div>
      )}

      {error && <p className="text-[10px] text-red-500 mt-1">{error}</p>}
    </div>
  );
}
