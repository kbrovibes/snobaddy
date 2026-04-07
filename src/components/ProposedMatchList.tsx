"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ProposedMatch } from "@/lib/db/proposed";
import { buildNameMap, shortName } from "@/lib/display-name";

interface Props {
  sessionId: string;
  matches: ProposedMatch[];
  checkedInPlayers: any[];
  isAdmin: boolean;
  autoGenerate: boolean;
}

export default function ProposedMatchList({ sessionId, matches, checkedInPlayers, isAdmin, autoGenerate }: Props) {
  const nameMap = buildNameMap(checkedInPlayers.map((p: any) => p.name));
  const [loading, setLoading] = useState(false);
  const [togglingAuto, setTogglingAuto] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [scoringId, setScoringId] = useState<string | null>(null);
  const [score1, setScore1] = useState("");
  const [score2, setScore2] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function toggleAutoGenerate() {
    setTogglingAuto(true);
    await fetch(`/api/sessions/${sessionId}/auto-generate`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ auto_generate_matches: !autoGenerate }),
    });
    router.refresh();
    setTogglingAuto(false);
  }

  async function handleSuggest() {
    setLoading(true);
    await fetch(`/api/sessions/${sessionId}/propose`, { method: "POST" });
    router.refresh();
    setLoading(false);
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    await fetch(`/api/proposed-matches/${id}`, { method: "DELETE" });
    router.refresh();
    setDeletingId(null);
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
        <div className="flex items-center gap-3">
          {isAdmin && (
            <button
              onClick={toggleAutoGenerate}
              disabled={togglingAuto}
              className={`text-xs font-medium transition-colors ${
                autoGenerate
                  ? "text-blue-600 hover:text-blue-800"
                  : "text-gray-400 hover:text-gray-600"
              }`}
              title={autoGenerate ? "Auto-generate is on — tap to disable" : "Auto-generate is off — tap to enable"}
            >
              {togglingAuto ? "..." : autoGenerate ? "⚡ Auto" : "⚡ Auto off"}
            </button>
          )}
          {matches.length < 4 && (
            <button
              onClick={handleSuggest}
              disabled={loading}
              className="text-xs text-blue-600 font-bold hover:underline"
            >
              {loading ? "Generating..." : "✨ Generate Matches"}
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {matches.map((m) => {
          const isScoring = scoringId === m.id;
          return (
            <div key={m.id} className="bg-white border border-blue-50 rounded-xl px-3 py-2 shadow-sm">
              {/* Team names — inline, centred "vs" */}
              <div className="grid grid-cols-[1fr_2rem_1fr] items-center gap-1 mb-1.5">
                <p className="text-xs font-semibold text-gray-800 text-right truncate">
                  {m.team1_names?.map((n) => shortName(n, nameMap)).join(" & ")}
                </p>
                <p className="text-center text-gray-300 text-xs">vs</p>
                <p className="text-xs font-semibold text-gray-800 text-left truncate">
                  {m.team2_names?.map((n) => shortName(n, nameMap)).join(" & ")}
                </p>
              </div>

              {/* Inline score entry */}
              {isScoring && (
                <div className="mb-2">
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
                      className="flex-1 py-1 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                    >
                      {saving ? "Saving..." : "✅ Save"}
                    </button>
                    <button
                      onClick={cancelScoring}
                      disabled={saving}
                      className="flex-1 py-1 bg-gray-50 text-gray-500 text-xs font-bold rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50"
                    >
                      ✕ Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => startScoring(m.id)}
                      className="flex-1 py-1 bg-blue-50 text-blue-600 text-xs font-bold rounded-lg hover:bg-blue-100 transition-colors"
                    >
                      🏸 Record Score
                    </button>
                    <button
                      onClick={() => handleDelete(m.id)}
                      disabled={deletingId === m.id}
                      className="flex-1 py-1 bg-red-50 text-red-400 text-xs font-bold rounded-lg hover:bg-red-100 hover:text-red-500 transition-colors disabled:opacity-50"
                    >
                      {deletingId === m.id ? "Deleting..." : "🗑️ Delete"}
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
