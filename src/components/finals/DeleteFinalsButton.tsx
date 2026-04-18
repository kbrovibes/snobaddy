"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useNavigationLoader } from "@/components/NavigationLoader";

export default function DeleteFinalsButton({ eventId }: { eventId: string }) {
  const [deleting, setDeleting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const router = useRouter();
  const { startLoading } = useNavigationLoader();

  async function handleDelete() {
    setShowConfirm(false);
    setDeleting(true);
    const res = await fetch(`/api/finals/${eventId}`, { method: "DELETE" });
    if (res.ok) {
      startLoading();
      router.push("/?list=1");
    } else {
      const json = await res.json();
      alert(json.error ?? "Could not delete");
      setDeleting(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setShowConfirm(true)}
        disabled={deleting}
        className="w-full py-2.5 text-sm font-medium text-red-400 hover:text-red-600 border border-red-100 hover:border-red-300 rounded-xl transition-colors disabled:opacity-50"
      >
        {deleting ? "Deleting…" : "Delete Finals Event"}
      </button>
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-xl shadow-lg max-w-sm w-full p-5 flex flex-col gap-3">
            <p className="text-sm font-semibold text-stone-900">Delete Finals Event</p>
            <p className="text-sm text-stone-600 leading-relaxed">
              This will permanently delete all groups, sessions, matches, and participant data. This cannot be undone.
            </p>
            <div className="flex gap-2 mt-1">
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 py-2 text-sm font-medium text-stone-500 border border-stone-200 rounded-lg hover:bg-stone-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="flex-1 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
