"use client";

import { useState } from "react";

interface Props {
  playerId: string;
  current: number;
}

export default function SkillEditor({ playerId, current }: Props) {
  const [skill, setSkill] = useState(current);
  const [saving, setSaving] = useState(false);

  async function update(level: number) {
    setSaving(true);
    setSkill(level);
    await fetch(`/api/players/${playerId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ skill_level: level }),
    });
    setSaving(false);
  }

  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((level) => (
        <button
          key={level}
          onClick={() => update(level)}
          disabled={saving}
          className={`text-base leading-none transition-colors ${
            level <= skill ? "text-sky-500" : "text-stone-200 dark:text-neutral-700"
          }`}
          title={`Set skill to ${level}`}
        >
          ●
        </button>
      ))}
    </div>
  );
}
