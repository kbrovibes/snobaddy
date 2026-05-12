"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function RegenerateUbrButton({ playerId }: { playerId: string }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleClick() {
    if (loading) return;
    setLoading(true);
    await fetch("/api/ubr/recalculate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ player_id: playerId }),
    });
    setLoading(false);
    router.refresh();
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="text-xs text-muted-light hover:text-text transition-colors disabled:opacity-40"
    >
      {loading ? "recalculating…" : "↺ regenerate"}
    </button>
  );
}
