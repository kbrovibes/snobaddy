"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AddPlayerForm() {
  const [open, setOpen] = useState(false);
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
      router.refresh();
    } else {
      const data = await res.json();
      setError(data.error ?? "Failed to add player");
    }
    setLoading(false);
  }

  if (!open) {
    return (
      <div className="flex justify-end mb-4">
        <button
          onClick={() => setOpen(true)}
          className="text-sm px-3 py-1.5 rounded-lg bg-blue-500 text-white font-medium hover:bg-blue-600 transition-colors"
        >
          + Add Player
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white border border-gray-200 rounded-xl p-4 mb-4 shadow-sm"
    >
      <h2 className="text-sm font-semibold text-gray-700 mb-3">Add Player</h2>

      <div className="mb-3">
        <input
          type="text"
          placeholder="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-200"
          autoFocus
        />
      </div>

      <div className="mb-4 flex items-center gap-2">
        <span className="text-xs text-gray-500">Skill</span>
        <span className="flex gap-1">
          {[1, 2, 3, 4, 5].map((level) => (
            <button
              key={level}
              type="button"
              onClick={() => setSkill(level)}
              className={`text-base leading-none transition-colors ${
                level <= skill ? "text-blue-500" : "text-gray-200"
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
          onClick={() => { setOpen(false); setError(null); }}
          className="flex-1 text-sm py-2 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!name.trim() || loading}
          className="flex-1 text-sm py-2 rounded-lg bg-blue-500 text-white font-medium hover:bg-blue-600 transition-colors disabled:opacity-40"
        >
          {loading ? "Adding…" : "Add Player"}
        </button>
      </div>
    </form>
  );
}
