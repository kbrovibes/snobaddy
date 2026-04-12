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

// ─── Step nav buttons ────────────────────────────────────────────────────────
function StepNavButtons({
  onPrev,
  onNext,
  prevLabel,
  nextLabel,
  nextDisabled,
}: {
  onPrev?: () => void;
  onNext?: () => void;
  prevLabel?: string;
  nextLabel?: string;
  nextDisabled?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      {onPrev && (
        <button
          onClick={onPrev}
          className="px-4 py-2 text-sm font-medium text-stone-500 border border-stone-200 rounded-lg hover:bg-stone-50 transition-colors"
        >
          &lt; {prevLabel}
        </button>
      )}
      <div className="flex-1" />
      {onNext && (
        <button
          onClick={onNext}
          disabled={nextDisabled}
          className="px-5 py-2 text-sm font-semibold text-white bg-sky-600 rounded-lg hover:bg-sky-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {nextLabel} &gt;
        </button>
      )}
    </div>
  );
}

// ─── Workflow step indicator ─────────────────────────────────────────────────
// Each step is an SVG arrow shape: flat left for step 1, notched left for others,
// pointed right for non-last, flat right for last.
function StepIndicator({
  step,
  label,
  active,
  locked,
  done,
  isFirst,
  isLast,
  onClick,
}: {
  step: number;
  label: string;
  active: boolean;
  locked: boolean;
  done: boolean;
  isFirst: boolean;
  isLast: boolean;
  onClick: () => void;
}) {
  const fill = active
    ? "#1c1917"       // stone-900
    : done
    ? "#059669"       // emerald-600
    : locked
    ? "#e7e5e4"       // stone-200
    : "#f5f5f4";      // stone-100
  const textColor = active || done ? "text-white" : locked ? "text-stone-400" : "text-stone-600";
  const badgeClass = active
    ? "bg-white/20 text-white"
    : done
    ? "bg-white/25 text-white"
    : locked
    ? "bg-stone-300 text-stone-100"
    : "bg-stone-300/50 text-stone-500";

  // Arrow shape built as a closed polygon, clockwise from top-left.
  // viewBox = 200x40. Notch depth = 12 units.
  // First step: flat left. Others: notched left (V pointing right).
  // Last step: pointed right (arrow tip). Others: also pointed right.
  const N = 12; // notch/point depth
  const W = 200;
  const H = 40;
  const pts: string[] = [];
  // Top-left
  if (isFirst) {
    pts.push(`0,0`);
  } else {
    pts.push(`0,0`, `${N},${H / 2}`, `0,${H}`);
  }
  // Bottom-right
  pts.push(`${W - N},${H}`);
  // Right edge — always an arrow point
  pts.push(`${W},${H / 2}`);
  // Top-right
  pts.push(`${W - N},0`);
  const path = `M${pts.join(" L")} Z`;

  return (
    <button
      onClick={locked ? undefined : onClick}
      disabled={locked}
      className={`flex-1 relative h-10 ${locked ? "cursor-not-allowed" : "cursor-pointer"}`}
    >
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 200 40" preserveAspectRatio="none">
        <path d={path} fill={fill} />
      </svg>
      <div className={`relative z-10 flex items-center justify-center gap-1.5 h-full ${textColor}`}>
        <span className={`w-5 h-5 flex items-center justify-center rounded-full text-[11px] font-bold ${badgeClass}`}>
          {done && !active ? "✓" : step}
        </span>
        <span className="text-xs font-semibold">{locked ? `🔒 ${label}` : label}</span>
      </div>
    </button>
  );
}

