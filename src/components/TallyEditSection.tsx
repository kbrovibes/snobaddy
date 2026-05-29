"use client";

import { useState } from "react";
import TallyScoreboard from "@/components/TallyScoreboard";
import TallyEntryForm from "@/components/TallyEntryForm";
import type { TallyEntry } from "@/lib/db/tally";

interface Props {
  entries: TallyEntry[];
  sessionId: string;
  isGodMode: boolean;
  hasPhoto: boolean;
  allPlayers: { id: string; name: string }[];
  isAdmin: boolean;
}

export default function TallyEditSection({
  entries,
  sessionId,
  isGodMode,
  hasPhoto,
  allPlayers,
  isAdmin,
}: Props) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <TallyEntryForm
        sessionId={sessionId}
        allPlayers={allPlayers}
        isGodMode={isAdmin}
        isEdit
        initialEntries={entries}
        onDone={() => setEditing(false)}
      />
    );
  }

  return (
    <TallyScoreboard
      entries={entries}
      sessionId={sessionId}
      isGodMode={isGodMode}
      hasPhoto={hasPhoto}
      canEdit={isAdmin}
      onEdit={() => setEditing(true)}
    />
  );
}
