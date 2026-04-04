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
}: {
  sessionId: string;
  checkedInPlayers: Player[];
}) {
  const [w1, setW1] = useState(EMPTY);
  const [w2, setW2] = useState(EMPTY);
  const [l1, setL1] = useState(EMPTY);
  const [l2, setL2] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const selected = [w1, w2, l1, l2];
  const canSave = selected.every(Boolean) && new Set(selected).size === 4;

  function clear() {
    setW1(EMPTY); setW2(EMPTY); setL1(EMPTY); setL2(EMPTY);
    setError("");
  }

  function options(exclude: string[]) {
    return checkedInPlayers.filter((p) => !exclude.includes(p.player_id));
  }

  async function save() {
    if (!canSave) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/matches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionId,
          team1: [w1, w2],
          team2: [l1, l2],
          team1_score: 21,
          team2_score: 15,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Failed to save."); setSaving(false); return; }
      clear();
      router.refresh();
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
          value ? "border-blue-400 text-gray-900" : "border-gray-200 text-gray-400"
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
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Record a Score</h2>
      {/* 3-col layout: winners | vs | losers */}
      <div className="grid grid-cols-[1fr_2rem_1fr] items-start gap-2">
        {/* Winners */}
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-bold text-green-600 uppercase tracking-wide">Winners</span>
          <PlayerSelect value={w1} onChange={setW1} exclude={[w2, l1, l2]} />
          <PlayerSelect value={w2} onChange={setW2} exclude={[w1, l1, l2]} />
        </div>

        {/* VS */}
        <div className="flex items-center justify-center h-full pt-5">
          <span className="text-xs font-bold text-gray-300">vs</span>
        </div>

        {/* Losers */}
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-bold text-transparent uppercase tracking-wide select-none">–</span>
          <PlayerSelect value={l1} onChange={setL1} exclude={[w1, w2, l2]} />
          <PlayerSelect value={l2} onChange={setL2} exclude={[w1, w2, l1]} />
        </div>
      </div>

      {error && <p className="text-sm text-red-500 text-center">{error}</p>}

      <div className="flex gap-2">
        <button
          onClick={save}
          disabled={!canSave || saving}
          className="flex-1 py-2 bg-blue-600 text-white font-semibold rounded-xl text-sm hover:bg-blue-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {saving ? "Saving…" : "Save"}
        </button>
        <button
          onClick={clear}
          className="px-4 py-2 bg-gray-100 text-gray-600 font-semibold rounded-xl text-sm hover:bg-gray-200 transition-colors"
        >
          Clear
        </button>
      </div>
    </div>
  );
}
