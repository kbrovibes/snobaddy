import { NextRequest, NextResponse } from "next/server";
import { deleteProposedMatch, backfillMatchQueue } from "@/lib/db/proposed";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const sessionId = await deleteProposedMatch(id);
  if (sessionId) backfillMatchQueue(sessionId).catch(() => {});
  return NextResponse.json({ success: true });
}
