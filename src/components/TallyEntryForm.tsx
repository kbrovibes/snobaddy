"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import type { TallyEntry } from "@/lib/db/tally";

interface Props {
  sessionId: string;
  allPlayers: Array<{ id: string; name: string }>;
  initialEntries?: TallyEntry[];
  isEdit?: boolean;
  isGodMode?: boolean;
  tallyModel?: string;
}

type FormRow = {
  player_id: string;
  player_name: string;
  raw_name?: string;      // name as written on the board (for unmatched hint)
  unmatched?: boolean;    // shown in red — must be resolved or deleted before save
  wins: string;
  losses: string;
};

type Validation = {
  balanced: boolean;
  total_wins: number;
  total_losses: number;
};

type NameCorrection = {
  raw_name: string;
  matched_name: string;
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

  const [mode, setMode] = useState<"closed" | "manual" | "photo">(
    isEdit ? "manual" : "closed"
  );
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
  const [validation, setValidation] = useState<Validation | null>(null);
  const [nameCorrections, setNameCorrections] = useState<NameCorrection[]>([]);
  const [playerPickerOpen, setPlayerPickerOpen] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [confirmReplace, setConfirmReplace] = useState(false);

  const usedIds = new Set(rows.filter((r) => !r.unmatched).map((r) => r.player_id));
  const availablePlayers = allPlayers.filter((p) => !usedIds.has(p.id));

  function handleTogglePlayer(playerId: string) {
    const player = allPlayers.find((p) => p.id === playerId);
    if (!player) return;
    if (usedIds.has(playerId)) {
      // Remove player
      setRows((prev) => prev.filter((r) => r.player_id !== playerId));
    } else {
      // Add player
      setRows((prev) => [
        ...prev,
        { player_id: playerId, player_name: player.name, wins: "", losses: "" },
      ]);
    }
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
          ? { ...r, player_id: playerId, player_name: player.name, unmatched: false, raw_name: undefined }
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
    setValidation(null);
    setNameCorrections([]);
    setPlayerPickerOpen(false);
    setMode(isEdit ? "manual" : "closed");
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    if (rows.length > 0) {
      setPendingFile(file);
      setConfirmReplace(true);
    } else {
      processPhoto(file);
    }
  }

  function handleConfirmReplace() {
    if (pendingFile) {
      processPhoto(pendingFile);
    }
    setPendingFile(null);
    setConfirmReplace(false);
  }

  function handleCancelReplace() {
    setPendingFile(null);
    setConfirmReplace(false);
  }

  async function processPhoto(file: File) {
    setExtracting(true);
    setError(null);
    setValidation(null);
    setNameCorrections([]);

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

      type ExtractedEntry = {
        player_id: string | null;
        player_name: string;
        raw_name: string;
        wins: number;
        losses: number;
        unmatched: boolean;
        corrected_from_alias?: boolean;
      };

      const extracted: ExtractedEntry[] = (data.entries ?? []).filter(
        (entry: ExtractedEntry) => entry.wins > 0 || entry.losses > 0
      );
      setRows(
        extracted.map((entry) => ({
          player_id: entry.player_id ?? "",
          player_name: entry.player_name,
          raw_name: entry.unmatched ? entry.raw_name : undefined,
          wins: String(entry.wins),
          losses: String(entry.losses),
          unmatched: entry.unmatched,
        }))
      );

      // Show name corrections (where raw_name differs from matched player_name)
      const corrections: NameCorrection[] = extracted
        .filter((entry) => !entry.unmatched && entry.raw_name !== entry.player_name)
        .map((entry) => ({
          raw_name: entry.raw_name,
          matched_name: entry.player_name,
        }));
      setNameCorrections(corrections);

      if (data.validation) {
        setValidation(data.validation);
      }
    } catch {
      setError("Network error — please try again");
    } finally {
      setExtracting(false);
    }
  }

  const hasUnmatched = rows.some((r) => r.unmatched);
  const canSave =
    !hasUnmatched &&
    rows.every((r) => r.wins !== "" && r.losses !== "");

  // Recompute wins/losses balance from current form state
  const formTotalWins = rows.reduce((s, r) => s + (parseInt(r.wins, 10) || 0), 0);
  const formTotalLosses = rows.reduce((s, r) => s + (parseInt(r.losses, 10) || 0), 0);
  const formImbalanced = rows.length > 0 && formTotalWins !== formTotalLosses;

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
      setMode("closed");
      router.refresh();
    } catch {
      setError("Network error — please try again");
    } finally {
      setSaving(false);
    }
  }

  // ── Closed state ─────────────────────────────────────────────────────────

  if (mode === "closed") {
    if (isEdit) {
      return (
        <button
          onClick={() => setMode("manual")}
          className="text-sm font-medium text-sky-600 hover:text-sky-700 underline-offset-2 hover:underline"
        >
          Edit Tallies
        </button>
      );
    }
    return (
      <div className="flex flex-col gap-3">
        <button
          onClick={() => setMode("manual")}
          className="w-full py-3 text-sm font-semibold rounded-xl bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600 text-white transition-colors"
        >
          Enter Scoreboard Manually
        </button>
        {isGodMode && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept=".jpg,.jpeg,.png,.heic,.webp"
              className="hidden"
              onChange={(e) => {
                setMode("photo");
                handleFileSelect(e);
              }}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full py-3 text-sm font-semibold rounded-xl bg-sky-600 hover:bg-sky-700 dark:bg-sky-500 dark:hover:bg-sky-600 text-white transition-colors"
            >
              Upload Scoreboard Photo
            </button>
          </>
        )}
      </div>
    );
  }

  // ── Open state (manual or photo) ──────────────────────────────────────────

  return (
    <div className="bg-surface rounded-xl shadow-sm dark:shadow-none dark:ring-1 dark:ring-border px-4 py-4 flex flex-col gap-3">

      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-text">
          {isEdit ? "Edit Final Scores" : "Enter Final Scores"}
        </h3>
        <div className="flex items-center gap-3">
          {isGodMode && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept=".jpg,.jpeg,.png,.heic,.webp"
                className="hidden"
                onChange={handleFileSelect}
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
          <button onClick={handleCancel} className="text-xs text-muted-light hover:text-text">
            Cancel
          </button>
        </div>
      </div>

      {/* Confirm replace existing entries */}
      {confirmReplace && (
        <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-100 dark:border-amber-500/20 rounded-lg px-3 py-2.5 flex flex-col gap-2">
          <p className="text-sm text-amber-800 dark:text-amber-200 font-medium">
            Replace current entries with extracted values?
          </p>
          <div className="flex gap-2">
            <button
              onClick={handleCancelReplace}
              className="flex-1 py-1.5 text-sm font-medium text-text bg-surface border border-border rounded-lg"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirmReplace}
              className="flex-1 py-1.5 text-sm font-semibold text-white bg-amber-600 rounded-lg"
            >
              Yes, replace
            </button>
          </div>
        </div>
      )}

      {/* Extracting spinner */}
      {extracting && (
        <div className="text-center py-6 text-sm text-purple-600 animate-pulse">
          Reading whiteboard…
        </div>
      )}

      {/* Rows */}
      {!extracting && rows.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="grid grid-cols-[1fr_4rem_4rem_2rem] gap-2 text-xs text-muted-light uppercase font-medium px-1">
            <span>Player</span>
            <span className="text-center">W</span>
            <span className="text-center">L</span>
            <span />
          </div>

          {rows.map((row, i) => (
            <div
              key={`${row.player_id || "u"}-${i}`}
              className={`grid grid-cols-[1fr_4rem_4rem_2rem] gap-2 items-center rounded-lg px-1 py-0.5 ${
                row.unmatched ? "bg-red-50 dark:bg-red-500/10 ring-1 ring-red-300" : ""
              }`}
            >
              {row.unmatched ? (
                <select
                  value=""
                  onChange={(e) => resolveUnmatched(i, e.target.value)}
                  className="border border-red-300 rounded-lg text-sm px-2 py-1 text-red-700 bg-surface focus:outline-none focus:ring-2 focus:ring-red-400"
                >
                  <option value="" disabled>
                    ✕ &ldquo;{row.raw_name ?? row.player_name}&rdquo; — not in system
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
                <span className="text-sm text-heading truncate px-1">{row.player_name}</span>
              )}
              <input
                type="number"
                min="0"
                inputMode="numeric"
                value={row.wins}
                onChange={(e) => updateRow(i, "wins", e.target.value)}
                className="border border-border rounded-lg text-center text-sm py-1.5 w-full text-heading focus:outline-none focus:ring-2 focus:ring-sky-400"
              />
              <input
                type="number"
                min="0"
                inputMode="numeric"
                value={row.losses}
                onChange={(e) => updateRow(i, "losses", e.target.value)}
                className="border border-border rounded-lg text-center text-sm py-1.5 w-full text-heading focus:outline-none focus:ring-2 focus:ring-sky-400"
              />
              <button
                onClick={() => removeRow(i)}
                aria-label={`Remove ${row.player_name}`}
                className="text-muted-lighter hover:text-red-400 text-base leading-none text-center"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add players — multi-select picker */}
      {!extracting && availablePlayers.length > 0 && (
        <div>
          <button
            onClick={() => setPlayerPickerOpen(!playerPickerOpen)}
            className="w-full border border-border rounded-lg text-sm px-3 py-2 text-text-light text-left focus:outline-none focus:ring-2 focus:ring-sky-400 bg-surface flex items-center justify-between"
          >
            <span>+ Add players…</span>
            <span className="text-xs text-muted-lighter">{playerPickerOpen ? "▲" : "▼"}</span>
          </button>
          {playerPickerOpen && (
            <div className="mt-1 border border-border rounded-lg bg-surface max-h-48 overflow-y-auto shadow-sm">
              {allPlayers.map((p) => (
                <label
                  key={p.id}
                  className="flex items-center gap-2 px-3 py-1.5 hover:bg-surface-alt cursor-pointer text-sm"
                >
                  <input
                    type="checkbox"
                    checked={usedIds.has(p.id)}
                    onChange={() => handleTogglePlayer(p.id)}
                    className="rounded border-border text-sky-600 focus:ring-sky-400"
                  />
                  <span className="text-text truncate">{p.name}</span>
                </label>
              ))}
            </div>
          )}
        </div>
      )}

      {!extracting && rows.length === 0 && availablePlayers.length === 0 && (
        <p className="text-sm text-muted-light text-center py-2">No players available.</p>
      )}

      {/* Validation banners */}
      {hasUnmatched && (
        <div className="rounded-lg bg-red-50 dark:bg-red-500/10 border border-red-200 px-3 py-2 text-xs text-red-700">
          <span className="font-semibold">Cannot save yet.</span> Resolve or delete red rows — these names were not found in the system.
        </div>
      )}

      {!hasUnmatched && formImbalanced && rows.length > 0 && (
        <div className="rounded-lg bg-yellow-50 border border-yellow-200 px-3 py-2 text-xs text-yellow-800">
          <span className="font-semibold">⚠ Imbalanced:</span> total wins ({formTotalWins}) ≠ total losses ({formTotalLosses}). Every match has one winner and one loser — double-check the counts.
        </div>
      )}

      {/* Initial extraction balance note (from server) */}
      {validation && !validation.balanced && !formImbalanced && (
        <div className="rounded-lg bg-yellow-50 border border-yellow-200 px-3 py-2 text-xs text-yellow-800">
          <span className="font-semibold">⚠ Extraction warning:</span> AI read {validation.total_wins}W / {validation.total_losses}L — these don&apos;t balance. Review counts before saving.
        </div>
      )}

      {error && <p className="text-xs text-red-500">{error}</p>}

      <button
        onClick={handleSave}
        disabled={!canSave || saving || extracting}
        className="w-full py-2.5 rounded-xl text-sm font-semibold bg-stone-900 text-white hover:bg-stone-800 dark:hover:bg-sky-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        {saving ? "Saving…" : "Save Tallies"}
      </button>
    </div>
  );
}
