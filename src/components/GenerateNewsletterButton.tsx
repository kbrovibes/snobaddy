"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function GenerateNewsletterButton({ seasonId }: { seasonId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/seasons/${seasonId}/newsletter/generate`, { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError((body as { error?: string }).error ?? `HTTP ${res.status}`);
        return;
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={handleGenerate}
        disabled={loading}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-stone-900 dark:bg-sky-600 text-white hover:bg-stone-800 dark:hover:bg-sky-500 disabled:opacity-50 transition-colors"
      >
        <span>📰</span>
        <span>{loading ? "Generating…" : "Generate newsletter"}</span>
      </button>
      {error && <p className="text-[11px] text-red-500">{error}</p>}
    </div>
  );
}
