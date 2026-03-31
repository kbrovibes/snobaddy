import { NextRequest, NextResponse } from "next/server";
import { proposeNextMatches } from "@/lib/db/proposed";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const result = await proposeNextMatches(params.id);
  return NextResponse.json(result);
}
