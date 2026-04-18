"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import NavLink from "@/components/NavLink";
import { useNavigationLoader } from "@/components/NavigationLoader";
import {
  DndContext,
  DragOverlay,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useDroppable } from "@dnd-kit/core";
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

// ─── Workflow step arrows ────────────────────────────────────────────────────
function WorkflowSteps({
  steps,
  activeTab,
  onSelect,
}: {
  steps: { key: string; label: string; step: number; locked: boolean; done: boolean }[];
  activeTab: string;
  onSelect: (key: string) => void;
}) {
  const activeIndex = steps.findIndex((s) => s.key === activeTab);

  return (
    <div className="flex gap-1">
      {steps.map((s, i) => {
        const isActive = s.key === activeTab;
        const isFirst = i === 0;
        const isLast = i === steps.length - 1;
        const isDoneBefore = s.done && i < activeIndex;  // completed step before current
        const isDoneAfter = s.done && i > activeIndex;   // completed step after current

        // Active = sky blue, done-before = solid green, done-after = light green, else outline
        const fill = isActive
          ? "#0284c7"    // sky-600
          : isDoneBefore
          ? "#059669"    // emerald-600
          : "#fafaf9";   // page bg (done-after, unlocked, locked)
        const stroke = isActive || isDoneBefore
          ? "none"
          : isDoneAfter
          ? "#10b981"    // emerald-500
          : s.locked
          ? "#d6d3d1"    // stone-300
          : "#a8a29e";   // stone-400
        const strokeDash = s.locked ? "6,4" : isDoneAfter ? "6,4" : "";
        const textCls = isActive || isDoneBefore
          ? "text-white"
          : isDoneAfter
          ? "text-emerald-600"
          : s.locked
          ? "text-stone-400"
          : "text-stone-600";
        const badgeCls = isActive
          ? "bg-white/20 text-white"
          : isDoneBefore
          ? "bg-white/25 text-white"
          : isDoneAfter
          ? "bg-emerald-100 text-emerald-600"
          : s.locked
          ? "bg-stone-200 text-stone-400"
          : "bg-stone-200 text-stone-500";

        // SVG arrow path
        // Flat left for first, notched for others. Arrow point on right for all.
        const W = 200;
        const H = 40;
        const N = 14;
        let d: string;
        if (isFirst) {
          // flat left, arrow right
          d = `M0,0 L${W - N},0 L${W},${H / 2} L${W - N},${H} L0,${H} Z`;
        } else {
          // notched left, arrow right
          d = `M0,0 L${N},${H / 2} L0,${H} L${W - N},${H} L${W},${H / 2} L${W - N},0 Z`;
        }

        return (
          <button
            key={s.key}
            onClick={s.locked ? undefined : () => onSelect(s.key)}
            disabled={s.locked}
            className={`flex-1 relative h-10 ${s.locked ? "cursor-not-allowed" : "cursor-pointer"}`}
          >
            <svg className="absolute inset-0 w-full h-full" viewBox={`-1 -1 ${W + 2} ${H + 2}`} preserveAspectRatio="none">
              <path d={d} fill={fill} stroke={stroke} strokeWidth={stroke === "none" ? 0 : 1} strokeDasharray={strokeDash || undefined} vectorEffect="non-scaling-stroke" />
            </svg>
            <div className={`relative z-10 flex items-center justify-center gap-1.5 h-full ${textCls}`}>
              <span className={`w-5 h-5 flex items-center justify-center rounded-full text-[11px] font-bold ${badgeCls}`}>
                {s.done && !isActive ? "\u2713" : s.step}
              </span>
              <span className="text-xs font-semibold">
                {s.locked ? "\uD83D\uDD12 " : ""}{s.label}
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}

// ─── Players tab ─────────────────────────────────────────────────────────────
function PlayersTab({
  eventId,
  eventStatus,
  allPlayers,
  participants,
  onGoToGroups,
}: {
  eventId: string;
  eventStatus: FinalsEvent["status"];
  allPlayers: PlayerStats[];
  participants: FinalsParticipant[];
  onGoToGroups?: () => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const isDraft = eventStatus === "draft";
  const isBreakdown = eventStatus === "breakdown_generated";
  const canEditPlayers = isDraft || isBreakdown;

  // Saved set = what's persisted in DB
  const savedIds = new Set(participants.map((p) => p.player_id));

  // Auto-seed: players with at least 1 match this season
  const seasonPlayerIds = allPlayers.filter((p) => p.wins + p.losses > 0).map((p) => p.id);
  const initialIds = savedIds.size > 0 ? savedIds : new Set(seasonPlayerIds);

  const [localIds, setLocalIds] = useState<Set<string>>(initialIds);
  const [editing, setEditing] = useState(savedIds.size === 0 && canEditPlayers);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");

  // Detect unsaved changes
  const hasChanges = localIds.size !== savedIds.size ||
    [...localIds].some((id) => !savedIds.has(id)) ||
    [...savedIds].some((id) => !localIds.has(id));

  // Player lookup
  const playerById = new Map(allPlayers.map((p) => [p.id, p]));

  // Local player list sorted by name
  const localPlayers = [...localIds]
    .map((id) => playerById.get(id))
    .filter(Boolean)
    .sort((a, b) => a!.name.localeCompare(b!.name)) as PlayerStats[];

  // Available to add (not in local set, matching search)
  const available = allPlayers.filter(
    (p) => !localIds.has(p.id) &&
      (search === "" || p.name.toLowerCase().includes(search.toLowerCase()))
  );

  function addPlayer(playerId: string) {
    setLocalIds((prev) => new Set([...prev, playerId]));
    setSearch("");
  }

  function removePlayer(playerId: string) {
    setLocalIds((prev) => {
      const next = new Set(prev);
      next.delete(playerId);
      return next;
    });
  }

  function addAllSeason() {
    setLocalIds((prev) => new Set([...prev, ...seasonPlayerIds]));
  }

  async function save() {
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/finals/${eventId}/participants/sync`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ player_ids: [...localIds] }),
    });
    if (!res.ok) {
      const json = await res.json();
      setError(json.error ?? "Failed to save");
    } else {
      setEditing(false);
      startTransition(() => router.refresh());
    }
    setSaving(false);
  }

  function cancelEdit() {
    setLocalIds(savedIds);
    setEditing(false);
    setSearch("");
    setError(null);
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-stone-700">
          {localIds.size} player{localIds.size !== 1 ? "s" : ""} in pool
          {hasChanges && editing && <span className="text-amber-500 ml-1 text-xs font-normal">(unsaved)</span>}
        </p>
        {canEditPlayers && !editing && (
          <button
            onClick={() => setEditing(true)}
            className="text-xs font-semibold text-sky-600 hover:text-sky-800 px-3 py-1 border border-sky-200 rounded-lg hover:bg-sky-50 transition-colors"
          >
            Edit
          </button>
        )}
      </div>

      {error && (
        <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
      )}

      {/* Status banner */}
      {isBreakdown && editing && (
        <p className="text-xs text-amber-600 bg-amber-50 px-3 py-2 rounded-lg">
          Groups have been generated. After saving changes, re-run the breakdown on the Groups tab.
        </p>
      )}
      {!canEditPlayers && (
        <p className="text-xs text-stone-400 bg-stone-50 px-3 py-2 rounded-lg">
          Player list is locked — groups have been confirmed and sessions created. To make changes, delete the finals sessions first.
        </p>
      )}

      {/* Add player search — only when editing */}
      {editing && (
        <>
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
                  available.slice(0, 10).map((p) => (
                    <button
                      key={p.id}
                      onClick={() => addPlayer(p.id)}
                      className="w-full flex items-center px-3 py-2 hover:bg-stone-50 active:bg-sky-50 transition-colors border-b border-stone-100 last:border-0"
                    >
                      <span className="text-sm text-stone-800">{p.name}</span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
          {seasonPlayerIds.some((id) => !localIds.has(id)) && (
            <button
              onClick={addAllSeason}
              className="text-xs font-medium text-sky-600 hover:text-sky-800 self-start"
            >
              + Add all season players
            </button>
          )}
        </>
      )}

      {/* Player pills */}
      {localPlayers.length === 0 ? (
        <div className="rounded-lg border border-dashed border-stone-200 px-4 py-8 text-center">
          <p className="text-sm text-stone-400">No players added yet.</p>
          <p className="text-xs text-stone-300 mt-1">Search above to add players</p>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {localPlayers.map((p) => (
            <span
              key={p.id}
              className="inline-flex items-center gap-1 bg-stone-100 text-stone-700 text-sm font-medium px-3 py-1 rounded-full"
            >
              {p.name.split(" ")[0]}
              {editing && (
                <button
                  onClick={() => removePlayer(p.id)}
                  className="text-[10px] text-stone-400 hover:text-red-500 leading-none ml-0.5"
                  title="Remove"
                >
                  ✕
                </button>
              )}
            </span>
          ))}
        </div>
      )}

      {/* Save / Cancel buttons */}
      {editing && (
        <div className="flex gap-2">
          <button
            onClick={save}
            disabled={saving || isPending || (!hasChanges && savedIds.size > 0)}
            className="flex-1 py-2.5 text-sm font-semibold text-white bg-sky-600 rounded-xl hover:bg-sky-700 disabled:opacity-40 transition-colors"
          >
            {saving ? "Saving…" : hasChanges ? `Save ${localIds.size} Players` : "Saved"}
          </button>
          {savedIds.size > 0 && (
            <button
              onClick={cancelEdit}
              disabled={saving}
              className="px-4 py-2.5 text-sm font-medium text-stone-500 border border-stone-200 rounded-xl hover:bg-stone-50 transition-colors"
            >
              Cancel
            </button>
          )}
        </div>
      )}

      {/* Next step nudge */}
      {!editing && savedIds.size > 0 && isDraft && onGoToGroups && (
        <button
          onClick={onGoToGroups}
          className="w-full py-2.5 text-sm font-semibold text-sky-600 border border-sky-200 rounded-xl hover:bg-sky-50 transition-colors"
        >
          Next: Set Up Groups →
        </button>
      )}
    </div>
  );
}

// ─── Drag handle icon ────────────────────────────────────────────────────────
function DragHandle({ listeners, attributes }: { listeners?: Record<string, Function>; attributes?: Record<string, any> }) {
  return (
    <button
      className="touch-none flex flex-col items-center justify-center w-6 h-8 cursor-grab active:cursor-grabbing text-stone-300 hover:text-stone-500 -ml-1"
      {...attributes}
      {...listeners}
    >
      <svg width="10" height="16" viewBox="0 0 10 16" fill="currentColor">
        <circle cx="2.5" cy="2" r="1.2" /><circle cx="7.5" cy="2" r="1.2" />
        <circle cx="2.5" cy="6" r="1.2" /><circle cx="7.5" cy="6" r="1.2" />
        <circle cx="2.5" cy="10" r="1.2" /><circle cx="7.5" cy="10" r="1.2" />
        <circle cx="2.5" cy="14" r="1.2" /><circle cx="7.5" cy="14" r="1.2" />
      </svg>
    </button>
  );
}

// ─── Draggable player row ────────────────────────────────────────────────────
function DraggablePlayerRow({
  participant: p,
  rank,
  canEdit,
  overriding,
  isPending,
  expandedId,
  setExpandedId,
  overrideGroup,
  groupCounts,
}: {
  participant: FinalsParticipant;
  rank: number;
  canEdit: boolean;
  overriding: string | null;
  isPending: boolean;
  expandedId: string | null;
  setExpandedId: (id: string | null) => void;
  overrideGroup: (playerId: string, group: string) => void;
  groupCounts: Record<string, number>;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: p.id,
    disabled: !canEdit,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
  };
  const group = p.group_label;
  const score = p.finals_score !== null ? p.finals_score.toFixed(1) : "—";
  const isExpanded = expandedId === p.id;

  return (
    <div ref={setNodeRef} style={style}>
      <div className="flex items-center gap-0 border-b border-stone-100 last:border-0">
        {canEdit && (
          <DragHandle listeners={listeners} attributes={attributes} />
        )}
        <div className={`flex-1 flex items-center gap-0 py-1.5 ${canEdit ? "pl-0" : "pl-3"}`}>
          <span className="text-xs text-stone-400 w-6 text-center shrink-0">{rank}</span>
          <div className="flex-1 min-w-0 px-1">
            <div className="flex items-center gap-1.5">
              <NavLink href={`/players/${p.player_id}`} className="text-sm text-sky-600 hover:underline truncate">
                {p.name}
              </NavLink>
              {p.group_override && (
                <span className="text-[9px] font-medium px-1 rounded bg-violet-100 text-violet-600">✎</span>
              )}
            </div>
          </div>
          <div className="w-12 text-center shrink-0"><SkillDots level={p.skill_level} /></div>
          <span className="w-10 text-center text-xs text-stone-500 shrink-0">{score}</span>
          <div className="w-10 text-center shrink-0">
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
          </div>
          <div className="w-6 text-center shrink-0">
            {p.score_explanation && (
              <button onClick={() => setExpandedId(isExpanded ? null : p.id)} className="text-xs text-stone-400 hover:text-stone-600">
                {isExpanded ? "▾" : "▸"}
              </button>
            )}
          </div>
        </div>
      </div>
      {isExpanded && p.score_explanation && (
        <div className="px-3 pb-1.5">
          <p className="text-[11px] text-stone-500 bg-stone-50 rounded px-2 py-1.5 leading-relaxed">
            {p.score_explanation}
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Droppable group container ───────────────────────────────────────────────
function DroppableGroup({
  groupLabel,
  participants,
  canEdit,
  overriding,
  isPending,
  expandedId,
  setExpandedId,
  overrideGroup,
  groupCounts,
  isHighlighted,
}: {
  groupLabel: string;
  participants: FinalsParticipant[];
  canEdit: boolean;
  overriding: string | null;
  isPending: boolean;
  expandedId: string | null;
  setExpandedId: (id: string | null) => void;
  overrideGroup: (playerId: string, group: string) => void;
  groupCounts: Record<string, number>;
  isHighlighted?: boolean;
}) {
  const { setNodeRef } = useDroppable({ id: `group-${groupLabel}` });
  const count = groupCounts[groupLabel] ?? 0;
  const tooSmall = count < 4;

  return (
    <div
      ref={setNodeRef}
      className={`bg-white rounded-xl shadow-sm overflow-hidden transition-all duration-150 ${isHighlighted ? "ring-2 ring-sky-400 shadow-md bg-sky-50/30" : ""}`}
    >
      {/* Group header */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-stone-50 border-b border-stone-100">
        <span className={`text-xs font-bold px-2 py-0.5 rounded border ${GROUP_COLORS[groupLabel] ?? ""}`}>
          Group {groupLabel}
        </span>
        <span className={`text-xs font-medium ${tooSmall ? "text-red-500" : "text-stone-400"}`}>
          {count}{tooSmall ? " ⚠ min 4" : ""}
        </span>
      </div>
      {/* Column headers */}
      <div className={`flex items-center gap-0 text-[11px] text-stone-400 uppercase border-b border-stone-100 ${canEdit ? "pl-6" : "pl-3"}`}>
        <span className="w-6 text-center shrink-0">#</span>
        <span className="flex-1 px-1">Player</span>
        <span className="w-12 text-center shrink-0">Skill</span>
        <span className="w-10 text-center shrink-0">Score</span>
        <span className="w-10 text-center shrink-0">Grp</span>
        <span className="w-6 shrink-0"></span>
      </div>
      {/* Player rows */}
      <SortableContext items={participants.map((p) => p.id)} strategy={verticalListSortingStrategy}>
        {participants.length === 0 ? (
          <div className="px-3 py-4 text-center text-xs text-stone-300">
            Drop players here
          </div>
        ) : (
          participants.map((p, i) => (
            <DraggablePlayerRow
              key={p.id}
              participant={p}
              rank={i + 1}
              canEdit={canEdit}
              overriding={overriding}
              isPending={isPending}
              expandedId={expandedId}
              setExpandedId={setExpandedId}
              overrideGroup={overrideGroup}
              groupCounts={groupCounts}
            />
          ))
        )}
      </SortableContext>
    </div>
  );
}

// ─── Drag overlay (what you see while dragging) ──────────────────────────────
function DragOverlayRow({ participant: p }: { participant: FinalsParticipant }) {
  const group = p.group_label;
  return (
    <div className="bg-white rounded-lg shadow-lg border border-stone-200 px-3 py-2 flex items-center gap-2 opacity-95">
      <span className="text-sm font-medium text-stone-800">{p.name}</span>
      {group && (
        <span className={`text-[11px] font-semibold px-1.5 rounded border ${GROUP_COLORS[group] ?? ""}`}>{group}</span>
      )}
    </div>
  );
}

// ─── Groups drag-and-drop wrapper ────────────────────────────────────────────
function GroupsDragDrop({
  sorted,
  groupCounts,
  canEdit,
  overriding,
  isPending,
  expandedId,
  setExpandedId,
  overrideGroup,
}: {
  sorted: FinalsParticipant[];
  groupCounts: Record<string, number>;
  canEdit: boolean;
  overriding: string | null;
  isPending: boolean;
  expandedId: string | null;
  setExpandedId: (id: string | null) => void;
  overrideGroup: (playerId: string, group: string) => void;
}) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overGroupLabel, setOverGroupLabel] = useState<string | null>(null);
  const activeParticipant = activeId ? sorted.find((p) => p.id === activeId) : null;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
  );

  // Split participants by group
  const groups = ["A", "B", "C"];
  const byGroup: Record<string, FinalsParticipant[]> = {};
  for (const g of groups) {
    byGroup[g] = sorted.filter((p) => p.group_label === g);
  }

  // Resolve which group an over target belongs to
  function resolveGroup(overId: string | number): string | null {
    if (typeof overId === "string" && overId.startsWith("group-")) {
      return overId.replace("group-", "");
    }
    const targetPlayer = sorted.find((p) => p.id === overId);
    return targetPlayer?.group_label ?? null;
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as string);
  }

  function handleDragOver(event: DragOverEvent) {
    const { over } = event;
    if (!over) { setOverGroupLabel(null); return; }
    const group = resolveGroup(over.id);
    // Only highlight if dragging to a different group
    const activePlayer = sorted.find((p) => p.id === event.active.id);
    if (group && activePlayer && group !== activePlayer.group_label) {
      setOverGroupLabel(group);
    } else {
      setOverGroupLabel(null);
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    setOverGroupLabel(null);
    const { active, over } = event;
    if (!over) return;

    const player = sorted.find((p) => p.id === active.id);
    if (!player) return;

    const targetGroup = resolveGroup(over.id);
    if (targetGroup && targetGroup !== player.group_label) {
      overrideGroup(player.player_id, targetGroup);
    }
  }

  if (!canEdit) {
    // Read-only: render without DndContext
    return (
      <div className="flex flex-col gap-3">
        {groups.filter((g) => byGroup[g].length > 0).map((g) => (
          <DroppableGroup
            key={g}
            groupLabel={g}
            participants={byGroup[g]}
            canEdit={false}
            overriding={overriding}
            isPending={isPending}
            expandedId={expandedId}
            setExpandedId={setExpandedId}
            overrideGroup={overrideGroup}
            groupCounts={groupCounts}
          />
        ))}
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="flex flex-col gap-3">
        {groups.filter((g) => byGroup[g].length > 0).map((g) => (
          <DroppableGroup
            key={g}
            groupLabel={g}
            participants={byGroup[g]}
            canEdit={canEdit}
            overriding={overriding}
            isPending={isPending}
            expandedId={expandedId}
            setExpandedId={setExpandedId}
            overrideGroup={overrideGroup}
            groupCounts={groupCounts}
            isHighlighted={overGroupLabel === g}
          />
        ))}
      </div>
      <DragOverlay>
        {activeParticipant ? <DragOverlayRow participant={activeParticipant} /> : null}
      </DragOverlay>
    </DndContext>
  );
}

// ─── Groups tab ───────────────────────────────────────────────────────────────
function GroupsTab({
  eventId,
  eventStatus,
  participants,
  onSwitchToPlayers,
  onConfirmed,
}: {
  eventId: string;
  eventStatus: FinalsEvent["status"];
  participants: FinalsParticipant[];
  onSwitchToPlayers: () => void;
  onConfirmed: () => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [generating, setGenerating] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  // Local group overrides — key: participant id, value: new group label
  const [localOverrides, setLocalOverrides] = useState<Record<string, string>>({});
  const hasUnsavedChanges = Object.keys(localOverrides).length > 0;

  const isBreakdownGenerated = eventStatus === "breakdown_generated";
  const isLocked = eventStatus === "sessions_created" || eventStatus === "active";
  const canEdit = isBreakdownGenerated;
  const hasBreakdown = participants.some((p) => p.finals_score !== null);

  // Apply local overrides to participants
  const effective = participants.map((p) => {
    const override = localOverrides[p.id];
    if (override) return { ...p, group_label: override, group_override: true };
    return p;
  });

  // Sort by group (A, B, C) then by score descending within each group
  const sorted = [...effective].sort((a, b) => {
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
    setLocalOverrides({});
    const res = await fetch(`/api/finals/${eventId}/generate-breakdown`, { method: "POST" });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? "Failed to generate breakdown");
    } else {
      startTransition(() => router.refresh());
    }
    setGenerating(false);
  }

  // Save all pending overrides then confirm
  async function confirmBreakdown() {
    setConfirming(true);
    setConfirmError(null);

    // Persist any local overrides first
    if (hasUnsavedChanges) {
      for (const [participantId, groupLabel] of Object.entries(localOverrides)) {
        const p = participants.find((pp) => pp.id === participantId);
        if (!p) continue;
        const res = await fetch(`/api/finals/${eventId}/participants/${p.player_id}/group`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ group_label: groupLabel }),
        });
        if (!res.ok) {
          const json = await res.json();
          setConfirmError(json.error ?? "Failed to save group changes");
          setConfirming(false);
          return;
        }
      }
      setLocalOverrides({});
    }

    const res = await fetch(`/api/finals/${eventId}/confirm-breakdown`, { method: "POST" });
    const json = await res.json();
    if (!res.ok) {
      setConfirmError(json.error ?? "Could not confirm groups");
    } else {
      startTransition(() => { router.refresh(); onConfirmed(); });
    }
    setConfirming(false);
  }

  function localOverrideGroup(playerId: string, group: string) {
    // Find the participant by player_id to get the row id
    const p = effective.find((pp) => pp.player_id === playerId);
    if (!p) return;
    // If moving back to original group, remove the override
    const original = participants.find((pp) => pp.id === p.id);
    if (original && original.group_label === group) {
      setLocalOverrides((prev) => {
        const next = { ...prev };
        delete next[p.id];
        return next;
      });
    } else {
      setLocalOverrides((prev) => ({ ...prev, [p.id]: group }));
    }
  }

  async function unlockGroups() {
    if (!confirm("This will delete the generated finals sessions so you can re-edit groups. Continue?")) return;
    setUnlocking(true);
    setError(null);
    const res = await fetch(`/api/finals/${eventId}/unlock-groups`, { method: "POST" });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? "Failed to unlock groups");
    } else {
      startTransition(() => router.refresh());
    }
    setUnlocking(false);
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Edit Groups button (when locked but not completed) */}
      {isLocked && (
        <button
          onClick={unlockGroups}
          disabled={unlocking || isPending}
          className="w-full py-2.5 text-sm font-semibold text-amber-700 border border-amber-300 bg-amber-50 rounded-xl hover:bg-amber-100 disabled:opacity-50 transition-colors"
        >
          {unlocking ? "Unlocking…" : "Edit Groups"}
        </button>
      )}

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

      {/* Score legend */}
      {hasBreakdown && (
        <p className="text-[11px] text-stone-400 px-1">
          Score = weighted blend of season win rate, match count, and skill level. Tap ▸ on a player to see their breakdown.
        </p>
      )}

      {/* Unsaved changes banner (top) */}
      {hasUnsavedChanges && hasBreakdown && (
        <p className="text-xs text-violet-600 bg-violet-50 px-3 py-2 rounded-lg">
          Unsaved group changes — confirm below to save.
        </p>
      )}

      {/* Group cards with drag-and-drop */}
      {hasBreakdown && sorted.length > 0 && (
        <GroupsDragDrop
          sorted={sorted}
          groupCounts={groupCounts}
          canEdit={canEdit}
          overriding={null}
          isPending={isPending}
          expandedId={expandedId}
          setExpandedId={setExpandedId}
          overrideGroup={localOverrideGroup}
        />
      )}

      {/* Group size summary + format preview */}
      {hasBreakdown && Object.keys(groupCounts).length > 0 && (
        <div className="flex flex-col gap-2">
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
          <div className="bg-stone-50 rounded-lg px-3 py-2 flex flex-col gap-1">
            <p className="text-[11px] font-semibold text-stone-500 uppercase">Supported Formats</p>
            {["A", "B", "C"].filter((g) => groupCounts[g]).map((g) => {
              const c = groupCounts[g];
              const isGroupOf4 = c === 4;
              const validMpp: number[] = [];
              for (let m = 2; m <= Math.min(c, 12); m++) {
                if ((m * c) % 4 === 0) validMpp.push(m);
              }
              return (
                <p key={g} className="text-[11px] text-stone-500">
                  <span className="font-medium text-stone-600">Group {g} ({c}p):</span>{" "}
                  {isGroupOf4
                    ? "All-Play-All (3 matches each, perfect fairness) or Playoffs"
                    : `Playoffs — ${validMpp.join(", ")} matches/player`
                  }
                </p>
              );
            })}
          </div>
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
            {confirming
              ? hasUnsavedChanges ? "Saving changes…" : "Confirming…"
              : hasUnsavedChanges
              ? "Save Changes & Confirm Groups →"
              : "Confirm Groups → Proceed to Sessions"}
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
    <NavLink
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
    </NavLink>
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
  // Auto-select the latest relevant tab based on event status
  const initialTab: Tab = (() => {
    if (event.status === "sessions_created" || event.status === "active" || event.status === "completed") return "sessions";
    if (event.status === "breakdown_generated") return "groups";
    return "players";
  })();
  const [tab, setTab] = useState<Tab>(initialTab);
  const [deleting, setDeleting] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const { startLoading } = useNavigationLoader();

  const canViewGroups = true; // Groups tab always accessible; generate-breakdown button handles state
  const canViewSessions =
    event.status !== "draft" && event.status !== "breakdown_generated";

  async function handleDelete() {
    if (!confirm("Delete this Finals Event and all its data? This cannot be undone.")) return;
    setDeleting(true);
    const res = await fetch(`/api/finals/${event.id}`, { method: "DELETE" });
    if (res.ok) {
      startLoading();
      router.push("/?list=1");
    } else {
      const json = await res.json();
      alert(json.error ?? "Could not delete");
      setDeleting(false);
    }
  }

  async function handleReset() {
    setShowResetConfirm(false);
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

  // Check if any sessions are active or completed
  const liveSessions: { label: string; session: FinalsSessionInfo }[] = [];
  if (sessionPair.day1 && (sessionPair.day1.status === "active" || sessionPair.day1.status === "completed")) {
    liveSessions.push({ label: "Day 1 — Groups A & B", session: sessionPair.day1 });
  }
  if (sessionPair.day2 && (sessionPair.day2.status === "active" || sessionPair.day2.status === "completed")) {
    liveSessions.push({ label: "Day 2 — Group C", session: sessionPair.day2 });
  }
  const hasActiveSessions = liveSessions.some((s) => s.session.status === "active");

  return (
    <div className="flex flex-col gap-4">
      {/* Live sessions banner */}
      {liveSessions.length > 0 && (
        <div className={`rounded-xl px-4 py-3 flex flex-col gap-2 ${hasActiveSessions ? "bg-sky-50 border border-sky-200" : "bg-teal-50 border border-teal-200"}`}>
          <div className="flex items-center gap-2">
            {hasActiveSessions && <span className="w-2 h-2 rounded-full bg-sky-500 animate-pulse" />}
            <span className={`text-xs font-semibold uppercase tracking-wide ${hasActiveSessions ? "text-sky-700" : "text-teal-700"}`}>
              {hasActiveSessions ? "Sessions In Progress" : "Sessions Completed"}
            </span>
          </div>
          {liveSessions.map((s) => {
            const isActive = s.session.status === "active";
            const formattedDate = new Date(s.session.date + "T12:00:00").toLocaleDateString("en-US", {
              weekday: "short", month: "short", day: "numeric",
            });
            return (
              <NavLink
                key={s.session.id}
                href={`/session/${s.session.id}`}
                className="flex items-center justify-between px-3 py-2 bg-white rounded-lg hover:bg-stone-50 active:bg-sky-50 transition-colors"
              >
                <div>
                  <p className="text-sm font-semibold text-stone-800">{s.label}</p>
                  <p className="text-xs text-stone-400">{formattedDate}</p>
                </div>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                  isActive ? "text-white bg-sky-700" : "text-teal-600 bg-teal-100"
                }`}>
                  {isActive ? "Live" : "Done"}
                </span>
              </NavLink>
            );
          })}
        </div>
      )}

      {/* Step workflow arrows */}
      <WorkflowSteps
        steps={[
          { key: "players", step: 1, label: "Players", locked: false, done: participants.length > 0 },
          { key: "groups", step: 2, label: "Groups", locked: !canViewGroups, done: event.status !== "draft" },
          { key: "sessions", step: 3, label: "Sessions", locked: !canViewSessions, done: !!sessionPair.day1 },
        ]}
        activeTab={tab}
        onSelect={(key) => setTab(key as Tab)}
      />

      {/* Tab content */}
      {tab === "players" && (
        <PlayersTab
          eventId={event.id}
          eventStatus={event.status}
          allPlayers={allPlayers}
          participants={participants}
          onGoToGroups={() => setTab("groups")}
        />
      )}

      {tab === "groups" && (
        <GroupsTab
          eventId={event.id}
          eventStatus={event.status}
          participants={participants}
          onSwitchToPlayers={() => setTab("players")}
          onConfirmed={() => setTab("sessions")}
        />
      )}

      {tab === "sessions" && canViewSessions && (
        <SessionsTab
          eventId={event.id}
          eventStatus={event.status}
          sessionPair={sessionPair}
        />
      )}

      {/* Reset / Delete */}
      <div className="mt-2 flex flex-col gap-2">
        {event.status !== "draft" && (
          <>
            <button
              onClick={() => setShowResetConfirm(true)}
              disabled={resetting || deleting || isPending}
              className="w-full py-2.5 text-sm font-medium text-amber-500 hover:text-amber-700 border border-amber-200 hover:border-amber-300 rounded-xl transition-colors disabled:opacity-50"
            >
              {resetting ? "Resetting…" : "Reset to Draft (keep players)"}
            </button>
            {showResetConfirm && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
                <div className="bg-white rounded-xl shadow-lg max-w-sm w-full p-5 flex flex-col gap-3">
                  <p className="text-sm font-semibold text-stone-900">Reset to Draft</p>
                  <p className="text-sm text-stone-600 leading-relaxed">
                    This will clear all groups, sessions, and matches. Players will stay in the pool.
                  </p>
                  <div className="flex gap-2 mt-1">
                    <button
                      onClick={() => setShowResetConfirm(false)}
                      className="flex-1 py-2 text-sm font-medium text-stone-500 border border-stone-200 rounded-lg hover:bg-stone-50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleReset}
                      className="flex-1 py-2 text-sm font-semibold text-white bg-amber-500 hover:bg-amber-600 rounded-lg transition-colors"
                    >
                      Reset
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
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
