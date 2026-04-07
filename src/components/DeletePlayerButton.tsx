"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function DeletePlayerButton({
  playerId,
  playerName,
}: {
  playerId: string;
  playerName: string;
}) {
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleDelete() {
    setLoading(true);
    await fetch(`/api/players/${playerId}/delete`, { method: "POST" });
    setLoading(false);
    router.refresh();
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-1 flex-wrap">
        <span className="text-[10px] text-stone-500 leading-tight">Remove {playerName}?</span>
        <button
          onClick={handleDelete}
          disabled={loading}
          className="text-[10px] px-2 py-0.5 rounded bg-red-500 text-white font-medium hover:bg-red-600 disabled:opacity-40"
        >
          {loading ? "…" : "Confirm"}
        </button>
        <button
          onClick={() => setConfirming(false)}
          className="text-[10px] px-2 py-0.5 rounded bg-stone-100 text-stone-600 hover:bg-stone-200"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="w-full text-xs py-1 rounded-lg bg-stone-50 text-red-400 border border-stone-100 hover:bg-red-50 hover:text-red-600 transition-colors"
      title={`Remove ${playerName}`}
    >
      🗑 Remove
    </button>
  );
}
