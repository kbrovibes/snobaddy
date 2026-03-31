import { NextRequest, NextResponse } from "next/server";
import { deleteProposedMatch } from "@/lib/db/proposed";

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  await deleteProposedMatch(params.id);
  return NextResponse.json({ success: true });
}
