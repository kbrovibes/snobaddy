"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { TallyEntry } from "@/lib/db/tally";

interface Props {
  sessionId: string;
  allPlayers: Array<{ id: string; name: string }>;
  /** Pre-filled entries when editing existing tally data */
  initialEntries?: TallyEntry[];
  /** When true, the closed button reads "Edit Tallies" instead of "Enter Final Scores" */
  isEdit?: boolean;
}

type FormRow = {
  player_id: string;
  player_name: string;
  wins: string;
  losses: string;
};

export default function TallyEntryForm({ sessionId, allPlayers, initialEntries, isEdit }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<FormRow[]>(() =>
    (initialEntries ?? []).map((e) => ({
      player_id: e.player_id,
      player_name: e.player_name,
      wins: String(e.wins),
      losses: String(e.losses),
    }))
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const usedIds = new Set(rows.map((r) => r.player_id));
  const availablePlayers = allPlayers.filter((p) => !usedIds.has(p.id));

  function handleAddPlayer(e: React.ChangeEvent<HTMLSelectElement>) {
    const playerId = e.target.value;
    if (!playerId) return;
    const player = allPlayers.find((p) => p.id === playerId);
    if (!player) return;
    setRows((prev) => [
      ...prev,
      { player_id: playerId, player_name: player.name, wins: "", losses: "" },
    ]);
    // Reset select so the same player can be re-added after removal
    e.target.value = "";
  }

  function removeRow(index: number) {
    setRows((prev) => prev.filter((_, i) => i !== index));
  }

  function updateRow(index: number, field: "wins" | "losses", value: string) {
    setRows((prev) =>
      prev.map((r, i) => (i === index ? { ...r, [field]: value } : r))
    );
  }

  function handleCancel() {
    // Reset to initial state on cancel
    setRows(
      (initialEntries ?? []).map((e) => ({
        player_id: e.player_id,
        player_name: e.player_name,
        wins: String(e.wins),
        losses: String(e.losses),
      }))
    );
    setError(null);
    setOpen(false);
  }

  const canSave =
    rows.length > 0 &&
    rows.every((r) => r.wins !== "" && r.losses !== "");

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/sessions/${sessionId}/tally`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entries: rows.map((r) => ({
            player_id: r.player_id,
            wins: parseInt(r.wins, 10),
            losses: parseInt(r.losses, 10),
          })),
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Failed to save tallies");
        return;
      }
      setOpen(false);
      router.refresh();
    } catch {
      setError("Network error — please try again");
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    if (isEdit) {
      return (
        <button
          onClick={() => setOpen(true)}
          className="text-sm font-medium text-blue-600 hover:text-blue-700 underline-offset-2 hover:underline"
        >
          Edit Tallies
        </button>
      );
    }
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full py-3 rounded-xl text-sm font-semibold border-2 border-dashed border-gray-200 text-gray-500 hover:border-blue-300 hover:text-blue-600 transition-colors"
      >
        + Enter Final Scores
      </button>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm px-4 py-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700">
          {isEdit ? "Edit Final Scores" : "Enter Final Scores"}
        </h3>
        <button
          onClick={handleCancel}
          className="text-xs text-gray-400 hover:text-gray-600"
        >
          Cancel
        </button>
      </div>

      {rows.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="grid grid-cols-[1fr_4rem_4rem_2rem] gap-2 text-xs text-gray-400 uppercase font-medium px-1">
            <span>Player</span>
            <span className="text-center">W</span>
            <span className="text-center">L</span>
            <span />
          </div>
          {rows.map((row, i) => (
            <div
              key={row.player_id}
              className="grid grid-cols-[1fr_4rem_4rem_2rem] gap-2 items-center"
            >
              <span className="text-sm text-gray-800 truncate px-1">
                {row.player_name}
              </span>
              <input
                type="number"
                min="0"
                inputMode="numeric"
                value={row.wins}
                onChange={(e) => updateRow(i, "wins", e.target.value)}
                className="border border-gray-200 rounded-lg text-center text-sm py-1.5 w-full text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
              <input
                type="number"
                min="0"
                inputMode="numeric"
                value={row.losses}
                onChange={(e) => updateRow(i, "losses", e.target.value)}
                className="border border-gray-200 rounded-lg text-center text-sm py-1.5 w-full text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
              <button
                onClick={() => removeRow(i)}
                aria-label={`Remove ${row.player_name}`}
                className="text-gray-300 hover:text-red-400 text-base leading-none text-center"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {availablePlayers.length > 0 ? (
        <select
          onChange={handleAddPlayer}
          defaultValue=""
          className="border border-gray-200 rounded-lg text-sm px-3 py-2 text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
        >
          <option value="" disabled>
            + Add player…
          </option>
          {availablePlayers.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      ) : rows.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-2">
          No players available to add.
        </p>
      ) : null}

      {error && <p className="text-xs text-red-500">{error}</p>}

      <button
        onClick={handleSave}
        disabled={!canSave || saving}
        className="w-full py-2.5 rounded-xl text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        {saving ? "Saving…" : "Save Tallies"}
      </button>
    </div>
  );
}
