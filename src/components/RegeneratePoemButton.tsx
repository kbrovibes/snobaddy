"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function RegeneratePoemButton({ playerId }: { playerId: string }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleClick() {
    if (loading) return;
    setLoading(true);
    await fetch(`/api/players/${playerId}/regenerate-poem`, { method: "POST" });
    setLoading(false);
    router.refresh();
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="text-xs text-stone-400 hover:text-stone-600 transition-colors disabled:opacity-40"
    >
      {loading ? "writing…" : "↺ regenerate"}
    </button>
  );
}
