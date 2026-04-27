"use client";

import { useState } from "react";

const MODELS = [
  { id: "claude-haiku-4-5-20251001", label: "Haiku 4.5",  sub: "Fast · ~$0.001/photo" },
  { id: "claude-sonnet-4-6",         label: "Sonnet 4.6", sub: "Best · ~$0.01/photo" },
];

export default function TallyModelPicker({ current }: { current: string }) {
  const [selected, setSelected] = useState(current);
  const [saving, setSaving]     = useState(false);
  const [saved, setSaved]       = useState(false);

  async function save(modelId: string) {
    setSelected(modelId);
    setSaving(true);
    setSaved(false);
    await fetch("/api/admin/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: "tally_extraction_model", value: modelId }),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="flex flex-col gap-2">
      {MODELS.map((m) => (
        <button
          key={m.id}
          onClick={() => save(m.id)}
          disabled={saving}
          className={`flex items-center justify-between px-3 py-2.5 rounded-lg border text-left transition-colors ${
            selected === m.id
              ? "border-purple-400 dark:border-purple-500/50 bg-purple-50 dark:bg-purple-500/10"
              : "border-border hover:border-stone-300 dark:hover:border-border dark:border-border"
          }`}
        >
          <div>
            <span className={`text-sm font-semibold ${selected === m.id ? "text-purple-700 dark:text-purple-400" : "text-heading"}`}>
              {m.label}
            </span>
            <span className="block text-xs text-muted-light">{m.sub}</span>
          </div>
          {selected === m.id && (
            <span className="text-xs font-semibold text-purple-600 dark:text-purple-400">
              {saving ? "Saving…" : saved ? "Saved ✓" : "Active"}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
