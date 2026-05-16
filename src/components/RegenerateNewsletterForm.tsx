"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  seasonId: string;
  currentContext: string | null;
  hasNewsletter: boolean;
}

export default function RegenerateNewsletterForm({ seasonId, currentContext, hasNewsletter }: Props) {
  const router = useRouter();
  const [context, setContext] = useState(currentContext ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function handleRegenerate(useContext: boolean) {
    setLoading(true);
    setError(null);
    setMsg(null);
    try {
      const res = await fetch(`/api/admin/seasons/${seasonId}/newsletter`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ extraContext: useContext ? context : "" }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError((data as { error?: string }).error ?? `HTTP ${res.status}`);
        return;
      }
      const data = await res.json();
      setMsg(`Saved version ${data.version}. Reloading…`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-lg border border-muted/30 bg-surface/40 p-3 space-y-3">
      <div>
        <label className="text-xs font-semibold uppercase tracking-wide text-muted-light">
          Extra context for the next regeneration
        </label>
        <p className="text-xs text-muted-light mt-0.5">
          Optional. Paste anecdotes, callouts, or inside jokes you want folded into the intro. Re-running keeps everything else stats-driven.
        </p>
        <textarea
          value={context}
          onChange={(e) => setContext(e.target.value)}
          rows={4}
          className="mt-2 w-full rounded-md border border-muted/30 bg-background px-2 py-1.5 text-sm"
          placeholder="e.g. Tridib finally got his backhand to work in week 5. Robyn brought brownies twice."
          disabled={loading}
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => handleRegenerate(true)}
          disabled={loading}
          className="rounded-md bg-primary text-primary-foreground px-3 py-1.5 text-sm font-medium disabled:opacity-50"
        >
          {hasNewsletter ? "Regenerate with this context" : "Generate newsletter"}
        </button>
        {hasNewsletter && (
          <button
            type="button"
            onClick={() => handleRegenerate(false)}
            disabled={loading}
            className="rounded-md border border-muted/40 px-3 py-1.5 text-sm font-medium disabled:opacity-50"
          >
            Regenerate (stats only, drop context)
          </button>
        )}
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
      {msg && <p className="text-xs text-green-600">{msg}</p>}
    </div>
  );
}
