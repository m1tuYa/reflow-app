import { NextRequest, NextResponse } from "next/server";
import { getTree, renameTree } from "@/lib/posts";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ root: string }> }) {
  const { root } = await params;
  const tree = getTree(Number(root));
  if (!tree) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(tree);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ root: string }> }) {
  const { root } = await params;
  const { name } = await req.json();
  if (typeof name !== "string") {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }
  const post = renameTree(Number(root), name);
  if (!post) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(post);
}
