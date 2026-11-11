import { NextRequest, NextResponse } from "next/server";
import { deletePost, getPost, updatePostBody } from "@/lib/posts";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { body } = await req.json();
  if (!body || typeof body !== "string" || !body.trim()) {
    return NextResponse.json({ error: "body is required" }, { status: 400 });
  }
  const post = updatePostBody(Number(id), body.trim());
  if (!post) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(post);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const existing = getPost(Number(id));
  if (!existing) return NextResponse.json({ error: "not found" }, { status: 404 });
  deletePost(Number(id));
  return NextResponse.json({ ok: true });
}
