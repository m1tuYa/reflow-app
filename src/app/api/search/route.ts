import { NextRequest, NextResponse } from "next/server";
import { search } from "@/lib/posts";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q") ?? "";
  if (!q.trim()) return NextResponse.json([]);
  try {
    return NextResponse.json(search(q.trim()));
  } catch {
    return NextResponse.json([]);
  }
}
