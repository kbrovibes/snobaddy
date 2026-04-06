"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import type { TallyEntry } from "@/lib/db/tally";

interface Props {
  sessionId: string;
  allPlayers: Array<{ id: string; name: string }>;
  /** Pre-filled entries when editing existing tally data */
  initialEntries?: TallyEntry[];
  /** When true, the closed button reads "Edit Tallies" instead of "Enter Final Scores" */
  isEdit?: boolean;
  /** God-mode users see the photo import button */
  isGodMode?: boolean;
}

type FormRow = {
  player_id: string;
  /** null means AI couldn't match this name — admin must pick from dropdown */
  unmatched?: boolean;
  player_name: string;
  wins: string;
  losses: string;
};

export default function TallyEntryForm({
  sessionId,
  allPlayers,
  initialEntries,
  isEdit,
  isGodMode,
}: Props) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

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
  const [extracting, setExtracting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const usedIds = new Set(rows.filter((r) => !r.unmatched).map((r) => r.player_id));
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

  function resolveUnmatched(index: number, playerId: string) {
    const player = allPlayers.find((p) => p.id === playerId);
    if (!player) return;
    setRows((prev) =>
      prev.map((r, i) =>
        i === index
          ? { ...r, player_id: playerId, player_name: player.name, unmatched: false }
          : r
      )
    );
  }

  function handleCancel() {
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

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (rows.length > 0) {
      const ok = window.confirm(
        "This will replace your current entries with the extracted values. Continue?"
      );
      if (!ok) {
        e.target.value = "";
        return;
      }
    }

    setExtracting(true);
    setError(null);

    try {
      const form = new FormData();
      form.append("photo", file);
      const res = await fetch(`/api/sessions/${sessionId}/tally/extract`, {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Extraction failed");
        return;
      }

      const extracted: Array<{
        player_id: string | null;
        player_name: string;
        wins: number;
        losses: number;
      }> = data.entries ?? [];

      setRows(
        extracted.map((entry) => ({
          player_id: entry.player_id ?? "",
          player_name: entry.player_name,
          wins: String(entry.wins),
          losses: String(entry.losses),
          unmatched: entry.player_id === null,
        }))
      );
    } catch {
      setError("Network error — please try again");
    } finally {
      setExtracting(false);
      e.target.value = "";
    }
  }

  const hasUnmatched = rows.some((r) => r.unmatched);
  const canSave =
    rows.length > 0 &&
    !hasUnmatched &&
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
      <div className="flex gap-2">
        <button
          onClick={() => setOpen(true)}
          className="flex-1 py-3 rounded-xl text-sm font-semibold border-2 border-dashed border-gray-200 text-gray-500 hover:border-blue-300 hover:text-blue-600 transition-colors"
        >
          + Enter Final Scores
        </button>
        {isGodMode && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handlePhotoUpload}
            />
            <button
              onClick={() => { setOpen(true); setTimeout(() => fileInputRef.current?.click(), 50); }}
              className="px-4 py-3 rounded-xl text-sm font-semibold border-2 border-dashed border-purple-200 text-purple-500 hover:border-purple-400 hover:text-purple-600 transition-colors"
              title="Import from photo"
            >
              📷
            </button>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm px-4 py-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700">
          {isEdit ? "Edit Final Scores" : "Enter Final Scores"}
        </h3>
        <div className="flex items-center gap-3">
          {isGodMode && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handlePhotoUpload}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={extracting}
                className="text-xs font-medium text-purple-600 hover:text-purple-700 disabled:opacity-50"
              >
                {extracting ? "Extracting…" : "📷 Import from photo"}
              </button>
            </>
          )}
          <button
            onClick={handleCancel}
            className="text-xs text-gray-400 hover:text-gray-600"
          >
            Cancel
          </button>
        </div>
      </div>

      {extracting && (
        <div className="text-center py-4 text-sm text-purple-600 animate-pulse">
          Extracting scores from photo…
        </div>
      )}

      {!extracting && rows.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="grid grid-cols-[1fr_4rem_4rem_2rem] gap-2 text-xs text-gray-400 uppercase font-medium px-1">
            <span>Player</span>
            <span className="text-center">W</span>
            <span className="text-center">L</span>
            <span />
          </div>
          {rows.map((row, i) => (
            <div
              key={`${row.player_id || "unmatched"}-${i}`}
              className={`grid grid-cols-[1fr_4rem_4rem_2rem] gap-2 items-center rounded-lg px-1 py-0.5 ${
                row.unmatched ? "bg-amber-50 ring-1 ring-amber-200" : ""
              }`}
            >
              {row.unmatched ? (
                <select
                  value=""
                  onChange={(e) => resolveUnmatched(i, e.target.value)}
                  className="border border-amber-300 rounded-lg text-sm px-2 py-1 text-gray-600 bg-white focus:outline-none focus:ring-2 focus:ring-amber-400"
                >
                  <option value="" disabled>
                    ⚠ "{row.player_name}" — pick player
                  </option>
                  {allPlayers
                    .filter((p) => !usedIds.has(p.id))
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                </select>
              ) : (
                <span className="text-sm text-gray-800 truncate px-1">
                  {row.player_name}
                </span>
              )}
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

      {!extracting && availablePlayers.length > 0 ? (
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
      ) : !extracting && rows.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-2">
          No players available to add.
        </p>
      ) : null}

      {hasUnmatched && (
        <p className="text-xs text-amber-600">
          ⚠ Resolve highlighted players before saving.
        </p>
      )}

      {error && <p className="text-xs text-red-500">{error}</p>}

      <button
        onClick={handleSave}
        disabled={!canSave || saving || extracting}
        className="w-full py-2.5 rounded-xl text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        {saving ? "Saving…" : "Save Tallies"}
      </button>
    </div>
  );
}
