"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function RefreshButton() {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await fetch("/api/leaderboard/refresh", { method: "POST" });
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
