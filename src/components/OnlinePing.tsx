"use client";

import { useEffect } from "react";

// Fires a lightweight POST on mount to update last_seen_at for the current player.
// This is what powers the green "online" dot in the Who's Here list.
export default function OnlinePing() {
  useEffect(() => {
    fetch("/api/ping", { method: "POST" });
  }, []);
  return null;
}
