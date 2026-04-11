"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { FinalsEvent } from "@/lib/db/finals";

type Tab = "players" | "groups" | "sessions";

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

export default function FinalsEventTabs({ event }: { event: FinalsEvent }) {
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
        <div className="bg-white rounded-xl shadow-sm p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-stone-700">
              Players ({event.participant_count})
            </p>
          </div>
          <p className="text-sm text-stone-400">
            Add players to the Finals pool. Once all players are added, generate the group breakdown.
          </p>
          {/* Participant list & add controls — implemented in Task 3 */}
          <div className="rounded-lg border border-dashed border-stone-200 px-4 py-6 text-center">
            <p className="text-xs text-stone-300">Player management coming in next build</p>
          </div>
        </div>
      )}

      {tab === "groups" && canViewGroups && (
        <div className="bg-white rounded-xl shadow-sm p-4">
          <p className="text-sm text-stone-400">
            Group assignments will appear here — implemented in Task 4.
          </p>
        </div>
      )}

      {tab === "sessions" && canViewSessions && (
        <div className="bg-white rounded-xl shadow-sm p-4">
          <p className="text-sm text-stone-400">
            Finals session generation will appear here — implemented in Task 5.
          </p>
        </div>
      )}

      {/* Danger zone — delete draft */}
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
