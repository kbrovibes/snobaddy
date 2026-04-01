import { NextRequest, NextResponse } from "next/server";
import { deleteProposedMatch } from "@/lib/db/proposed";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await deleteProposedMatch(id);
  return NextResponse.json({ success: true });
}
