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
      className="w-full py-2.5 text-sm font-semibold text-white bg-sky-600 dark:bg-sky-600 rounded-xl disabled:opacity-50 hover:bg-sky-500 dark:hover:bg-sky-500 transition-colors"
    >
      {loading ? "Reopening…" : "Reopen Session"}
    </button>
  );
}
