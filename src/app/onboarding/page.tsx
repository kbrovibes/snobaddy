"use client";

import { createClient } from "@/lib/supabase-browser";
import { useRouter } from "next/navigation";
import { useState } from "react";

const SKILL_LEVELS = [
  { value: 1, label: "Beginner", description: "Just starting out" },
  { value: 2, label: "Casual", description: "Know the basics" },
  { value: 3, label: "Intermediate", description: "Play regularly" },
  { value: 4, label: "Advanced", description: "Competitive player" },
  { value: 5, label: "Pro", description: "Tournament level" },
];

export default function OnboardingPage() {
  const [selected, setSelected] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  async function save(skillLevel: number) {
    setSaving(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase
        .from("players")
        .update({ skill_level: skillLevel, onboarding_complete: true })
        .eq("user_id", user.id);
    }
    router.push("/");
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 p-6 bg-gray-50">
      <div className="flex flex-col items-center gap-2 text-center">
        <span className="text-5xl">🏸</span>
        <h1 className="text-2xl font-bold text-gray-900">Welcome to snobaddy!</h1>
        <p className="text-gray-500 text-sm max-w-xs">
          How would you rate your badminton skill? This helps us set up fair matches.
        </p>
      </div>

      <div className="flex flex-col gap-3 w-full max-w-xs">
        {SKILL_LEVELS.map(({ value, label, description }) => (
          <button
            key={value}
            onClick={() => setSelected(value)}
            disabled={saving}
            className={`flex items-center gap-4 px-4 py-3 rounded-xl border-2 transition-colors text-left ${
              selected === value
                ? "border-sky-500 bg-sky-50"
                : "border-gray-200 bg-white hover:border-gray-300"
            }`}
          >
            <span className="text-lg font-bold text-gray-400 w-4">{value}</span>
            <div>
              <div className="font-semibold text-gray-800">{label}</div>
              <div className="text-sm text-gray-500">{description}</div>
            </div>
            <div className="ml-auto flex gap-0.5">
              {Array.from({ length: 5 }).map((_, i) => (
                <span key={i} className={`text-xs ${i < value ? "text-sky-500" : "text-gray-200"}`}>●</span>
              ))}
            </div>
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-3 w-full max-w-xs">
        <button
          onClick={() => selected && save(selected)}
          disabled={!selected || saving}
          className="w-full py-3 bg-sky-600 text-white font-semibold rounded-xl disabled:opacity-40 hover:bg-sky-700 transition-colors"
        >
          {saving ? "Saving…" : "Save & Continue"}
        </button>
        <p className="text-center text-xs text-gray-400">
          You can update this anytime from the Players page.
        </p>
      </div>
    </main>
  );
}
