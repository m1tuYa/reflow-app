import { NextRequest, NextResponse } from "next/server";
import { recentTreeTips, searchForest } from "@/lib/posts";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q") ?? "";
  return NextResponse.json({
    forest: searchForest(q),
    recentTips: recentTreeTips(3),
  });
}
