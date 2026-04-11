"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { FinalsEvent, FinalsParticipant } from "@/lib/db/finals";
import type { PlayerStats } from "@/lib/db/players";

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

// ─── Main tabs component ──────────────────────────────────────────────────────
export default function FinalsEventTabs({
  event,
  allPlayers,
  participants,
}: {
  event: FinalsEvent;
  allPlayers: PlayerStats[];
  participants: FinalsParticipant[];
}) {
  const [tab, setTab] = useState<Tab>("players");
  const [deleting, setDeleting] = useState(false);
  const router = useRouter();

  const canViewGroups = event.status !== "draft";
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

      {tab === "groups" && canViewGroups && (
        <div className="bg-white rounded-xl shadow-sm p-4">
          <p className="text-sm text-stone-400">
            Group assignments — implemented in Task 4.
          </p>
        </div>
      )}

      {tab === "sessions" && canViewSessions && (
        <div className="bg-white rounded-xl shadow-sm p-4">
          <p className="text-sm text-stone-400">
            Finals session generation — implemented in Task 5.
          </p>
        </div>
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
