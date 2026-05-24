"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { SeasonStatus } from "@/lib/db/seasons";
import GenerateNewsletterButton from "@/components/GenerateNewsletterButton";

interface SeasonCardProps {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  status: SeasonStatus;
  stats_lock_date: string | null;
  session_count: number;
  player_count: number;
  match_count: number;
  finals_status: string | null;
  hasActiveSeason: boolean;
  has_newsletter: boolean;
}

function formatShortDate(dateStr: string) {
  return new Date(dateStr + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
}


const STATUS_CONFIG = {
  active: { label: "Active", emoji: "🟢", badgeClass: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400" },
  upcoming: { label: "Upcoming", emoji: "⏳", badgeClass: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400" },
  completed: { label: "Completed", emoji: "✅", badgeClass: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-400" },
};

const FINALS_STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  breakdown_generated: "Groups Ready",
  sessions_created: "Sessions Set",
  active: "In Progress",
  completed: "Completed",
};

function formatDate(dateStr: string) {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function SeasonCard(props: SeasonCardProps) {
  const { id, name, start_date, end_date, status, stats_lock_date, session_count, player_count, match_count, finals_status, hasActiveSeason, has_newsletter } = props;
  const router = useRouter();
  const [expanded, setExpanded] = useState(status !== "completed");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(name);
  const [editStart, setEditStart] = useState(start_date);
  const [editEnd, setEditEnd] = useState(end_date);
  const [editLockDate, setEditLockDate] = useState(stats_lock_date ?? "");

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

  async function handleSaveEdit() {
    if (!editName.trim()) { setError("Name is required"); return; }
    if (editEnd <= editStart) { setError("End date must be after start date"); return; }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/seasons/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName.trim(), start_date: editStart, end_date: editEnd, stats_lock_date: editLockDate || null }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Failed to save");
        return;
      }
      setEditing(false);
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
          <span className="font-bold text-heading text-base">{name}</span>
        </div>
        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${config.badgeClass}`}>
          {config.label}
        </span>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="px-4 pb-4 pt-0 space-y-3">
          {editing ? (
            <div className="space-y-2">
              <div>
                <label className="block text-[10px] font-medium text-muted-light mb-1">Name</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-2 py-1.5 text-xs rounded-lg border border-border bg-background text-text focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-medium text-muted-light mb-1">Start</label>
                  <input
                    type="date"
                    value={editStart}
                    onChange={(e) => setEditStart(e.target.value)}
                    className="w-full px-2 py-1.5 text-xs rounded-lg border border-border bg-background text-text focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-muted-light mb-1">End</label>
                  <input
                    type="date"
                    value={editEnd}
                    onChange={(e) => setEditEnd(e.target.value)}
                    className="w-full px-2 py-1.5 text-xs rounded-lg border border-border bg-background text-text focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-medium text-muted-light mb-1">Lock date <span className="text-muted-lighter font-normal">(sessions after this date excluded from leaderboard)</span></label>
                <input
                  type="date"
                  value={editLockDate}
                  onChange={(e) => setEditLockDate(e.target.value)}
                  className="w-full px-2 py-1.5 text-xs rounded-lg border border-border bg-background text-text focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleSaveEdit}
                  disabled={loading}
                  className="flex-1 py-1.5 rounded-lg text-xs font-bold bg-sky-600 text-white hover:bg-sky-700 disabled:opacity-50 transition-colors"
                >
                  {loading ? "Saving..." : "Save"}
                </button>
                <button
                  onClick={() => { setEditing(false); setEditName(name); setEditStart(start_date); setEditEnd(end_date); setEditLockDate(stats_lock_date ?? ""); setError(null); }}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-muted-light hover:text-text transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs text-muted-light">
                  {formatDate(start_date)} – {formatDate(end_date)}
                  {stats_lock_date && <span className="ml-1.5 text-amber-600 dark:text-amber-400">· 🔒 {formatDate(stats_lock_date)}</span>}
                </p>
                <button
                  onClick={() => setEditing(true)}
                  className="text-[10px] text-sky-600 dark:text-sky-400 hover:underline font-medium mt-0.5"
                >
                  Edit
                </button>
              </div>
              {status === "active" && (
                <button
                  onClick={() => handleStatusChange("completed")}
                  disabled={loading}
                  className="flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800 disabled:opacity-50 transition-colors"
                >
                  {loading ? "Closing…" : "Close Season"}
                </button>
              )}
              {status === "upcoming" && (
                <button
                  onClick={() => handleStatusChange("active")}
                  disabled={loading || hasActiveSeason}
                  className="flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold bg-sky-50 text-sky-600 border border-sky-200 hover:bg-sky-100 dark:bg-sky-900/30 dark:text-sky-400 dark:border-sky-800 disabled:opacity-50 transition-colors"
                  title={hasActiveSeason ? "Close the current season first" : undefined}
                >
                  {loading ? "Starting…" : "Start Season"}
                </button>
              )}
              {status === "completed" && (
                <button
                  onClick={() => handleStatusChange("active")}
                  disabled={loading || hasActiveSeason}
                  className="flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold bg-stone-50 text-stone-600 border border-stone-200 hover:bg-stone-100 dark:bg-stone-900/30 dark:text-stone-400 dark:border-stone-800 disabled:opacity-50 transition-colors"
                  title={hasActiveSeason ? "Close the current season first" : undefined}
                >
                  {loading ? "Reopening…" : "Reopen Season"}
                </button>
              )}
            </div>
          )}

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
                {FINALS_STATUS_LABELS[finals_status] ?? finals_status}
              </span>
            </div>
          )}

          <Link
            href={`/seasons/${id}`}
            className="inline-flex items-center gap-1 text-xs font-medium text-sky-600 dark:text-sky-400 hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            View Season Summary →
          </Link>

          {error && (
            <p className="text-xs text-red-600 dark:text-red-400 font-medium">{error}</p>
          )}

          {/* Newsletter — only surfaced after a season's stats lock date has passed.
              If the date is set + past + no row yet → Generate button.
              If the row exists → link into the viewer.
              Otherwise (no lock date, or lock date still in the future) → nothing. */}
          {(() => {
            if (!stats_lock_date) return null;
            const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" });
            const lockInPast = stats_lock_date <= today;
            if (!lockInPast) return null;
            if (has_newsletter) {
              return (
                <Link
                  href={`/admin/seasons/${id}/newsletter`}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-sky-600 dark:text-sky-400 hover:underline"
                >
                  📰 Season newsletter →
                </Link>
              );
            }
            return <GenerateNewsletterButton seasonId={id} />;
          })()}
        </div>
      )}
    </div>
  );
}
