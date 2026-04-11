"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { FinalsEvent, FinalsParticipant, FinalsSessionPair, FinalsSessionInfo } from "@/lib/db/finals";
import type { PlayerStats } from "@/lib/db/players";

const GROUP_COLORS: Record<string, string> = {
  A: "bg-sky-100 text-sky-700 border-sky-200",
  B: "bg-amber-100 text-amber-700 border-amber-200",
  C: "bg-stone-100 text-stone-600 border-stone-200",
};

type Tab = "players" | "groups" | "sessions";

// ─── Skill dots ──────────────────────────────────────────────────────────────
function SkillDots({ level }: { level: number }) {
  return (
    <span className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <span
          key={i}
          className={`w-1.5 h-1.5 rounded-full ${i <= level ? "bg-stone-700" : "bg-stone-200"}`}
        />
      ))}
    </span>
  );
}

// ─── Tab button ──────────────────────────────────────────────────────────────
function TabButton({
  label,
  active,
  locked,
  onClick,
}: {
  label: string;
  active: boolean;
  locked: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={locked ? undefined : onClick}
      disabled={locked}
      className={[
        "flex-1 py-2 text-sm font-semibold rounded-lg transition-colors",
        active
          ? "bg-stone-900 text-white"
          : locked
          ? "text-stone-300 cursor-not-allowed"
          : "text-stone-500 hover:text-stone-800",
      ].join(" ")}
    >
      {locked ? `🔒 ${label}` : label}
    </button>
  );
}

