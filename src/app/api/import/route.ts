import { NextRequest, NextResponse } from "next/server";
import { importPosts } from "@/lib/posts";

export async function POST(req: NextRequest) {
  let data: unknown;
  try {
    data = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  const posts = Array.isArray(data) ? data : null;
  if (!posts) {
    return NextResponse.json(
      { error: "書き出した投稿の配列(JSON)を渡してください" },
      { status: 400 }
    );
  }
  try {
    const n = importPosts(posts);
    return NextResponse.json({ ok: true, imported: n });
  } catch (e) {
    return NextResponse.json(
      { error: "復元に失敗しました: " + (e instanceof Error ? e.message : String(e)) },
      { status: 400 }
    );
  }
}
