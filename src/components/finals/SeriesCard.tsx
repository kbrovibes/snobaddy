"use client";

import React, { useState } from "react";
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
  const t1p1 = playerNames.get(series.team1_player1_id) ?? "?";
  const t1p2 = playerNames.get(series.team1_player2_id) ?? "?";
  const t2p1 = playerNames.get(series.team2_player1_id) ?? "?";
  const t2p2 = playerNames.get(series.team2_player2_id) ?? "?";

  const seriesDecided = series.winning_team != null;

  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-xs font-semibold text-stone-500 uppercase tracking-wide">
        Best-of-3 Final
      </h3>

      {/* Teams */}
      <div className="bg-stone-50 rounded-xl px-4 py-3">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
          <div className={`text-center ${series.winning_team === 1 ? "text-green-700" : "text-stone-700"}`}>
            <p className="text-sm font-bold">{t1p1} & {t1p2}</p>
            {series.team1_seed && <p className="text-[10px] text-stone-400">{series.team1_seed}</p>}
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-stone-800">{series.team1_wins} – {series.team2_wins}</p>
          </div>
          <div className={`text-center ${series.winning_team === 2 ? "text-green-700" : "text-stone-700"}`}>
            <p className="text-sm font-bold">{t2p1} & {t2p2}</p>
            {series.team2_seed && <p className="text-[10px] text-stone-400">{series.team2_seed}</p>}
          </div>
        </div>
      </div>

      {/* Games */}
      {seriesMatches.map((m, i) => {
        const gameNum = i + 1;
        const isPlayed = m.winning_team != null;
        const isLocked = seriesDecided && !isPlayed; // Game 3 locked if 2-0

        return (
          <GameCard
            key={m.id}
            gameNum={gameNum}
            match={m}
            isPlayed={isPlayed}
            isLocked={isLocked}
            sessionId={sessionId}
            isActive={isActive}
          />
        );
      })}

      {/* Winner */}
      {seriesDecided && (
        <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-center">
          <p className="text-lg font-bold text-green-700">
            🏆 {series.winning_team === 1 ? `${t1p1} & ${t1p2}` : `${t2p1} & ${t2p2}`}
          </p>
          <p className="text-xs text-green-500 mt-0.5">
            Series: {series.team1_wins} – {series.team2_wins}
          </p>
        </div>
      )}
    </div>
  );
}

function GameCard({
  gameNum,
  match,
  isPlayed,
  isLocked,
  sessionId,
  isActive,
}: {
  gameNum: number;
  match: FinalsMatch;
  isPlayed: boolean;
  isLocked: boolean;
  sessionId: string;
  isActive: boolean;
}) {
  const [score1, setScore1] = useState(isPlayed ? String(match.team1_score) : "");
  const [score2, setScore2] = useState(isPlayed ? String(match.team2_score) : "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      window.location.reload();
    }
    setSaving(false);
  }

  if (isLocked) {
    return (
      <div className="rounded-lg border border-stone-100 px-3 py-2 bg-stone-50 opacity-50">
        <span className="text-xs text-stone-400">Game {gameNum} — not needed</span>
      </div>
    );
  }

  return (
    <div className={`rounded-lg border px-3 py-2.5 ${isPlayed ? "bg-stone-50 border-stone-200" : "bg-white border-stone-200"}`}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] font-bold text-stone-400 uppercase">Game {gameNum}</span>
        {isPlayed && (
          <span className={`text-xs font-semibold ${match.winning_team === 1 ? "text-green-600" : "text-sky-600"}`}>
            {match.winning_team === 1 ? "Team 1" : "Team 2"} won
          </span>
        )}
      </div>

      {isPlayed && (
        <p className="text-center text-sm text-stone-600 font-semibold">
          {match.team1_score} – {match.team2_score}
        </p>
      )}

      {!isPlayed && isActive && (
        <div className="flex items-center gap-2">
          <input
            type="number" min="0" max="99" value={score1}
            onChange={(e) => setScore1(e.target.value)}
            className="w-14 text-center border border-stone-200 rounded-lg px-1 py-1 text-sm"
            placeholder="0"
          />
          <span className="text-stone-300 text-xs">–</span>
          <input
            type="number" min="0" max="99" value={score2}
            onChange={(e) => setScore2(e.target.value)}
            className="w-14 text-center border border-stone-200 rounded-lg px-1 py-1 text-sm"
            placeholder="0"
          />
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 text-xs font-semibold text-white bg-stone-900 hover:bg-stone-800 rounded-lg py-1.5 disabled:opacity-40"
          >
            {saving ? "…" : "Save"}
          </button>
        </div>
      )}

      {error && <p className="text-[10px] text-red-500 mt-1">{error}</p>}
    </div>
  );
}
