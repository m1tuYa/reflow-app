import { NextResponse } from "next/server";
import { getCurrentQuestion } from "@/lib/questions";

export async function GET() {
  return NextResponse.json(getCurrentQuestion());
}
