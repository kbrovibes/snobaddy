"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function UbrVisibilityToggle({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  const [on, setOn] = useState(enabled);
  const [saving, setSaving] = useState(false);

  async function toggle() {
    const next = !on;
    setOn(next);
    setSaving(true);
    await fetch("/api/admin/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: "ubr_enabled", value: next ? "true" : "false" }),
    });
    setSaving(false);
    router.refresh();
  }

  return (
    <div className="flex items-center justify-between py-2">
      <div>
        <p className="text-sm font-medium text-text">Show UBR Ratings</p>
        <p className="text-xs text-muted-light">Toggle visibility in leaderboard &amp; profiles</p>
      </div>
      <button
        onClick={toggle}
        disabled={saving}
        className="relative inline-flex w-11 h-6 rounded-full transition-colors duration-200 focus:outline-none disabled:opacity-50"
        style={{ background: on ? "#0ea5e9" : "var(--muted-lighter)" }}
      >
        <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${on ? "translate-x-5" : "translate-x-0"}`} />
      </button>
    </div>
  );
}

export function UbrRecalculateButton() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function recalculate() {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/ubr/recalculate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (res.ok) {
        setResult("Recalculated successfully");
      } else {
        const data = await res.json();
        setResult(`Error: ${data.error}`);
      }
    } catch {
      setResult("Network error");
    }
    setLoading(false);
  }

  return (
    <div className="mt-2">
      <button
        onClick={recalculate}
        disabled={loading}
        className="w-full py-2 bg-purple-50 dark:bg-purple-500/10 border border-purple-200 dark:border-purple-500/30 text-purple-700 dark:text-purple-400 text-sm font-semibold rounded-lg hover:bg-purple-100 disabled:opacity-50 transition-colors"
      >
        {loading ? "Recalculating..." : "Recalculate All UBR"}
      </button>
      {result && (
        <p className={`text-xs mt-1.5 ${result.startsWith("Error") ? "text-red-500" : "text-green-600 dark:text-green-400"}`}>
          {result}
        </p>
      )}
    </div>
  );
}