// ─── Players tab ─────────────────────────────────────────────────────────────
function PlayersTab({
  eventId,
  eventStatus,
  allPlayers,
  participants,
}: {
  eventId: string;
  eventStatus: FinalsEvent["status"];
  allPlayers: PlayerStats[];
  participants: FinalsParticipant[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState("");
  const [adding, setAdding] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const [autoAdding, setAutoAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isDraft = eventStatus === "draft";
  const participantIds = new Set(participants.map((p) => p.player_id));

  // Build a stats lookup from allPlayers
  const statsById = new Map(allPlayers.map((p) => [p.id, p]));

  // Players available to add (not yet in pool)
  const available = allPlayers.filter(
    (p) => !participantIds.has(p.id) &&
      (search === "" || p.name.toLowerCase().includes(search.toLowerCase()))
  );

  // Enrich participants with current season stats
  const enriched = participants.map((p) => {
    const stats = statsById.get(p.player_id);
    const wins = stats?.wins ?? 0;
    const losses = stats?.losses ?? 0;
    const total = wins + losses;
    const wr = total > 0 ? Math.round((wins / total) * 100) : null;
    return { ...p, wins, losses, wr };
  });

  async function addPlayer(playerId: string) {
    setAdding(playerId);
    setError(null);
    const res = await fetch(`/api/finals/${eventId}/participants`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ player_id: playerId }),
    });
    if (!res.ok) {
      const json = await res.json();
      setError(json.error ?? "Failed to add player");
    } else {
      setSearch("");
      startTransition(() => router.refresh());
    }
    setAdding(null);
  }

  async function removePlayer(playerId: string) {
    setRemoving(playerId);
    setError(null);
    const res = await fetch(`/api/finals/${eventId}/participants/${playerId}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const json = await res.json();
      setError(json.error ?? "Failed to remove player");
    } else {
      startTransition(() => router.refresh());
    }
    setRemoving(null);
  }

  async function autoAdd() {
    setAutoAdding(true);
    setError(null);
    const res = await fetch(`/api/finals/${eventId}/auto-add`, { method: "POST" });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? "Failed to auto-add");
    } else {
      startTransition(() => router.refresh());
    }
    setAutoAdding(false);
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-stone-700">
          {participants.length} player{participants.length !== 1 ? "s" : ""} in pool
        </p>
        {isDraft && (
          <button
            onClick={autoAdd}
            disabled={autoAdding || isPending}
            className="text-xs font-medium text-sky-600 hover:text-sky-800 disabled:opacity-40"
          >
            {autoAdding ? "Adding…" : "Auto-add from season"}
          </button>
        )}
      </div>

      {error && (
        <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
      )}

      {/* Add player search (draft only) */}
      {isDraft && (
        <div className="flex flex-col gap-1">
          <input
            type="text"
            placeholder="Search player to add…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-stone-300 bg-white"
          />
          {search.length > 0 && (
            <div className="bg-white border border-stone-200 rounded-lg shadow-sm overflow-hidden max-h-48 overflow-y-auto">
              {available.length === 0 ? (
                <p className="px-3 py-2 text-xs text-stone-400">No players found</p>
              ) : (
                available.slice(0, 10).map((p) => {
                  const total = p.wins + p.losses;
                  const wr = total > 0 ? Math.round((p.wins / total) * 100) : null;
                  return (
                    <button
                      key={p.id}
                      onClick={() => addPlayer(p.id)}
                      disabled={adding === p.id || isPending}
                      className="w-full flex items-center justify-between px-3 py-2 hover:bg-stone-50 active:bg-sky-50 transition-colors border-b border-stone-100 last:border-0 disabled:opacity-40"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-stone-800">{p.name}</span>
                        <SkillDots level={p.skill_level} />
                      </div>
                      <span className="text-xs text-stone-400">
                        {wr !== null ? `${wr}% WR` : "No data"}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          )}
        </div>
      )}

      {/* Participant list */}
      {enriched.length === 0 ? (
        <div className="rounded-lg border border-dashed border-stone-200 px-4 py-8 text-center">
          <p className="text-sm text-stone-400">No players added yet.</p>
          <p className="text-xs text-stone-300 mt-1">
            Search above or tap "Auto-add from season"
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          {enriched.map((p) => (
            <div
              key={p.player_id}
              className="flex items-center justify-between px-4 py-3 border-b border-stone-100 last:border-0"
            >
              <div className="flex items-center gap-2">
                <span className="text-sm text-stone-800">{p.name}</span>
                <SkillDots level={p.skill_level} />
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-stone-400">
                  {p.wins}W–{p.losses}L
                  {p.wr !== null && (
                    <span className="ml-1 text-stone-500">{p.wr}%</span>
                  )}
                </span>
                {isDraft && (
                  <button
                    onClick={() => removePlayer(p.player_id)}
                    disabled={removing === p.player_id || isPending}
                    className="text-xs text-red-400 hover:text-red-600 disabled:opacity-40"
                  >
                    {removing === p.player_id ? "…" : "Remove"}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Groups tab ───────────────────────────────────────────────────────────────
function GroupsTab({
  eventId,
  eventStatus,
  participants,
}: {
  eventId: string;
  eventStatus: FinalsEvent["status"];
  participants: FinalsParticipant[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [generating, setGenerating] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [overriding, setOverriding] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  const isBreakdownGenerated = eventStatus === "breakdown_generated";
  const canEdit = isBreakdownGenerated;
  const hasBreakdown = participants.some((p) => p.finals_score !== null);

  // Group counts
  const groupCounts: Record<string, number> = {};
  for (const p of participants) {
    if (p.group_label) groupCounts[p.group_label] = (groupCounts[p.group_label] ?? 0) + 1;
  }
  const smallGroups = Object.entries(groupCounts).filter(([, c]) => c < 4).map(([g]) => g);

  async function generateBreakdown() {
    setGenerating(true);
    setError(null);
    const res = await fetch(`/api/finals/${eventId}/generate-breakdown`, { method: "POST" });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? "Failed to generate breakdown");
    } else {
      startTransition(() => router.refresh());
    }
    setGenerating(false);
  }

  async function confirmBreakdown() {
    setConfirming(true);
    setConfirmError(null);
    const res = await fetch(`/api/finals/${eventId}/confirm-breakdown`, { method: "POST" });
    const json = await res.json();
    if (!res.ok) {
      setConfirmError(json.error ?? "Could not confirm groups");
    } else {
      startTransition(() => router.refresh());
    }
    setConfirming(false);
  }

  async function overrideGroup(playerId: string, group: string) {
    setOverriding(playerId);
    setError(null);
    const res = await fetch(`/api/finals/${eventId}/participants/${playerId}/group`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ group_label: group }),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? "Failed to update group");
    } else {
      startTransition(() => router.refresh());
    }
    setOverriding(null);
  }

  // Render the ranked list, inserting group dividers
  function renderParticipantRows() {
    const rows: React.ReactNode[] = [];
    let lastGroup: string | null = null;

    participants.forEach((p, idx) => {
      const group = p.group_label;

      // Group divider
      if (group && group !== lastGroup) {
        const count = groupCounts[group] ?? 0;
        const tooSmall = count < 4;
        rows.push(
          <div
            key={`divider-${group}`}
            className="flex items-center justify-between px-4 py-1.5 bg-stone-50 border-b border-stone-100"
          >
            <span className={`text-xs font-bold px-2 py-0.5 rounded border ${GROUP_COLORS[group] ?? "bg-stone-100 text-stone-600"}`}>
              Group {group}
            </span>
            <span className={`text-xs font-medium ${tooSmall ? "text-red-500" : "text-stone-400"}`}>
              {count} player{count !== 1 ? "s" : ""}
              {tooSmall && " ⚠ min 4"}
            </span>
          </div>
        );
        lastGroup = group;
      }

      const isExpanded = expandedId === p.id;
      const score = p.finals_score !== null ? p.finals_score.toFixed(1) : "—";
      const wr = p.season_win_rate !== null ? `${Math.round(p.season_win_rate)}%` : "—";

      rows.push(
        <div key={p.id} className="border-b border-stone-100 last:border-0">
          <div className="flex items-center gap-2 px-4 py-3">
            {/* Rank */}
            <span className="w-6 text-right text-xs text-stone-400 flex-shrink-0">{idx + 1}</span>

            {/* Name + skill + override badge */}
            <div className="flex-1 min-w-0 flex items-center gap-1.5 flex-wrap">
              <span className="text-sm text-stone-800 truncate">{p.name}</span>
              <SkillDots level={p.skill_level} />
              {p.group_override && (
                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-violet-100 text-violet-600 border border-violet-200">
                  override
                </span>
              )}
            </div>

            {/* Stats */}
            <div className="flex items-center gap-3 flex-shrink-0">
              <span className="text-xs text-stone-400 hidden sm:block">WR {wr}</span>
              <span className="text-xs font-semibold text-stone-600 w-10 text-right">{score}</span>

              {/* Group selector or badge */}
              {canEdit && group ? (
                <select
                  value={group}
                  disabled={overriding === p.player_id || isPending}
                  onChange={(e) => overrideGroup(p.player_id, e.target.value)}
                  className={`text-xs font-semibold px-1.5 py-0.5 rounded border cursor-pointer disabled:opacity-40 ${GROUP_COLORS[group] ?? ""}`}
                >
                  <option value="A">A</option>
                  <option value="B">B</option>
                  <option value="C">C</option>
                </select>
              ) : group ? (
                <span className={`text-xs font-semibold px-2 py-0.5 rounded border ${GROUP_COLORS[group] ?? ""}`}>
                  {group}
                </span>
              ) : (
                <span className="text-xs text-stone-300 w-10 text-right">—</span>
              )}

              {/* Info toggle */}
              {p.score_explanation && (
                <button
                  onClick={() => setExpandedId(isExpanded ? null : p.id)}
                  className="text-xs text-stone-400 hover:text-stone-600"
                  title="Score explanation"
                >
                  {isExpanded ? "▲" : "ℹ"}
                </button>
              )}
            </div>
          </div>

          {/* Expanded explanation */}
          {isExpanded && p.score_explanation && (
            <div className="px-4 pb-3 pt-0">
              <p className="text-xs text-stone-500 bg-stone-50 rounded-lg px-3 py-2 leading-relaxed">
                {p.score_explanation}
              </p>
              {p.season_wins !== null && (
                <p className="text-xs text-stone-400 mt-1 px-1">
                  {p.season_wins}W – {p.season_losses}L · Skill {p.skill_level} · Finals score {score}
                </p>
              )}
            </div>
          )}
        </div>
      );
    });

    return rows;
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Generate / Re-run button */}
      {(eventStatus === "draft" || isBreakdownGenerated) && (
        <button
          onClick={generateBreakdown}
          disabled={generating || isPending}
          className="w-full py-2.5 text-sm font-semibold bg-stone-900 text-white rounded-xl hover:bg-stone-700 disabled:opacity-50 transition-colors"
        >
          {generating
            ? "Generating…"
            : hasBreakdown
            ? "Re-run Breakdown"
            : "Generate Breakdown"}
        </button>
      )}

      {error && (
        <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
      )}

      {/* No breakdown yet */}
      {!hasBreakdown && (
        <div className="rounded-lg border border-dashed border-stone-200 px-4 py-8 text-center">
          <p className="text-sm text-stone-400">No breakdown generated yet.</p>
          <p className="text-xs text-stone-300 mt-1">
            Click "Generate Breakdown" to score and assign groups.
          </p>
        </div>
      )}

      {/* Ranked table */}
      {hasBreakdown && participants.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          {/* Column header */}
          <div className="flex items-center gap-2 px-4 py-2 border-b border-stone-100 bg-stone-50">
            <span className="w-6 flex-shrink-0" />
            <span className="flex-1 text-[11px] font-medium text-stone-400">Player</span>
            <span className="text-[11px] font-medium text-stone-400 hidden sm:block w-14 text-right">WR%</span>
            <span className="text-[11px] font-medium text-stone-400 w-10 text-right">Score</span>
            <span className="text-[11px] font-medium text-stone-400 w-10 text-center">Group</span>
            <span className="w-4 flex-shrink-0" />
          </div>
          {renderParticipantRows()}
        </div>
      )}

      {/* Group size summary */}
      {hasBreakdown && Object.keys(groupCounts).length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {["A", "B", "C"].filter((g) => groupCounts[g]).map((g) => (
            <span
              key={g}
              className={`text-xs px-2.5 py-1 rounded-lg border font-medium ${GROUP_COLORS[g]}`}
            >
              Group {g}: {groupCounts[g]}
            </span>
          ))}
        </div>
      )}

      {/* Small group warnings */}
      {smallGroups.length > 0 && (
        <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-lg">
          Group{smallGroups.length > 1 ? "s" : ""} {smallGroups.join(", ")} need at least 4 players before you can confirm.
        </p>
      )}

      {/* Confirm groups button */}
      {isBreakdownGenerated && (
        <div className="flex flex-col gap-1">
          {confirmError && (
            <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-lg">{confirmError}</p>
          )}
          <button
            onClick={confirmBreakdown}
            disabled={confirming || isPending || smallGroups.length > 0}
            className="w-full py-2.5 text-sm font-semibold bg-green-700 text-white rounded-xl hover:bg-green-600 disabled:opacity-40 transition-colors"
          >
            {confirming ? "Confirming…" : "Confirm Groups → Proceed to Sessions"}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Sessions tab ─────────────────────────────────────────────────────────────
function SessionCard({
  label,
  subtitle,
  session,
}: {
  label: string;
  subtitle: string;
  session: FinalsSessionInfo | null;
}) {
  if (!session) return null;

  const statusInfo = {
    pending: { text: "Starting soon", cls: "text-orange-600 bg-orange-50" },
    active:  { text: "In Progress",   cls: "text-white bg-sky-700" },
    completed: { text: "Completed",   cls: "text-teal-600 bg-teal-50" },
  }[session.status];

  const formattedDate = new Date(session.date + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "short", month: "short", day: "numeric",
  });

  return (
    <Link
      href={`/session/${session.id}`}
      className="flex items-center justify-between px-4 py-3 bg-white rounded-xl shadow-sm hover:bg-stone-50 active:bg-amber-50 transition-colors"
    >
      <div>
        <p className="text-sm font-semibold text-stone-800">{label}</p>
        <p className="text-xs text-stone-400">{subtitle} · {formattedDate}</p>
      </div>
      <div className="flex items-center gap-2">
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statusInfo.cls}`}>
          {statusInfo.text}
        </span>
        <span className="text-stone-300 text-sm">→</span>
      </div>
    </Link>
  );
}

