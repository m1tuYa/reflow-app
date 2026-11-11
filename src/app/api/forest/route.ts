import { NextResponse } from "next/server";
import { listForest, recentTreeTips } from "@/lib/posts";

export async function GET() {
  return NextResponse.json({
    forest: listForest(),
    recentTips: recentTreeTips(3),
  });
}
