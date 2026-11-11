import { NextRequest, NextResponse } from "next/server";
import { reparent } from "@/lib/posts";

export async function POST(req: NextRequest) {
  const { id, newParentId } = await req.json();
  if (typeof id !== "number") {
    return NextResponse.json({ error: "id must be a number" }, { status: 400 });
  }
  if (newParentId !== null && typeof newParentId !== "number") {
    return NextResponse.json({ error: "newParentId must be a number or null" }, { status: 400 });
  }
  const post = reparent(id, newParentId);
  if (!post) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(post);
}
