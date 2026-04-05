"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function RestorePlayerButton({ playerId }: { playerId: string }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleRestore() {
    setLoading(true);
    await fetch(`/api/players/${playerId}/restore`, { method: "POST" });
    setLoading(false);
    router.refresh();
  }

  return (
    <button
      onClick={handleRestore}
      disabled={loading}
      className="text-xs px-3 py-1 rounded-lg bg-blue-50 text-blue-600 border border-blue-100 hover:bg-blue-100 transition-colors disabled:opacity-40 whitespace-nowrap"
    >
      {loading ? "…" : "Restore"}
    </button>
  );
}
