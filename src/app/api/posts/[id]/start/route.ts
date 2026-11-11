import { NextRequest, NextResponse } from "next/server";
import { startPromise } from "@/lib/posts";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const post = startPromise(Number(id));
  if (!post) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(post);
}
