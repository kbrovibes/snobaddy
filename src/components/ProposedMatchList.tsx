"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ProposedMatch } from "@/lib/db/proposed";

interface Props {
  sessionId: string;
  matches: ProposedMatch[];
  checkedInPlayers: any[];
}

export default function ProposedMatchList({ sessionId, matches, checkedInPlayers }: Props) {
  const [loading, setLoading] = useState(false);
  const [scoringId, setScoringId] = useState<string | null>(null);
  const [score1, setScore1] = useState("");
  const [score2, setScore2] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleSuggest() {
    setLoading(true);
    await fetch(`/api/sessions/${sessionId}/propose`, { method: "POST" });
    router.refresh();
    setLoading(false);
  }

  async function handleDelete(id: string) {
    await fetch(`/api/proposed-matches/${id}`, { method: "DELETE" });
    router.refresh();
  }

  function startScoring(id: string) {
    setScoringId(id);
    setScore1("");
    setScore2("");
    setError(null);
  }

  function cancelScoring() {
    setScoringId(null);
    setScore1("");
    setScore2("");
    setError(null);
  }

  async function handleSave(m: ProposedMatch) {
    const t1 = parseInt(score1);
    const t2 = parseInt(score2);
    if (isNaN(t1) || isNaN(t2)) { setError("Enter valid scores"); return; }
    if (t1 === t2) { setError("Scores can't be tied"); return; }

    setSaving(true);
    setError(null);

    const res = await fetch("/api/matches", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        session_id: sessionId,
        team1: [m.team1_player1_id, m.team1_player2_id],
        team2: [m.team2_player1_id, m.team2_player2_id],
        team1_score: t1,
        team2_score: t2,
      }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Failed to save");
      setSaving(false);
      return;
    }

    await fetch(`/api/proposed-matches/${m.id}`, { method: "DELETE" });
    setSaving(false);
    setScoringId(null);
    router.refresh();
  }

  if (matches.length === 0 && !loading) {
    return (
      <button
        onClick={handleSuggest}
        className="w-full py-3 bg-white border-2 border-dashed border-blue-200 text-blue-600 font-semibold rounded-xl hover:bg-blue-50 transition-colors flex items-center justify-center gap-2"
      >
        ✨ Generate Matches
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
          Proposed Matches · {matches.length}
        </h2>
        {matches.length < 4 && (
          <button
            onClick={handleSuggest}
            disabled={loading}
            className="text-xs text-blue-600 font-bold hover:underline"
          >
            {loading ? "Generating..." : "+ Add Matches"}
          </button>
        )}
      </div>

      <div className="flex flex-col gap-2">
        {matches.map((m) => {
          const isScoring = scoringId === m.id;
          return (
            <div key={m.id} className="bg-white border border-blue-50 rounded-xl p-3 shadow-sm">
              {/* Team names */}
              <div className="grid grid-cols-[1fr_2rem_1fr] items-center gap-1 text-base text-gray-800 mb-3">
                <div className="text-right">
                  {m.team1_names?.map((n, i) => (
                    <div key={i}>{n.split(" ")[0]}</div>
                  ))}
                </div>
                <div className="text-center text-gray-300 text-xs">vs</div>
                <div className="text-left">
                  {m.team2_names?.map((n, i) => (
                    <div key={i}>{n.split(" ")[0]}</div>
                  ))}
                </div>
              </div>

              {/* Inline score entry */}
              {isScoring && (
                <div className="mb-3">
                  <div className="grid grid-cols-[1fr_2rem_1fr] items-center gap-1">
                    <input
                      type="number"
                      inputMode="numeric"
                      min="0"
                      value={score1}
                      onChange={(e) => setScore1(e.target.value)}
                      placeholder="0"
                      className="w-full text-center text-xl font-bold text-gray-900 border-2 border-gray-200 rounded-xl py-2 focus:border-blue-400 outline-none"
                    />
                    <div className="text-center text-gray-300 text-xs">–</div>
                    <input
                      type="number"
                      inputMode="numeric"
                      min="0"
                      value={score2}
                      onChange={(e) => setScore2(e.target.value)}
                      placeholder="0"
                      className="w-full text-center text-xl font-bold text-gray-900 border-2 border-gray-200 rounded-xl py-2 focus:border-blue-400 outline-none"
                    />
                  </div>
                  {error && (
                    <p className="text-xs text-red-500 text-center mt-1">{error}</p>
                  )}
                </div>
              )}

              {/* Action buttons */}
              <div className="flex gap-2">
                {isScoring ? (
                  <>
                    <button
                      onClick={() => handleSave(m)}
                      disabled={saving}
                      className="flex-1 py-2 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                    >
                      {saving ? "Saving..." : "✅ Save"}
                    </button>
                    <button
                      onClick={cancelScoring}
                      disabled={saving}
                      className="flex-1 py-2 bg-gray-50 text-gray-500 text-xs font-bold rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50"
                    >
                      ✕ Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => startScoring(m.id)}
                      className="flex-1 py-2 bg-blue-50 text-blue-600 text-xs font-bold rounded-lg hover:bg-blue-100 transition-colors"
                    >
                      🏸 Record Score
                    </button>
                    <button
                      onClick={() => handleDelete(m.id)}
                      className="flex-1 py-2 bg-red-50 text-red-400 text-xs font-bold rounded-lg hover:bg-red-100 hover:text-red-500 transition-colors"
                    >
                      🗑️ Delete
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
