import { NextRequest, NextResponse } from "next/server";
import { carryOverDecision, recallAnswer, setPromiseDate, snooze } from "@/lib/posts";
import { markCarryoverShown, markOrderConfirmed, markRecallShown } from "@/lib/questions";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function POST(req: NextRequest) {
  const payload = await req.json();
  const { type } = payload;

  if (payload.action === "later" && typeof payload.id === "number") {
    snooze(payload.id, 4);
    return NextResponse.json({ ok: true });
  }

  switch (type) {
    case "when": {
      const { id, decision, date } = payload;
      if (decision === "today") setPromiseDate(id, todayIso());
      else if (decision === "date" && date) setPromiseDate(id, date);
      else if (decision === "someday") setPromiseDate(id, null);
      else return NextResponse.json({ error: "invalid decision" }, { status: 400 });
      return NextResponse.json({ ok: true });
    }
    case "carryover": {
      const { id, decision, date } = payload;
      if (decision !== "today" && decision !== "otherDate" && decision !== "cancel") {
        return NextResponse.json({ error: "invalid decision" }, { status: 400 });
      }
      carryOverDecision(id, decision, date);
      markCarryoverShown();
      return NextResponse.json({ ok: true });
    }
    case "morningOrder": {
      markOrderConfirmed();
      return NextResponse.json({ ok: true });
    }
    case "recall": {
      const { id, action, body } = payload;
      if (action !== "write" && action !== "skip") {
        return NextResponse.json({ error: "invalid action" }, { status: 400 });
      }
      recallAnswer(id, action, body);
      markRecallShown();
      return NextResponse.json({ ok: true });
    }
    default:
      return NextResponse.json({ error: "unknown question type" }, { status: 400 });
  }
}
