"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const SEASON_CYCLE = ["Spring", "Summer", "Fall", "Winter"];

function suggestNextSeason(lastSeasonName?: string): { name: string; year: number } {
  const now = new Date();
  const year = now.getFullYear();

  if (!lastSeasonName) return { name: `${SEASON_CYCLE[0]} ${year}`, year };

  // Parse "Spring 2026" → ["Spring", "2026"]
  const parts = lastSeasonName.split(" ");
  const lastSeason = parts[0];
  const lastYear = parseInt(parts[1]) || year;
  const idx = SEASON_CYCLE.indexOf(lastSeason);

  if (idx === -1) return { name: `${SEASON_CYCLE[0]} ${year}`, year };

  const nextIdx = (idx + 1) % SEASON_CYCLE.length;
  const nextYear = nextIdx === 0 ? lastYear + 1 : lastYear;
  return { name: `${SEASON_CYCLE[nextIdx]} ${nextYear}`, year: nextYear };
}

export default function CreateSeasonForm({ lastSeasonName }: { lastSeasonName?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const suggestion = suggestNextSeason(lastSeasonName);

  const [name, setName] = useState(suggestion.name);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full py-3 rounded-xl text-sm font-semibold border-2 border-dashed border-border text-text-light hover:border-sky-300 hover:text-sky-600 dark:hover:border-sky-600 dark:hover:text-sky-400 transition-colors"
      >
        + Create New Season
      </button>
    );
  }

  async function handleSave() {
    if (!name || !startDate || !endDate) {
      setError("All fields are required");
      return;
    }
    if (endDate <= startDate) {
      setError("End date must be after start date");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/seasons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, start_date: startDate, end_date: endDate }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Failed to create season");
        return;
      }
      setOpen(false);
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-surface border border-border-light rounded-xl p-4 space-y-3">
      <h3 className="text-sm font-bold text-heading">New Season</h3>

      <div>
        <label className="block text-xs font-medium text-muted-light mb-1">Season Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background text-text focus:outline-none focus:ring-2 focus:ring-sky-500"
          placeholder="e.g. Summer 2026"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-muted-light mb-1">Start Date</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background text-text focus:outline-none focus:ring-2 focus:ring-sky-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-light mb-1">End Date</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background text-text focus:outline-none focus:ring-2 focus:ring-sky-500"
          />
        </div>
      </div>

      {error && <p className="text-xs text-red-600 dark:text-red-400 font-medium">{error}</p>}

      <div className="flex gap-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex-1 py-2 rounded-lg text-sm font-bold bg-sky-600 text-white hover:bg-sky-700 disabled:opacity-50 transition-colors"
        >
          {saving ? "Creating..." : "Create Season"}
        </button>
        <button
          onClick={() => setOpen(false)}
          className="px-4 py-2 rounded-lg text-sm font-medium text-muted-light hover:text-text transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
