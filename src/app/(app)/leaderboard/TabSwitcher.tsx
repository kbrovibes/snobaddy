"use client";

import { useRouter } from "next/navigation";

export default function TabSwitcher({ activeTab }: { activeTab: "season" | "global" }) {
  const router = useRouter();

  return (
    <div className="flex gap-1 p-1 bg-surface-alt rounded-xl mb-4">
      <button
        onClick={() => router.push("/leaderboard")}
        className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
          activeTab === "season"
            ? "bg-surface text-heading shadow-sm"
            : "text-muted-light hover:text-text"
        }`}
      >
        Season
      </button>
      <button
        onClick={() => router.push("/leaderboard?tab=global")}
        className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
          activeTab === "global"
            ? "bg-surface text-heading shadow-sm"
            : "text-muted-light hover:text-text"
        }`}
      >
        All-Time
      </button>
    </div>
  );
}
