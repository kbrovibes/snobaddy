"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function GlobalRefreshButton() {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);

  async function handleRefresh() {
    const triggeredAt = new Date().toISOString();
    setRefreshing(true);
    try {
      await fetch("/api/leaderboard/global-refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ triggered_at: triggeredAt }),
      });
      router.refresh();
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <button
      onClick={handleRefresh}
      disabled={refreshing}
      className="text-xs text-sky-600 dark:text-sky-400 font-medium disabled:opacity-50"
    >
      {refreshing ? "Refreshing..." : "Refresh"}
    </button>
  );
}
