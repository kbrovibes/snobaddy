"use client";

import { useEffect, useRef } from "react";

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "danger",
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "warning" | "default";
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) confirmRef.current?.focus();
  }, [open]);

  if (!open) return null;

  const btnClass =
    variant === "danger"
      ? "bg-red-600 hover:bg-red-700 text-white"
      : variant === "warning"
      ? "bg-amber-500 hover:bg-amber-600 text-white"
      : "bg-stone-900 hover:bg-stone-700 text-white";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white rounded-xl shadow-lg max-w-sm w-full p-5 flex flex-col gap-3">
        <p className="text-sm font-semibold text-stone-900">{title}</p>
        <p className="text-sm text-stone-600 leading-relaxed">{message}</p>
        <div className="flex gap-2 mt-1">
          <button
            onClick={onCancel}
            className="flex-1 py-2 text-sm font-medium text-stone-500 border border-stone-200 rounded-lg hover:bg-stone-50 transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            onClick={onConfirm}
            className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-colors ${btnClass}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
