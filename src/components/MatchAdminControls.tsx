"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  matchId: string;
  team1Names: [string, string];
  team2Names: [string, string];
  team1Score: number;
  team2Score: number;
}

export default function MatchAdminControls({ matchId, team1Names, team2Names, team1Score, team2Score }: Props) {
  const [mode, setMode] = useState<"idle" | "editing" | "confirming-delete">("idle");
  const [s1, setS1] = useState(String(team1Score));
  const [s2, setS2] = useState(String(team2Score));
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  function enterEdit() {
    setS1(String(team1Score));
    setS2(String(team2Score));
    setMode("editing");
  }

  async function handleSave() {
    const t1 = parseInt(s1, 10);
    const t2 = parseInt(s2, 10);
    if (isNaN(t1) || isNaN(t2) || t1 < 0 || t2 < 0 || t1 === t2) return;
    setLoading(true);
    await fetch(`/api/matches/${matchId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ team1_score: t1, team2_score: t2 }),
    });
    router.refresh();
    setLoading(false);
    setMode("idle");
  }

  async function handleDelete() {
    setLoading(true);
    await fetch(`/api/matches/${matchId}`, { method: "DELETE" });
    router.refresh();
    setLoading(false);
    setMode("idle");
  }

  if (mode === "confirming-delete") {
    return (
      <div className="flex items-center gap-3 mt-1.5">
        <span className="text-xs text-red-600 font-medium">Delete this match?</span>
        <button
          onClick={handleDelete}
          disabled={loading}
          className="text-xs text-red-600 font-semibold underline disabled:opacity-50"
        >
          {loading ? "Deleting…" : "Yes, delete"}
        </button>
        <button onClick={() => setMode("idle")} className="text-xs text-gray-400">
          Cancel
        </button>
      </div>
    );
  }

  if (mode === "editing") {
    const t1 = parseInt(s1, 10);
    const t2 = parseInt(s2, 10);
    const valid = !isNaN(t1) && !isNaN(t2) && t1 >= 0 && t2 >= 0 && t1 !== t2;

    return (
      <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
        <span className="text-gray-500">{team1Names.join(" & ")}</span>
        <input
          type="number"
          value={s1}
          onChange={(e) => setS1(e.target.value)}
          className="w-10 border border-gray-300 rounded px-1.5 py-0.5 text-center text-gray-900 text-xs"
          min={0}
        />
        <span className="text-gray-300">–</span>
        <input
          type="number"
          value={s2}
          onChange={(e) => setS2(e.target.value)}
          className="w-10 border border-gray-300 rounded px-1.5 py-0.5 text-center text-gray-900 text-xs"
          min={0}
        />
        <span className="text-gray-500">{team2Names.join(" & ")}</span>
        <button
          onClick={handleSave}
          disabled={loading || !valid}
          className="text-sky-600 font-semibold underline disabled:opacity-40"
        >
          {loading ? "Saving…" : "Save"}
        </button>
        <button onClick={() => setMode("idle")} className="text-gray-400">
          Cancel
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 mt-1">
      <button onClick={enterEdit} className="text-xs text-sky-500 hover:underline">
        Edit scores
      </button>
      <button onClick={() => setMode("confirming-delete")} className="text-xs text-red-400 hover:underline">
        Delete
      </button>
    </div>
  );
}
