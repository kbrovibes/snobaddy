/** Verified account badge — Instagram-style blue circle with white checkmark */
export function VerifiedBadge() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      className="inline-block w-3.5 h-3.5 shrink-0 align-middle ml-1"
      aria-label="Verified account"
      role="img"
    >
      <circle cx="10" cy="10" r="10" fill="#3B82F6" />
      <path
        d="M6 10.5l2.5 2.5 5.5-5.5"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

/** Admin badge */
export function AdminBadge() {
  return (
    <span className="text-xs shrink-0 ml-1" title="Admin">🛡️</span>
  );
}
