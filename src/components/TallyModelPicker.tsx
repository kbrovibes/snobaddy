"use client";

import { useState } from "react";

const MODELS = [
  { id: "claude-3-haiku-20240307",    label: "Haiku",  sub: "Fast · ~$0.001/photo" },
  { id: "claude-3-sonnet-20240229",   label: "Sonnet", sub: "Best · ~$0.01/photo" },
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
              ? "border-purple-400 bg-purple-50"
              : "border-gray-200 hover:border-gray-300"
          }`}
        >
          <div>
            <span className={`text-sm font-semibold ${selected === m.id ? "text-purple-700" : "text-gray-800"}`}>
              {m.label}
            </span>
            <span className="block text-xs text-gray-400">{m.sub}</span>
          </div>
          {selected === m.id && (
            <span className="text-xs font-semibold text-purple-600">
              {saving ? "Saving…" : saved ? "Saved ✓" : "Active"}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
