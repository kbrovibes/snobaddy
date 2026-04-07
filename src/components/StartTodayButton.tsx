"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function StartTodayButton() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleStart() {
    setLoading(true);
    setError(null);
    const res = await fetch("/api/sessions/start-today", { method: "POST" });
    if (res.ok) {
      router.refresh();
      setLoading(false); // router.refresh() is void — reset so button doesn't stay stuck
    } else {
      const body = await res.json();
      setError(body.error ?? "Something went wrong.");
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        onClick={handleStart}
        disabled={loading}
        className="px-5 py-2.5 text-sm font-semibold text-white bg-sky-600 rounded-xl disabled:opacity-50 hover:bg-sky-700 transition-colors"
      >
        {loading ? "Starting…" : "Start session for today"}
      </button>
      <p className="text-xs text-gray-300">Admin · for testing only</p>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}