function SessionsTab({
  eventId,
  eventStatus,
  sessionPair,
}: {
  eventId: string;
  eventStatus: FinalsEvent["status"];
  sessionPair: FinalsSessionPair;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [generating, setGenerating] = useState(false);
  const [day1Date, setDay1Date] = useState("");
  const [day2Date, setDay2Date] = useState("");
  const [error, setError] = useState<string | null>(null);

  const sessionsExist = !!sessionPair.day1;

  async function generateSessions() {
    if (!day1Date || !day2Date) {
      setError("Please select both dates.");
      return;
    }
    setGenerating(true);
    setError(null);
    const res = await fetch(`/api/finals/${eventId}/generate-sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ day1_date: day1Date, day2_date: day2Date }),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? "Failed to generate sessions");
    } else {
      startTransition(() => router.refresh());
    }
    setGenerating(false);
  }

  return (
    <div className="flex flex-col gap-3">
      {sessionsExist ? (
        <>
          <SessionCard
            label="Finals Day 1 — Groups A & B"
            subtitle="Day 1"
            session={sessionPair.day1}
          />
          <SessionCard
            label="Finals Day 2 — Group C"
            subtitle="Day 2"
            session={sessionPair.day2}
          />
          <p className="text-xs text-stone-400 text-center mt-1">
            Sessions are set. Open each session page to start play.
          </p>
        </>
      ) : (
        <>
          <div className="bg-white rounded-xl shadow-sm p-4 flex flex-col gap-3">
            <p className="text-sm font-semibold text-stone-700">Schedule Finals Days</p>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-stone-500">
                Day 1 — Groups A & B
              </label>
              <input
                type="date"
                value={day1Date}
                onChange={(e) => setDay1Date(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-stone-300 bg-white"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-stone-500">
                Day 2 — Group C
              </label>
              <input
                type="date"
                value={day2Date}
                onChange={(e) => setDay2Date(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-stone-300 bg-white"
              />
            </div>
          </div>

          {error && (
            <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
          )}

          <button
            onClick={generateSessions}
            disabled={generating || isPending || !day1Date || !day2Date}
            className="w-full py-2.5 text-sm font-semibold bg-stone-900 text-white rounded-xl hover:bg-stone-700 disabled:opacity-40 transition-colors"
          >
            {generating ? "Creating sessions…" : "Generate Finals Sessions"}
          </button>
        </>
      )}
    </div>
  );
}

// ─── Main tabs component ──────────────────────────────────────────────────────
export default function FinalsEventTabs({
  event,
  allPlayers,
  participants,
  sessionPair,
}: {
  event: FinalsEvent;
  allPlayers: PlayerStats[];
  participants: FinalsParticipant[];
  sessionPair: FinalsSessionPair;
}) {
  const [tab, setTab] = useState<Tab>("players");
  const [deleting, setDeleting] = useState(false);
  const router = useRouter();

  const canViewGroups = true; // Groups tab always accessible; generate-breakdown button handles state
  const canViewSessions =
    event.status !== "draft" && event.status !== "breakdown_generated";

  async function handleDelete() {
    if (!confirm("Delete this Finals Event? This cannot be undone.")) return;
    setDeleting(true);
    const res = await fetch(`/api/finals/${event.id}`, { method: "DELETE" });
    if (res.ok) {
      router.push("/?list=1");
    } else {
      const json = await res.json();
      alert(json.error ?? "Could not delete");
      setDeleting(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Tab bar */}
      <div className="flex gap-1 bg-stone-100 p-1 rounded-xl">
        <TabButton
          label="Players"
          active={tab === "players"}
          locked={false}
          onClick={() => setTab("players")}
        />
        <TabButton
          label="Groups"
          active={tab === "groups"}
          locked={!canViewGroups}
          onClick={() => setTab("groups")}
        />
        <TabButton
          label="Sessions"
          active={tab === "sessions"}
          locked={!canViewSessions}
          onClick={() => setTab("sessions")}
        />
      </div>

      {/* Tab content */}
      {tab === "players" && (
        <PlayersTab
          eventId={event.id}
          eventStatus={event.status}
          allPlayers={allPlayers}
          participants={participants}
        />
      )}

      {tab === "groups" && (
        <GroupsTab
          eventId={event.id}
          eventStatus={event.status}
          participants={participants}
        />
      )}

      {tab === "sessions" && canViewSessions && (
        <SessionsTab
          eventId={event.id}
          eventStatus={event.status}
          sessionPair={sessionPair}
        />
      )}

      {/* Delete draft */}
      {event.status === "draft" && (
        <div className="mt-2">
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="w-full py-2.5 text-sm font-medium text-red-400 hover:text-red-600 border border-red-100 hover:border-red-300 rounded-xl transition-colors disabled:opacity-50"
          >
            {deleting ? "Deleting…" : "Delete Finals Event"}
          </button>
        </div>
      )}
    </div>
  );
}
