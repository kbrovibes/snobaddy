"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";

interface Props {
  playerId: string;
  currentName: string;
  currentSkillLevel: number;
}

export default function EditPlayerForm({ playerId, currentName, currentSkillLevel }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(currentName);
  const [skillLevel, setSkillLevel] = useState(currentSkillLevel);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const isDirty = name.trim() !== currentName || skillLevel !== currentSkillLevel;
  const canSave = isDirty && name.trim().length > 0 && name.trim().length <= 50;

  function handleCancel() {
    setName(currentName);
    setSkillLevel(currentSkillLevel);
    setError(null);
    setOpen(false);
  }

  async function handleSave() {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/players/${playerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), skill_level: skillLevel }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Save failed");
        return;
      }
      setOpen(false);
      router.refresh();
    } catch {
      setError("Network error — please try again");
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-gray-300 hover:text-gray-500 transition-colors shrink-0"
        title="Edit player"
        aria-label="Edit player"
      >
        ✏️
      </button>
    );
  }

  return (
    <div className="flex-1 min-w-0 flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <input
          ref={inputRef}
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={50}
          className="flex-1 min-w-0 border border-gray-300 rounded-lg px-2 py-1 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
        <button
          onClick={handleSave}
          disabled={!canSave || saving}
          className="text-blue-600 hover:text-blue-700 disabled:opacity-30 disabled:cursor-not-allowed text-base shrink-0"
          title="Save"
          aria-label="Save"
        >
          💾
        </button>
      </div>

      {/* Skill dots */}
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((i) => (
          <button
            key={i}
            onClick={() => setSkillLevel(i)}
            className={`text-sm transition-colors ${i <= skillLevel ? "text-blue-500" : "text-gray-200"}`}
            aria-label={`Skill level ${i}`}
          >
            ●
          </button>
        ))}
        <span className="text-xs text-gray-400 ml-1">tap to change</span>
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}

      <button
        onClick={handleCancel}
        className="text-xs text-gray-400 hover:text-gray-600 text-left"
      >
        Cancel
      </button>
    </div>
  );
}
