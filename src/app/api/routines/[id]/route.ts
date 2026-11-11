import { NextRequest, NextResponse } from "next/server";
import { deleteRoutine } from "@/lib/posts";

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  deleteRoutine(Number(id));
  return NextResponse.json({ ok: true });
}
