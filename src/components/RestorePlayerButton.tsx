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
      className="text-xs px-3 py-1 rounded-lg bg-sky-50 dark:bg-sky-500/10 text-sky-600 border border-sky-100 hover:bg-sky-100 dark:bg-sky-500/15 transition-colors disabled:opacity-40 whitespace-nowrap"
    >
      {loading ? "…" : "Restore"}
    </button>
  );
}
