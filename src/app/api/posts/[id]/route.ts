import { NextRequest, NextResponse } from "next/server";
import { deletePost, getPost, setPromiseDate, updatePostBody } from "@/lib/posts";

// 本文の修正、または約束の日の変更(promise_date: "YYYY-MM-DD" | null=いつか)
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const payload = await req.json();
  const existing = getPost(Number(id));
  if (!existing) return NextResponse.json({ error: "not found" }, { status: 404 });

  if ("promise_date" in payload) {
    const d = payload.promise_date;
    if (d !== null && (typeof d !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(d))) {
      return NextResponse.json({ error: "promise_date must be YYYY-MM-DD or null" }, { status: 400 });
    }
    if (existing.status !== "promise") {
      return NextResponse.json({ error: "not a promise" }, { status: 400 });
    }
    return NextResponse.json(setPromiseDate(Number(id), d));
  }

  const { body } = payload;
  if (!body || typeof body !== "string" || !body.trim()) {
    return NextResponse.json({ error: "body is required" }, { status: 400 });
  }
  return NextResponse.json(updatePostBody(Number(id), body.trim()));
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const existing = getPost(Number(id));
  if (!existing) return NextResponse.json({ error: "not found" }, { status: 404 });
  deletePost(Number(id));
  return NextResponse.json({ ok: true });
}
