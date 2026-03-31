"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ReopenSessionButton({ sessionId }: { sessionId: string }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleReopen() {
    setLoading(true);
    await fetch(`/api/sessions/${sessionId}/reopen`, { method: "POST" });
    router.refresh();
  }

  return (
    <button
      onClick={handleReopen}
      disabled={loading}
      className="shrink-0 px-3 py-1.5 text-xs font-semibold text-blue-600 bg-white border border-blue-200 rounded-lg disabled:opacity-50 hover:bg-blue-50 transition-colors"
    >
      {loading ? "Reopening…" : "Reopen"}
    </button>
  );
}
