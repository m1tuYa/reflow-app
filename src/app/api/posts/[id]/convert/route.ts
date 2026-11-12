import { NextRequest, NextResponse } from "next/server";
import { convertPost } from "@/lib/posts";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { to } = await req.json();
  if (to !== "promise" && to !== "record") {
    return NextResponse.json({ error: "to must be promise or record" }, { status: 400 });
  }
  const post = convertPost(Number(id), to);
  if (!post) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(post);
}
