"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

interface Player {
  player_id: string;
  name: string;
  skill_level: number;
}

const EMPTY = "";

export default function SimpleMatchForm({
  sessionId,
  checkedInPlayers,
  isAdmin,
  simpleMode,
}: {
  sessionId: string;
  checkedInPlayers: Player[];
  isAdmin: boolean;
  simpleMode: boolean;
}) {
  const [w1, setW1] = useState(EMPTY);
  const [w2, setW2] = useState(EMPTY);
  const [l1, setL1] = useState(EMPTY);
  const [l2, setL2] = useState(EMPTY);
  const [score1, setScore1] = useState("");
  const [score2, setScore2] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const selected = [w1, w2, l1, l2];
  const canSave = simpleMode
    ? selected.every(Boolean) && new Set(selected).size === 4
    : selected.every(Boolean) && new Set(selected).size === 4 &&
      score1 !== "" && score2 !== "" &&
      parseInt(score1) !== parseInt(score2);

  function clear() {
    setW1(EMPTY); setW2(EMPTY); setL1(EMPTY); setL2(EMPTY);
    setScore1(""); setScore2(""); setError("");
  }

  function options(exclude: string[]) {
    return checkedInPlayers
      .filter((p) => !exclude.includes(p.player_id))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async function save() {
    if (!canSave) return;
    setSaving(true);
    setError("");

    const s1 = simpleMode ? 21 : parseInt(score1);
    const s2 = simpleMode ? 15 : parseInt(score2);

    try {
      const res = await fetch("/api/matches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionId,
          team1: [w1, w2],
          team2: [l1, l2],
          team1_score: s1,
          team2_score: s2,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Failed to save."); setSaving(false); return; }
      setSaved(true);
      setTimeout(() => {
        setSaved(false);
        clear();
        router.refresh();
      }, 1500);
    } catch {
      setError("An unexpected error occurred.");
    }
    setSaving(false);
  }

  function PlayerSelect({
    value,
    onChange,
    exclude,
  }: {
    value: string;
    onChange: (v: string) => void;
    exclude: string[];
  }) {
    return (
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full border rounded-lg px-2 py-2 text-sm bg-white font-medium ${
          value ? "border-sky-400 text-stone-900" : "border-stone-200 text-stone-400"
        }`}
      >
        <option value="" disabled>Pick…</option>
        {options(exclude.filter((id) => id !== value)).map((p) => (
          <option key={p.player_id} value={p.player_id}>{p.name}</option>
        ))}
      </select>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm px-4 py-3 flex flex-col gap-3">

      {/* Header */}
      <h2 className="text-sm font-semibold text-stone-500 uppercase tracking-wide">
        {simpleMode ? "Record Win/Loss" : "Record a Match"}
      </h2>

      {/* 3-col layout: winners | vs | losers */}
      <div className="grid grid-cols-[1fr_2rem_1fr] items-start gap-2">
        <div className={`flex flex-col gap-1.5 border rounded-xl px-2.5 py-2 ${
          simpleMode ? "border-green-200 bg-green-50/40" : "border-stone-200 bg-stone-50/40"
        }`}>
          <span className={`text-xs font-bold uppercase tracking-wide ${
            simpleMode ? "text-green-600" : "text-sky-600"
          }`}>
            {simpleMode ? "Winning Team" : "Team 1"}
          </span>
          <PlayerSelect value={w1} onChange={setW1} exclude={[w2, l1, l2]} />
          <PlayerSelect value={w2} onChange={setW2} exclude={[w1, l1, l2]} />
        </div>

        <div className="flex items-center justify-center h-full pt-5">
          <span className="text-xs font-bold text-stone-300">vs</span>
        </div>

        <div className="flex flex-col gap-1.5 border border-stone-200 bg-stone-50/40 rounded-xl px-2.5 py-2">
          <span className="text-xs font-bold text-stone-400 uppercase tracking-wide select-none">
            {simpleMode ? <>&nbsp;</> : "Team 2"}
          </span>
          <PlayerSelect value={l1} onChange={setL1} exclude={[w1, w2, l2]} />
          <PlayerSelect value={l2} onChange={setL2} exclude={[w1, w2, l1]} />
        </div>
      </div>

      {/* Score fields — only in full mode */}
      {!simpleMode && (
        <div className="flex items-center gap-3">
          <input
            type="number" min="0" max="99"
            value={score1}
            onChange={(e) => setScore1(e.target.value)}
            placeholder="21"
            className="flex-1 text-center text-xl font-bold text-stone-900 border-2 border-stone-200 rounded-xl py-2.5 focus:border-sky-400 outline-none"
          />
          <span className="text-lg font-bold text-stone-300">–</span>
          <input
            type="number" min="0" max="99"
            value={score2}
            onChange={(e) => setScore2(e.target.value)}
            placeholder="15"
            className="flex-1 text-center text-xl font-bold text-stone-900 border-2 border-stone-200 rounded-xl py-2.5 focus:border-sky-400 outline-none"
          />
        </div>
      )}

      {error && <p className="text-sm text-red-500 text-center">{error}</p>}
      {saved && <p className="text-sm text-green-600 font-medium text-center">Score saved!</p>}

      <div className="flex gap-2">
        <button
          onClick={save}
          disabled={!canSave || saving || saved}
          className="flex-1 py-2 bg-stone-900 text-white font-semibold rounded-xl text-sm hover:bg-stone-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {saving ? "Saving…" : "Save"}
        </button>
        <button
          onClick={clear}
          className="px-4 py-2 bg-stone-100 text-stone-600 font-semibold rounded-xl text-sm hover:bg-stone-200 transition-colors"
        >
          Clear
        </button>
      </div>
    </div>
  );
}
