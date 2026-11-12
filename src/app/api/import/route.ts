import { NextRequest, NextResponse } from "next/server";
import { importAll } from "@/lib/backup";

export async function POST(req: NextRequest) {
  let data: unknown;
  try {
    data = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  try {
    const counts = importAll(data);
    return NextResponse.json({ ok: true, imported: counts.posts ?? 0, counts });
  } catch (e) {
    return NextResponse.json(
      { error: "復元に失敗しました: " + (e instanceof Error ? e.message : String(e)) },
      { status: 400 }
    );
  }
}
