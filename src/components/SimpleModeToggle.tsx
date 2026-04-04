"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function SimpleModeToggle({
  sessionId,
  simpleMode,
}: {
  sessionId: string;
  simpleMode: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function toggle() {
    setLoading(true);
    await fetch(`/api/sessions/${sessionId}/simple-mode`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ simple_score_tracking: !simpleMode }),
    });
    router.refresh();
    setLoading(false);
  }

  return (
    <button
      onClick={toggle}
      disabled={loading}
      title={simpleMode ? "Switch to full score entry mode" : "Switch to simple win/loss mode"}
      className={`text-xs font-semibold px-2.5 py-1 rounded-full transition-colors disabled:opacity-50 ${
        simpleMode
          ? "bg-blue-100 text-blue-700 hover:bg-blue-200"
          : "bg-gray-100 text-gray-500 hover:bg-gray-200"
      }`}
    >
      {simpleMode ? "✓ Simplify Scores" : "Simplify Scores"}
    </button>
  );
}
