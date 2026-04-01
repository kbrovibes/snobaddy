"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ProposedMatch } from "@/lib/db/proposed";
import RecordMatchForm from "./RecordMatchForm";

interface Props {
  sessionId: string;
  matches: ProposedMatch[];
  checkedInPlayers: any[];
}

export default function ProposedMatchList({ sessionId, matches, checkedInPlayers }: Props) {
  const [loading, setLoading] = useState(false);
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
        {matches.map((m) => (
          <div key={m.id} className="bg-white border border-blue-50 rounded-xl p-3 shadow-sm">
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

            <div className="flex gap-2">
              <div className="flex-1">
                <RecordMatchForm
                  sessionId={sessionId}
                  checkedInPlayers={checkedInPlayers}
                  initialData={{
                    team1p1: m.team1_player1_id,
                    team1p2: m.team1_player2_id,
                    team2p1: m.team2_player1_id,
                    team2p2: m.team2_player2_id,
                    proposedMatchId: m.id
                  }}
                  label="🏸 Record Score"
                  variant="secondary"
                />
              </div>
              <button
                onClick={() => handleDelete(m.id)}
                className="flex-1 py-2 bg-red-50 text-red-400 text-xs font-bold rounded-lg hover:bg-red-100 hover:text-red-500 transition-colors"
              >
                🗑️ Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
