import { NextRequest, NextResponse } from "next/server";
import { contextForPost, getPost } from "@/lib/posts";

export async function GET(req: NextRequest) {
  const id = Number(req.nextUrl.searchParams.get("post"));
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: "post=ID required" }, { status: 400 });
  }
  const post = getPost(id);
  if (!post) return NextResponse.json({ exists: false, context: null, post: null });
  return NextResponse.json({ exists: true, context: contextForPost(id), post });
}
