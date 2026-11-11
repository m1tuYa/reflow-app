import { NextRequest, NextResponse } from "next/server";
import { reorderToday } from "@/lib/posts";

export async function POST(req: NextRequest) {
  const { ids } = await req.json();
  if (!Array.isArray(ids) || !ids.every((n) => typeof n === "number")) {
    return NextResponse.json({ error: "ids must be number[]" }, { status: 400 });
  }
  reorderToday(ids);
  return NextResponse.json({ ok: true });
}
