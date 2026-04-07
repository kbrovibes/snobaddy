"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AddPlayerForm({
  forceOpen,
  onClose,
}: {
  forceOpen?: boolean;
  onClose?: () => void;
}) {
  const [open, setOpen] = useState(forceOpen ?? false);
  const [name, setName] = useState("");
  const [skill, setSkill] = useState(3);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await fetch("/api/players", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), skill_level: skill }),
    });

    if (res.ok) {
      setName("");
      setSkill(3);
      setOpen(false);
      onClose?.();
      router.refresh();
    } else {
      const data = await res.json();
      setError(data.error ?? "Failed to add player");
    }
    setLoading(false);
  }

  if (!open) return null;

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white border border-stone-200 rounded-xl p-4 mb-4 shadow-sm"
    >
      <h2 className="text-sm font-semibold text-stone-700 mb-3">Add Player</h2>

      <div className="mb-3">
        <input
          type="text"
          placeholder="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-sky-200"
          autoFocus
        />
      </div>

      <div className="mb-4 flex items-center gap-2">
        <span className="text-xs text-stone-500">Skill</span>
        <span className="flex gap-1">
          {[1, 2, 3, 4, 5].map((level) => (
            <button
              key={level}
              type="button"
              onClick={() => setSkill(level)}
              className={`text-base leading-none transition-colors ${
                level <= skill ? "text-sky-500" : "text-stone-200"
              }`}
            >
              ●
            </button>
          ))}
        </span>
      </div>

      {error && <p className="text-xs text-red-500 mb-2">{error}</p>}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => { setOpen(false); setError(null); onClose?.(); }}
          className="flex-1 text-sm py-2 rounded-lg border border-stone-200 text-stone-500 hover:bg-stone-50 transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!name.trim() || loading}
          className="flex-1 text-sm py-2 rounded-lg bg-stone-900 text-white font-medium hover:bg-stone-800 transition-colors disabled:opacity-40"
        >
          {loading ? "Adding…" : "Add Player"}
        </button>
      </div>
    </form>
  );
}
