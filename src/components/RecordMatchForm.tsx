"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

interface Player {
  player_id: string;
  name: string;
  skill_level: number;
}

interface Props {
  sessionId: string;
  checkedInPlayers: Player[];
}

const EMPTY = "";

export default function RecordMatchForm({ sessionId, checkedInPlayers }: Props) {
  const [open, setOpen] = useState(false);
  const [t1p1, setT1p1] = useState(EMPTY);
  const [t1p2, setT1p2] = useState(EMPTY);
  const [t2p1, setT2p1] = useState(EMPTY);
  const [t2p2, setT2p2] = useState(EMPTY);
  const [score1, setScore1] = useState("");
  const [score2, setScore2] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  function reset() {
    setT1p1(EMPTY); setT1p2(EMPTY); setT2p1(EMPTY); setT2p2(EMPTY);
    setScore1(""); setScore2(""); setError("");
  }

  function close() { reset(); setOpen(false); }

  // Build options excluding already-selected players
  function options(exclude: string[]) {
    return checkedInPlayers.filter((p) => !exclude.includes(p.player_id));
  }

  const selected = [t1p1, t1p2, t2p1, t2p2].filter(Boolean);

  async function submit() {
    setError("");
    if ([t1p1, t1p2, t2p1, t2p2].some((v) => !v)) {
      setError("Select all 4 players."); return;
    }
    const s1 = parseInt(score1), s2 = parseInt(score2);
    if (isNaN(s1) || isNaN(s2) || s1 < 0 || s2 < 0) {
      setError("Enter valid scores."); return;
    }
    if (s1 === s2) { setError("Scores can't be tied."); return; }

    setSaving(true);
    const res = await fetch("/api/matches", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        session_id: sessionId,
        team1: [t1p1, t1p2],
        team2: [t2p1, t2p2],
        team1_score: s1,
        team2_score: s2,
      }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) { setError(data.error ?? "Failed to save."); return; }
    close();
    router.refresh();
  }

  const PlayerSelect = ({
    value, onChange, exclude, label,
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
          value
            ? "border-blue-400 text-gray-900"
            : "border-gray-200 text-gray-400"
        }`}
      >
        <option value="" disabled>Pick player…</option>
        {options(exclude.filter((id) => id !== value)).map((p) => (
          <option key={p.player_id} value={p.player_id}>
            {p.name} {"●".repeat(p.skill_level)}{"○".repeat(5 - p.skill_level)}
          </option>
        ))}
      </select>
    </div>
  );

  const winner = score1 && score2 && score1 !== score2
    ? parseInt(score1) > parseInt(score2) ? "Team 1" : "Team 2"
    : null;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="w-full py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors"
      >
        🎾 Record a Match
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex flex-col bg-white">
          {/* Header */}
          <div className="flex items-center justify-between px-4 h-14 border-b border-gray-100 shrink-0">
            <button onClick={close} className="text-gray-400 text-sm">Cancel</button>
            <h2 className="font-bold text-gray-900">Record Match</h2>
            <button
              onClick={submit}
              disabled={saving}
              className="text-blue-600 font-semibold text-sm disabled:opacity-40"
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-5 flex flex-col gap-5">
            {/* Team 1 */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wide text-blue-600">Team 1</span>
              </div>
              <div className="flex gap-2">
                <PlayerSelect
                  label="Player 1" value={t1p1} onChange={setT1p1}
                  exclude={[t1p2, t2p1, t2p2]}
                />
                <PlayerSelect
                  label="Player 2" value={t1p2} onChange={setT1p2}
                  exclude={[t1p1, t2p1, t2p2]}
                />
              </div>
            </div>

            {/* VS divider */}
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-gray-100" />
              <span className="text-xs font-bold text-gray-300">VS</span>
              <div className="flex-1 h-px bg-gray-100" />
            </div>

            {/* Team 2 */}
            <div className="flex flex-col gap-3">
              <span className="text-xs font-bold uppercase tracking-wide text-orange-500">Team 2</span>
              <div className="flex gap-2">
                <PlayerSelect
                  label="Player 3" value={t2p1} onChange={setT2p1}
                  exclude={[t1p1, t1p2, t2p2]}
                />
                <PlayerSelect
                  label="Player 4" value={t2p2} onChange={setT2p2}
                  exclude={[t1p1, t1p2, t2p1]}
                />
              </div>
            </div>

            {/* Score */}
            <div className="flex flex-col gap-2">
              <span className="text-xs font-bold uppercase tracking-wide text-gray-400">Final Score</span>
              <div className="flex items-center gap-3">
                <div className="flex-1 flex flex-col items-center">
                  <span className="text-xs text-blue-500 font-medium mb-1">Team 1</span>
                  <input
                    type="number" min="0" max="99"
                    value={score1}
                    onChange={(e) => setScore1(e.target.value)}
                    placeholder="21"
                    className="w-full text-center text-2xl font-bold border-2 border-gray-200 rounded-xl py-3 focus:border-blue-400 outline-none"
                  />
                </div>
                <span className="text-xl font-bold text-gray-300 mt-4">–</span>
                <div className="flex-1 flex flex-col items-center">
                  <span className="text-xs text-orange-500 font-medium mb-1">Team 2</span>
                  <input
                    type="number" min="0" max="99"
                    value={score2}
                    onChange={(e) => setScore2(e.target.value)}
                    placeholder="15"
                    className="w-full text-center text-2xl font-bold border-2 border-gray-200 rounded-xl py-3 focus:border-orange-400 outline-none"
                  />
                </div>
              </div>
              {winner && (
                <p className="text-center text-sm font-semibold text-green-600">
                  🏆 {winner} wins
                </p>
              )}
            </div>

            {error && (
              <p className="text-center text-sm text-red-500">{error}</p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
