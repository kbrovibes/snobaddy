"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { SeasonStatus } from "@/lib/db/seasons";

interface SeasonCardProps {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  status: SeasonStatus;
  session_count: number;
  player_count: number;
  match_count: number;
  finals_status: string | null;
  hasActiveSeason: boolean;
}

const STATUS_CONFIG = {
  active: { label: "Active", emoji: "🟢", badgeClass: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400" },
  upcoming: { label: "Upcoming", emoji: "⏳", badgeClass: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400" },
  completed: { label: "Completed", emoji: "✅", badgeClass: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-400" },
};

function formatDate(dateStr: string) {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function SeasonCard(props: SeasonCardProps) {
  const { id, name, start_date, end_date, status, session_count, player_count, match_count, finals_status, hasActiveSeason } = props;
  const router = useRouter();
  const [expanded, setExpanded] = useState(status !== "completed");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const config = STATUS_CONFIG[status];

  async function handleStatusChange(newStatus: SeasonStatus) {
    const messages: Record<string, string> = {
      completed: `Close "${name}"? The leaderboard and session list will no longer show this season.`,
      active: `${status === "completed" ? "Reopen" : "Start"} "${name}"? This will become the active season.`,
    };
    if (!window.confirm(messages[newStatus] ?? `Change status to ${newStatus}?`)) return;

    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/seasons/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Failed to update");
        return;
      }
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className={`bg-surface border border-border-light rounded-xl overflow-hidden transition-all ${
        status === "completed" && !expanded ? "opacity-70" : ""
      }`}
    >
      {/* Header — always visible */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <span className="text-lg">{config.emoji}</span>
          <span className="font-bold text-heading text-sm">{name}</span>
        </div>
        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${config.badgeClass}`}>
          {config.label}
        </span>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="px-4 pb-4 pt-0 space-y-3">
          <p className="text-xs text-muted-light">
            {formatDate(start_date)} – {formatDate(end_date)}
          </p>

          {/* Stats row */}
          {(status === "active" || status === "completed") && (session_count > 0 || match_count > 0) && (
            <div className="flex gap-4 text-xs text-muted-light">
              <span><span className="font-bold text-heading">{player_count}</span> players</span>
              <span><span className="font-bold text-heading">{match_count}</span> matches</span>
              <span><span className="font-bold text-heading">{session_count}</span> sessions</span>
            </div>
          )}

          {finals_status && (
            <div className="text-xs text-muted-light">
              Finals: <span className={`font-bold ${finals_status === "completed" ? "text-green-600 dark:text-green-400" : "text-orange-600 dark:text-orange-400"}`}>
                {finals_status}
              </span>
            </div>
          )}

          {error && (
            <p className="text-xs text-red-600 dark:text-red-400 font-medium">{error}</p>
          )}

          {/* Action buttons */}
          <div className="flex gap-2">
            {status === "active" && (
              <button
                onClick={() => handleStatusChange("completed")}
                disabled={loading}
                className="flex-1 py-2 rounded-lg text-xs font-bold bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800 disabled:opacity-50 transition-colors"
              >
                {loading ? "Closing..." : "Close Season"}
              </button>
            )}
            {status === "upcoming" && (
              <button
                onClick={() => handleStatusChange("active")}
                disabled={loading || hasActiveSeason}
                className="flex-1 py-2 rounded-lg text-xs font-bold bg-sky-50 text-sky-600 border border-sky-200 hover:bg-sky-100 dark:bg-sky-900/30 dark:text-sky-400 dark:border-sky-800 disabled:opacity-50 transition-colors"
                title={hasActiveSeason ? "Close the current season first" : undefined}
              >
                {loading ? "Starting..." : "Start Season"}
              </button>
            )}
            {status === "completed" && (
              <button
                onClick={() => handleStatusChange("active")}
                disabled={loading || hasActiveSeason}
                className="flex-1 py-2 rounded-lg text-xs font-bold bg-stone-50 text-stone-600 border border-stone-200 hover:bg-stone-100 dark:bg-stone-900/30 dark:text-stone-400 dark:border-stone-800 disabled:opacity-50 transition-colors"
                title={hasActiveSeason ? "Close the current season first" : undefined}
              >
                {loading ? "Reopening..." : "Reopen Season"}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
