"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function TestSessionToggle({
  sessionId,
  isTestSession,
}: {
  sessionId: string;
  isTestSession: boolean;
}) {
  const [value, setValue] = useState(isTestSession);
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  async function toggle() {
    if (saving) return;
    const next = !value;
    setValue(next);
    setSaving(true);
    await fetch(`/api/sessions/${sessionId}/test-session`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_test_session: next }),
    });
    setSaving(false);
    router.refresh();
  }

  return (
    <button
      onClick={toggle}
      disabled={saving}
      className="flex items-center gap-2 disabled:opacity-50"
      title="Toggle test session"
    >
      <span className="text-xs text-gray-500">Test</span>
      <span className={`relative inline-flex w-9 h-5 rounded-full transition-colors duration-200 ${value ? "bg-orange-400" : "bg-gray-200"}`}>
        <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${value ? "translate-x-4" : "translate-x-0"}`} />
      </span>
    </button>
  );
}
