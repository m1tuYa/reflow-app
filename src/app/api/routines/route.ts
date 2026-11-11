import { NextRequest, NextResponse } from "next/server";
import { createRoutine, listRoutines } from "@/lib/posts";

export async function GET() {
  return NextResponse.json(listRoutines());
}

export async function POST(req: NextRequest) {
  const { body, estimateMinutes, intervalDays, firstRun } = await req.json();
  if (!body || typeof body !== "string" || !body.trim()) {
    return NextResponse.json({ error: "body is required" }, { status: 400 });
  }
  const interval = Number(intervalDays);
  if (!Number.isFinite(interval) || interval < 1) {
    return NextResponse.json({ error: "intervalDays must be >= 1" }, { status: 400 });
  }
  const routine = createRoutine({
    body: body.trim(),
    estimateMinutes: estimateMinutes != null ? Number(estimateMinutes) : null,
    intervalDays: Math.round(interval),
    firstRun: typeof firstRun === "string" ? firstRun : undefined,
  });
  return NextResponse.json(routine, { status: 201 });
}
