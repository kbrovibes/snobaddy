import { getAllPlayers } from "@/lib/db/players";
import { NextResponse } from "next/server";

export async function GET() {
  const players = await getAllPlayers();
  return NextResponse.json(players);
}
