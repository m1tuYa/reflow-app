import { NextRequest, NextResponse } from "next/server";
import { createPost, listRecent, listTodayPromises } from "@/lib/posts";

export async function GET(req: NextRequest) {
  const scope = req.nextUrl.searchParams.get("scope") ?? "recent";
  if (scope === "today") {
    const date = new Date().toISOString().slice(0, 10);
    return NextResponse.json(listTodayPromises(date));
  }
  return NextResponse.json(listRecent(50));
}

export async function POST(req: NextRequest) {
  const { body, intent, treeRootId } = await req.json();
  if (!body || typeof body !== "string" || !body.trim()) {
    return NextResponse.json({ error: "body is required" }, { status: 400 });
  }
  if (intent !== "record" && intent !== "promise") {
    return NextResponse.json({ error: "intent must be record or promise" }, { status: 400 });
  }
  const post = createPost({
    body: body.trim(),
    intent,
    treeRootId: typeof treeRootId === "number" ? treeRootId : null,
  });
  return NextResponse.json(post, { status: 201 });
}
