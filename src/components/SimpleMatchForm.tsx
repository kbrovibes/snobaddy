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

  const PlayerSelect = ({
    value,
    onChange,
    exclude,
    label,
  }: {
    value: string;
    onChange: (v: string) => void;
    exclude: string[];
    label: string;
  }) => (
    <div className="flex-1">
      <label className="text-xs text-gray-400 mb-1 block">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full border rounded-lg px-3 py-2.5 text-sm bg-white font-medium ${
          value ? "border-blue-400 text-gray-900" : "border-gray-200 text-gray-400"
        }`}
      >
        <option value="" disabled>Pick player…</option>
        {options(exclude.filter((id) => id !== value)).map((p) => (
          <option key={p.player_id} value={p.player_id}>{p.name}</option>
        ))}
      </select>
    </div>
  );

  return (
    <div className="bg-white rounded-xl shadow-sm px-4 py-4 flex flex-col gap-4">
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Record a Win</h2>

      <div className="flex flex-col gap-3">
        <p className="text-xs font-semibold text-green-600 uppercase tracking-wide">Winners</p>
        <div className="flex gap-2">
          <PlayerSelect value={w1} onChange={setW1} exclude={[w2, l1, l2]} label="Player 1" />
          <PlayerSelect value={w2} onChange={setW2} exclude={[w1, l1, l2]} label="Player 2" />
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <p className="text-xs font-semibold text-red-400 uppercase tracking-wide">Losers</p>
        <div className="flex gap-2">
          <PlayerSelect value={l1} onChange={setL1} exclude={[w1, w2, l2]} label="Player 3" />
          <PlayerSelect value={l2} onChange={setL2} exclude={[w1, w2, l1]} label="Player 4" />
        </div>
      </div>

      {error && <p className="text-sm text-red-500 text-center">{error}</p>}

      <div className="flex gap-2">
        <button
          onClick={save}
          disabled={!canSave || saving}
          className="flex-1 py-2.5 bg-blue-600 text-white font-semibold rounded-xl text-sm hover:bg-blue-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {saving ? "Saving…" : "Save"}
        </button>
        <button
          onClick={clear}
          className="px-5 py-2.5 bg-gray-100 text-gray-600 font-semibold rounded-xl text-sm hover:bg-gray-200 transition-colors"
        >
          Clear
        </button>
      </div>
    </div>
  );
}
