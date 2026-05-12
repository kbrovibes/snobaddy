"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { SeasonStatus, SeasonSession } from "@/lib/db/seasons";

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
  sessions: SeasonSession[];
}

function formatShortDate(dateStr: string) {
  return new Date(dateStr + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function SessionLockRow({
  session,
  onSave,
}: {
  session: SeasonSession;
  onSave: (id: string, date: string | null) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [dateVal, setDateVal] = useState(session.stats_lock_date ?? "");
  const [saving, setSaving] = useState(false);

  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" });
  const isLocked = !!session.stats_lock_date && session.stats_lock_date < today;

  async function handleSave() {
    setSaving(true);
    await onSave(session.id, dateVal || null);
    setSaving(false);
    setEditing(false);
  }

  async function handleClear() {
    setSaving(true);
    await onSave(session.id, null);
    setDateVal("");
    setSaving(false);
    setEditing(false);
  }

  const statusDot =
    session.status === "active"
      ? "bg-green-500"
      : session.status === "completed"
      ? "bg-sky-400"
      : "bg-stone-400";

  return (
    <div className="flex items-center justify-between gap-2 py-1.5 border-b border-border-light/40 last:border-0 text-xs">
      <div className="flex items-center gap-2 min-w-0 shrink-0">
        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${statusDot}`} />
        <span className="text-text font-medium tabular-nums">{formatShortDate(session.date)}</span>
        {session.match_count > 0 && (
          <span className="text-muted-lighter">{session.match_count}m</span>
        )}
      </div>

      {editing ? (
        <div className="flex items-center gap-1 shrink-0">
          <input
            type="date"
            value={dateVal}
            onChange={(e) => setDateVal(e.target.value)}
            className="px-1.5 py-0.5 text-xs rounded border border-border bg-background text-text focus:outline-none focus:ring-1 focus:ring-sky-500 w-32"
          />
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-2 py-0.5 rounded bg-sky-600 text-white text-xs font-medium disabled:opacity-50"
          >
            {saving ? "…" : "Save"}
          </button>
          {session.stats_lock_date && (
            <button
              onClick={handleClear}
              disabled={saving}
              className="px-2 py-0.5 rounded bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-300 text-xs"
            >
              Clear
            </button>
          )}
          <button onClick={() => { setEditing(false); setDateVal(session.stats_lock_date ?? ""); }} className="text-muted-light hover:text-text px-1">
            ✕
          </button>
        </div>
      ) : session.stats_lock_date ? (
        <button
          onClick={() => setEditing(true)}
          className={`text-[11px] font-medium shrink-0 ${isLocked ? "text-amber-600 dark:text-amber-400" : "text-sky-600 dark:text-sky-400"}`}
          title={isLocked ? "Stats excluded from leaderboard" : "Stats will be locked after this date"}
        >
          🔒 {formatShortDate(session.stats_lock_date)}
        </button>
      ) : (
        <button
          onClick={() => setEditing(true)}
          className="text-[11px] text-muted-lighter hover:text-muted-light shrink-0"
        >
          set lock
        </button>
      )}
    </div>
  );
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
  const { id, name, start_date, end_date, status, session_count, player_count, match_count, finals_status, hasActiveSeason, sessions: propSessions } = props;
  const router = useRouter();
  const [expanded, setExpanded] = useState(status !== "completed");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(name);
  const [editStart, setEditStart] = useState(start_date);
  const [editEnd, setEditEnd] = useState(end_date);
  const [sessions, setSessions] = useState<SeasonSession[]>(propSessions);
  const [lockError, setLockError] = useState<string | null>(null);

  async function handleSetLockDate(sessionId: string, date: string | null) {
    setLockError(null);
    try {
      const res = await fetch(`/api/sessions/${sessionId}/stats-lock-date`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stats_lock_date: date }),
      });
      if (!res.ok) {
        const d = await res.json();
        setLockError(d.error ?? "Failed to save lock date");
        return;
      }
      setSessions((prev) => prev.map((s) => s.id === sessionId ? { ...s, stats_lock_date: date } : s));
    } catch {
      setLockError("Network error");
    }
  }

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
        body: JSON.stringify({ name: editName.trim(), start_date: editStart, end_date: editEnd }),
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
          <span className="font-bold text-heading text-sm">{name}</span>
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
              <div className="flex gap-2">
                <button
                  onClick={handleSaveEdit}
                  disabled={loading}
                  className="flex-1 py-1.5 rounded-lg text-xs font-bold bg-sky-600 text-white hover:bg-sky-700 disabled:opacity-50 transition-colors"
                >
                  {loading ? "Saving..." : "Save"}
                </button>
                <button
                  onClick={() => { setEditing(false); setEditName(name); setEditStart(start_date); setEditEnd(end_date); setError(null); }}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-muted-light hover:text-text transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <p className="text-xs text-muted-light">
                {formatDate(start_date)} – {formatDate(end_date)}
              </p>
              <button
                onClick={() => setEditing(true)}
                className="text-[10px] text-sky-600 dark:text-sky-400 hover:underline font-medium"
              >
                Edit
              </button>
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
                {finals_status}
              </span>
            </div>
          )}

          {/* Sessions list with stats lock-in date editing */}
          {sessions.length > 0 && (
            <div className="mt-1">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-lighter mb-1">Sessions · Stats lock</p>
              <div className="rounded-lg border border-border-light bg-background/50 px-3 py-1">
                {sessions.map((s) => (
                  <SessionLockRow key={s.id} session={s} onSave={handleSetLockDate} />
                ))}
              </div>
              {lockError && (
                <p className="text-xs text-red-600 dark:text-red-400 mt-1">{lockError}</p>
              )}
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
