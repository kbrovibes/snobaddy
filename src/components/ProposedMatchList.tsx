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
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="text-sm font-medium text-gray-800 flex-1">
                {m.team1_names?.map((n) => n.split(" ")[0]).join(" & ")} <span className="text-gray-300 font-normal mx-1">vs</span> {m.team2_names?.map((n) => n.split(" ")[0]).join(" & ")}
              </div>
              <button
                onClick={() => handleDelete(m.id)}
                className="text-gray-300 hover:text-red-400 p-1"
                title="Delete Suggestion"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
            
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
        ))}
      </div>
    </div>
  );
}
