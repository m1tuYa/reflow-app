import { NextResponse } from "next/server";
import { getTimeline } from "@/lib/posts";

export async function GET() {
  return NextResponse.json(getTimeline());
}
