import { NextRequest, NextResponse } from "next/server";
import { proposeNextMatches } from "@/lib/db/proposed";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const result = await proposeNextMatches(id);
  return NextResponse.json(result);
}
