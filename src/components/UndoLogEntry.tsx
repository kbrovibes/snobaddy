"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function UndoLogEntry({ sessionId, logId }: { sessionId: string; logId: string }) {
  const router = useRouter();
  const [undoing, setUndoing] = useState(false);
  const [done, setDone] = useState(false);

  async function undo() {
    if (undoing || done) return;
    setUndoing(true);
    const res = await fetch(`/api/sessions/${sessionId}/tally/log/${logId}`, { method: "DELETE" });
    if (res.ok) {
      setDone(true);
      router.refresh();
    }
    setUndoing(false);
  }

  if (done) return <span className="text-[10px] text-stone-400">undone</span>;

  return (
    <button
      onClick={undo}
      disabled={undoing}
      className="text-[10px] text-stone-400 hover:text-red-500 active:text-red-600 transition-colors disabled:opacity-50 shrink-0"
    >
      {undoing ? "..." : "undo"}
    </button>
  );
}
