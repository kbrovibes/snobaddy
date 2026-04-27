"use client";

import { useState, useMemo } from "react";
import PlayerCheckinCard from "@/components/PlayerCheckinCard";
import AddPlayerForm from "@/components/AddPlayerForm";
import DeletePlayerButton from "@/components/DeletePlayerButton";
import RestorePlayerButton from "@/components/RestorePlayerButton";
import type { PlayerStats, DeletedPlayer } from "@/lib/db/players";
import type { SessionPresence } from "@/lib/db/sessions";

interface Props {
  players: PlayerStats[];
  deletedPlayers: DeletedPlayer[];
  presence: SessionPresence[];
  sessionId?: string;
  sessionDate?: string;
  sessionActive: boolean;
  isAdmin: boolean;
  isGodMode: boolean;
}

function formatSessionDate(dateStr: string): string {
  // dateStr is YYYY-MM-DD (Pacific). Parse as local date to avoid UTC offset shift.
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}

export default function AdminPageContent({
  players,
  deletedPlayers,
  presence,
  sessionId,
  sessionDate,
  sessionActive,
  isAdmin,
  isGodMode,
}: Props) {
  const [godModeActive, setGodModeActive] = useState(false);
  const [addPlayerOpen, setAddPlayerOpen] = useState(false);

  const presenceMap = useMemo(
    () => new Map(presence.map((p) => [p.player_id, p])),
    [presence]
  );

  const presentCount = useMemo(
    () => presence.filter((p) => !p.checked_out_at).length,
    [presence]
  );
  const outCount = players.length - presentCount;

  return (
    <div className="pb-20">
      {/* Compact header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-xs font-semibold uppercase tracking-wide text-muted-light">Players</h1>
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-semibold rounded-full px-2 py-0.5 bg-amber-100 dark:bg-amber-500/15 text-amber-800 dark:text-amber-400">
              {players.length} total
            </span>
            <span className="text-[11px] font-semibold rounded-full px-2 py-0.5 bg-emerald-100 dark:bg-emerald-500/15 text-emerald-800 dark:text-emerald-400">
              {presentCount} in
            </span>
            <span className="text-[11px] font-semibold rounded-full px-2 py-0.5 bg-red-100 dark:bg-red-500/15 text-red-800 dark:text-red-400">
              {outCount} out
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isGodMode && (
            <button
              onClick={() => setGodModeActive((v) => !v)}
              className={`flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full border transition-colors ${
                godModeActive
                  ? "bg-amber-50 dark:bg-amber-500/10 border-amber-300 text-amber-700"
                  : "bg-background border-border text-muted-light hover:border-stone-300 dark:hover:border-border dark:border-border"
              }`}
              title={godModeActive ? "God Mode on" : "God Mode off"}
            >
              ⚡
            </button>
          )}
          {isAdmin && (
            <button
              onClick={() => setAddPlayerOpen(true)}
              className="bg-stone-900 dark:bg-sky-600 text-white rounded-[10px] text-[13px] font-semibold px-3 py-1.5"
            >
              + Add
            </button>
          )}
        </div>
      </div>

      {sessionActive && sessionDate && (
        <p className="px-4 mb-3 text-[13px] text-text-light">
          Session: {formatSessionDate(sessionDate)}
        </p>
      )}

      {addPlayerOpen && (
        <div className="px-4 mb-3">
          <AddPlayerForm forceOpen onClose={() => setAddPlayerOpen(false)} />
        </div>
      )}

      {players.length === 0 ? (
        <p className="text-center text-muted-light text-sm py-12">No players yet.</p>
      ) : (
        <div className="grid grid-cols-3 gap-2 px-2.5">
          {players.map((player) => {
            const p = presenceMap.get(player.id);
            const initialStatus = !p
              ? "absent"
              : p.checked_out_at
              ? "checked-out"
              : "present";

            return (
              <div key={player.id} className="flex flex-col gap-1">
                <PlayerCheckinCard
                  playerId={player.id}
                  name={player.name}
                  isAdminPlayer={player.is_admin ?? false}
                  hasUserAccount={!!player.user_id}
                  sessionId={sessionId}
                  initialStatus={initialStatus}
                  isAdmin={isAdmin}
                />
                {godModeActive && (
                  <DeletePlayerButton playerId={player.id} playerName={player.name} />
                )}
              </div>
            );
          })}
        </div>
      )}

      {isGodMode && godModeActive && deletedPlayers.length > 0 && (
        <details className="mt-8 px-4">
          <summary className="text-sm font-semibold text-muted-light cursor-pointer select-none py-2 list-none flex items-center gap-1">
            <span>▶</span>
            <span>Removed players ({deletedPlayers.length})</span>
          </summary>
          <div className="mt-2 space-y-2">
            {deletedPlayers.map((player) => (
              <div
                key={player.id}
                className="flex items-center justify-between px-3 py-2 rounded-xl border border-border-light bg-background opacity-60"
              >
                <div>
                  <span className="text-sm text-text-light font-medium">{player.name}</span>
                  <div className="flex gap-0.5 mt-0.5">
                    {[1, 2, 3, 4, 5].map((level) => (
                      <span
                        key={level}
                        className={`text-sm leading-none ${
                          level <= player.skill_level ? "text-muted-light" : "text-stone-200 dark:text-neutral-700"
                        }`}
                      >
                        ●
                      </span>
                    ))}
                  </div>
                </div>
                <RestorePlayerButton playerId={player.id} />
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