// ─── Players tab ─────────────────────────────────────────────────────────────
function PlayersTab({
  eventId,
  eventStatus,
  allPlayers,
  participants,
  onNext,
}: {
  eventId: string;
  eventStatus: FinalsEvent["status"];
  allPlayers: PlayerStats[];
  participants: FinalsParticipant[];
  onNext: () => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState("");
  const [adding, setAdding] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const [autoAdding, setAutoAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isDraft = eventStatus === "draft";
  const isBreakdown = eventStatus === "breakdown_generated";
  const canEditPlayers = isDraft || isBreakdown;
  const participantIds = new Set(participants.map((p) => p.player_id));
  const [sortKey, setSortKey] = useState<"name" | "skill">("name");
  const [sortAsc, setSortAsc] = useState(true);

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

  // Sort
  const sorted = [...enriched].sort((a, b) => {
    const dir = sortAsc ? 1 : -1;
    if (sortKey === "name") return a.name.localeCompare(b.name) * dir;
    return (a.skill_level - b.skill_level) * dir;
  });

  function toggleSort(key: "name" | "skill") {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(key === "name"); }
  }

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
        {canEditPlayers && (
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

      {/* Status banner */}
      {isBreakdown && (
        <p className="text-xs text-amber-600 bg-amber-50 px-3 py-2 rounded-lg">
          Groups have been generated. You can still add or remove players — re-run the breakdown on the Groups tab afterwards.
        </p>
      )}
      {!canEditPlayers && (
        <p className="text-xs text-stone-400 bg-stone-50 px-3 py-2 rounded-lg">
          Player list is locked — groups have been confirmed and sessions created. To make changes, delete the finals sessions first.
        </p>
      )}

      {/* Add player search */}
      {canEditPlayers && (
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

      {/* Next step — top */}
      {sorted.length >= 4 && (
        <StepNavButtons onNext={onNext} nextLabel="Set Up Groups" />
      )}

      {/* Participant tiles */}
      {sorted.length === 0 ? (
        <div className="rounded-lg border border-dashed border-stone-200 px-4 py-8 text-center">
          <p className="text-sm text-stone-400">No players added yet.</p>
          <p className="text-xs text-stone-300 mt-1">
            Search above or tap &quot;Auto-add from season&quot;
          </p>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {sorted.map((p) => (
            <span
              key={p.player_id}
              className="inline-flex items-center gap-1 bg-stone-100 text-stone-700 text-sm font-medium px-3 py-1 rounded-full"
            >
              {p.name.split(" ")[0]}
              {canEditPlayers && (
                <button
                  onClick={() => removePlayer(p.player_id)}
                  disabled={removing === p.player_id || isPending}
                  className="text-[10px] text-stone-400 hover:text-red-500 disabled:opacity-40 leading-none ml-0.5"
                  title="Remove"
                >
                  ✕
                </button>
              )}
            </span>
          ))}
        </div>
      )}

      {/* Next step — bottom */}
      {sorted.length >= 4 && (
        <StepNavButtons onNext={onNext} nextLabel="Set Up Groups" />
      )}
    </div>
  );
}

// ─── Groups tab ───────────────────────────────────────────────────────────────
function GroupsTab({
  eventId,
  eventStatus,
  participants,
  onSwitchToPlayers,
  onConfirmed,
  canGoToSessions,
  onNext,
}: {
  eventId: string;
  eventStatus: FinalsEvent["status"];
  participants: FinalsParticipant[];
  onSwitchToPlayers: () => void;
  onConfirmed: () => void;
  canGoToSessions: boolean;
  onNext: () => void;
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

  // Sort by group (A, B, C) then by score descending within each group
  const sorted = [...participants].sort((a, b) => {
    const ga = a.group_label ?? "Z";
    const gb = b.group_label ?? "Z";
    if (ga !== gb) return ga.localeCompare(gb);
    return (b.finals_score ?? 0) - (a.finals_score ?? 0);
  });

  // Group counts
  const groupCounts: Record<string, number> = {};
  for (const p of sorted) {
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
      startTransition(() => { router.refresh(); onConfirmed(); });
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

  // nothing — table rendered inline below

  return (
    <div className="flex flex-col gap-3">
      {/* Step nav — top */}
      <StepNavButtons
        onPrev={onSwitchToPlayers}
        prevLabel="Players"
        onNext={canGoToSessions ? onNext : undefined}
        nextLabel="Sessions"
      />

      {/* Actions row */}
      {(eventStatus === "draft" || isBreakdownGenerated) && (
        <div className="flex gap-2">
          <button
            onClick={generateBreakdown}
            disabled={generating || isPending}
            className="flex-1 py-2.5 text-sm font-semibold bg-stone-900 text-white rounded-xl hover:bg-stone-700 disabled:opacity-50 transition-colors"
          >
            {generating
              ? "Generating…"
              : hasBreakdown
              ? "Re-run Breakdown"
              : "Generate Breakdown"}
          </button>
          {isBreakdownGenerated && (
            <button
              onClick={onSwitchToPlayers}
              className="px-4 py-2.5 text-sm font-medium text-stone-600 border border-stone-200 rounded-xl hover:bg-stone-50 transition-colors"
            >
              Edit Players
            </button>
          )}
        </div>
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

      {/* Unscored players warning */}
      {hasBreakdown && sorted.some((p) => p.finals_score === null) && (
        <p className="text-xs text-amber-600 bg-amber-50 px-3 py-2 rounded-lg">
          {sorted.filter((p) => p.finals_score === null).length} new player{sorted.filter((p) => p.finals_score === null).length !== 1 ? "s have" : " has"} no score yet. Tap "Re-run Breakdown" above to score and assign groups.
        </p>
      )}

      {/* Ranked table */}
      {hasBreakdown && sorted.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-100 bg-stone-50 text-[11px] text-stone-400 uppercase">
                <th className="text-left px-3 py-1.5 font-medium w-8">#</th>
                <th className="text-left px-2 py-1.5 font-medium">Player</th>
                <th className="text-center px-2 py-1.5 font-medium w-14">Skill</th>
                <th className="text-center px-2 py-1.5 font-medium w-14">Score</th>
                <th className="text-center px-2 py-1.5 font-medium w-12">Grp</th>
                <th className="w-6 px-1 py-1.5"></th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                let lastGroup: string | null = null;
                let rank = 0;
                return sorted.map((p) => {
                  const group = p.group_label;
                  const showDivider = group && group !== lastGroup;
                  if (showDivider) { lastGroup = group; rank = 0; }
                  rank++;
                  const isExpanded = expandedId === p.id;
                  const score = p.finals_score !== null ? p.finals_score.toFixed(1) : "—";
                  const count = group ? groupCounts[group] ?? 0 : 0;
                  const tooSmall = count < 4;

                  return (
                    <React.Fragment key={p.id}>
                      {showDivider && (
                        <tr className="bg-stone-50">
                          <td colSpan={6} className="px-3 py-1">
                            <div className="flex items-center justify-between">
                              <span className={`text-xs font-bold px-2 py-0.5 rounded border ${GROUP_COLORS[group!] ?? ""}`}>
                                Group {group}
                              </span>
                              <span className={`text-xs font-medium ${tooSmall ? "text-red-500" : "text-stone-400"}`}>
                                {count}{tooSmall ? " ⚠ min 4" : ""}
                              </span>
                            </div>
                          </td>
                        </tr>
                      )}
                      <tr className="border-b border-stone-100 last:border-0">
                        <td className="px-3 py-1.5 text-xs text-stone-400">{rank}</td>
                        <td className="px-2 py-1.5">
                          <div className="flex items-center gap-1.5">
                            <Link href={`/players/${p.player_id}`} className="text-sky-600 hover:underline truncate">
                              {p.name}
                            </Link>
                            {p.group_override && (
                              <span className="text-[9px] font-medium px-1 rounded bg-violet-100 text-violet-600">✎</span>
                            )}
                          </div>
                        </td>
                        <td className="text-center px-2 py-1.5"><SkillDots level={p.skill_level} /></td>
                        <td className="text-center px-2 py-1.5 text-xs text-stone-500">{score}</td>
                        <td className="text-center px-2 py-1.5">
                          {canEdit && group ? (
                            <select
                              value={group}
                              disabled={overriding === p.player_id || isPending}
                              onChange={(e) => overrideGroup(p.player_id, e.target.value)}
                              className={`text-[11px] font-semibold px-1 py-0 rounded border cursor-pointer disabled:opacity-40 ${GROUP_COLORS[group] ?? ""}`}
                            >
                              <option value="A">A</option>
                              <option value="B">B</option>
                              <option value="C">C</option>
                            </select>
                          ) : group ? (
                            <span className={`text-[11px] font-semibold px-1.5 rounded border ${GROUP_COLORS[group] ?? ""}`}>{group}</span>
                          ) : (
                            <span className="text-xs text-stone-300">—</span>
                          )}
                        </td>
                        <td className="px-1 py-1.5">
                          {p.score_explanation && (
                            <button onClick={() => setExpandedId(isExpanded ? null : p.id)} className="text-xs text-stone-400 hover:text-stone-600">
                              {isExpanded ? "▲" : "ℹ"}
                            </button>
                          )}
                        </td>
                      </tr>
                      {isExpanded && p.score_explanation && (
                        <tr>
                          <td colSpan={6} className="px-3 pb-1.5">
                            <p className="text-[11px] text-stone-500 bg-stone-50 rounded px-2 py-1.5 leading-relaxed">
                              {p.score_explanation}
                            </p>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                });
              })()}
            </tbody>
          </table>
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

      {/* Step nav — bottom */}
      <StepNavButtons
        onPrev={onSwitchToPlayers}
        prevLabel="Players"
        onNext={canGoToSessions ? onNext : undefined}
        nextLabel="Sessions"
      />
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
  onPrev,
}: {
  eventId: string;
  eventStatus: FinalsEvent["status"];
  sessionPair: FinalsSessionPair;
  onPrev: () => void;
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
      {/* Step nav — top */}
      <StepNavButtons onPrev={onPrev} prevLabel="Groups" />

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

      {/* Step nav — bottom */}
      <StepNavButtons onPrev={onPrev} prevLabel="Groups" />
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
  const [resetting, setResetting] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const canViewGroups = true; // Groups tab always accessible; generate-breakdown button handles state
  const canViewSessions =
    event.status !== "draft" && event.status !== "breakdown_generated";

  async function handleDelete() {
    if (!confirm("Delete this Finals Event and all its data? This cannot be undone.")) return;
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

  async function handleReset() {
    if (!confirm("Reset to draft? This will clear all groups, sessions, and matches. Players will stay in the pool.")) return;
    setResetting(true);
    const res = await fetch(`/api/finals/${event.id}/reset`, { method: "POST" });
    if (res.ok) {
      startTransition(() => { setTab("players"); router.refresh(); });
    } else {
      const json = await res.json();
      alert(json.error ?? "Could not reset");
    }
    setResetting(false);
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Step workflow indicator */}
      <div className="flex gap-1">
        <StepIndicator
          step={1}
          label="Players"
          active={tab === "players"}
          locked={false}
          done={participants.length > 0}
          isFirst={true}
          isLast={false}
          onClick={() => setTab("players")}
        />
        <StepIndicator
          step={2}
          label="Groups"
          active={tab === "groups"}
          locked={!canViewGroups}
          done={event.status !== "draft"}
          isFirst={false}
          isLast={false}
          onClick={() => setTab("groups")}
        />
        <StepIndicator
          step={3}
          label="Sessions"
          active={tab === "sessions"}
          locked={!canViewSessions}
          done={!!sessionPair.day1}
          isFirst={false}
          isLast={true}
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
          onNext={() => setTab("groups")}
        />
      )}

      {tab === "groups" && (
        <GroupsTab
          eventId={event.id}
          eventStatus={event.status}
          participants={participants}
          onSwitchToPlayers={() => setTab("players")}
          onConfirmed={() => setTab("sessions")}
          canGoToSessions={canViewSessions}
          onNext={() => setTab("sessions")}
        />
      )}

      {tab === "sessions" && canViewSessions && (
        <SessionsTab
          eventId={event.id}
          eventStatus={event.status}
          sessionPair={sessionPair}
          onPrev={() => setTab("groups")}
        />
      )}

      {/* Reset / Delete */}
      <div className="mt-2 flex flex-col gap-2">
        {event.status !== "draft" && (
          <button
            onClick={handleReset}
            disabled={resetting || deleting || isPending}
            className="w-full py-2.5 text-sm font-medium text-amber-500 hover:text-amber-700 border border-amber-200 hover:border-amber-300 rounded-xl transition-colors disabled:opacity-50"
          >
            {resetting ? "Resetting…" : "Reset to Draft (keep players)"}
          </button>
        )}
        <button
          onClick={handleDelete}
          disabled={deleting || resetting || isPending}
          className="w-full py-2.5 text-sm font-medium text-red-400 hover:text-red-600 border border-red-100 hover:border-red-300 rounded-xl transition-colors disabled:opacity-50"
        >
          {deleting ? "Deleting…" : "Delete Finals Event"}
        </button>
      </div>
    </div>
  );
}
