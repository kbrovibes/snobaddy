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
  sessionActive: boolean;
  isGodMode: boolean;
}

export default function AdminPageContent({
  players,
  deletedPlayers,
  presence,
  sessionId,
  sessionActive,
  isGodMode,
}: Props) {
  const [godModeActive, setGodModeActive] = useState(false);
  const [addPlayerOpen, setAddPlayerOpen] = useState(false);

  const presenceMap = useMemo(
    () => new Map(presence.map((p) => [p.player_id, p])),
    [presence]
  );

  return (
    <div className="px-4 py-4 pb-20">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-gray-900">Players</h1>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-400">{players.length} active</span>
          {isGodMode && (
            <button
              onClick={() => setGodModeActive((v) => !v)}
              className={`flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full border transition-colors ${
                godModeActive
                  ? "bg-amber-50 border-amber-300 text-amber-700"
                  : "bg-gray-50 border-gray-200 text-gray-400 hover:border-gray-300"
              }`}
              title={godModeActive ? "God Mode on — tap to disable" : "God Mode off — tap to enable"}
            >
              ⚡
              <span>{godModeActive ? "ON" : "OFF"}</span>
            </button>
          )}
        </div>
      </div>


<div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
          Player Check-ins
          {sessionActive && (
            <span className="ml-2 normal-case font-normal text-green-600">· Session active</span>
          )}
        </h2>
        <button
          onClick={() => setAddPlayerOpen(true)}
          className="text-sm font-medium text-sky-500 hover:text-sky-700 transition-colors"
        >
          + Add Player
        </button>
      </div>

      {addPlayerOpen && (
        <AddPlayerForm forceOpen onClose={() => setAddPlayerOpen(false)} />
      )}

      {players.length === 0 ? (
        <p className="text-center text-gray-400 text-sm py-12">No players yet.</p>
      ) : (
        <div className="grid grid-cols-3 gap-2">
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
        <details className="mt-8">
          <summary className="text-sm font-semibold text-gray-400 cursor-pointer select-none py-2 list-none flex items-center gap-1">
            <span>▶</span>
            <span>Removed players ({deletedPlayers.length})</span>
          </summary>
          <div className="mt-2 space-y-2">
            {deletedPlayers.map((player) => (
              <div
                key={player.id}
                className="flex items-center justify-between px-3 py-2 rounded-xl border border-gray-100 bg-gray-50 opacity-60"
              >
                <div>
                  <span className="text-sm text-gray-500 font-medium">{player.name}</span>
                  <div className="flex gap-0.5 mt-0.5">
                    {[1, 2, 3, 4, 5].map((level) => (
                      <span
                        key={level}
                        className={`text-sm leading-none ${
                          level <= player.skill_level ? "text-gray-400" : "text-gray-200"
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
