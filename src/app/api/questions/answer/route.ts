import { NextRequest, NextResponse } from "next/server";
import {
  addFollowUpPromise,
  answerVerify,
  carryOverDecision,
  closeStalled,
  markStalledAsked,
  recallAnswer,
  resolveContinuation,
  setPromiseDate,
  somedayAnswer,
  snooze,
} from "@/lib/posts";
import {
  markCarryoverShown,
  markCloseShown,
  markOrderConfirmed,
  markRecallShown,
} from "@/lib/questions";

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
    case "continuation": {
      const { id, decision } = payload; // yes | no | new
      if (decision !== "yes" && decision !== "no" && decision !== "new") {
        return NextResponse.json({ error: "invalid decision" }, { status: 400 });
      }
      resolveContinuation(id, decision);
      return NextResponse.json({ ok: true });
    }
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
    case "verify": {
      const { id, body } = payload;
      if (!body || typeof body !== "string" || !body.trim()) {
        return NextResponse.json({ error: "body is required" }, { status: 400 });
      }
      answerVerify(id, body.trim());
      return NextResponse.json({ ok: true });
    }
    case "stalled": {
      const { id, resolution, body, hasTask, taskBody, taskDate } = payload;
      if (resolution === "release") {
        closeStalled(id, "release");
        markStalledAsked(id);
        markCloseShown();
        return NextResponse.json({ ok: true });
      }
      if (resolution === "write") {
        if (!body || typeof body !== "string" || !body.trim()) {
          return NextResponse.json({ error: "body is required" }, { status: 400 });
        }
        const { conclusion } = closeStalled(id, "write", body.trim());
        markStalledAsked(id);
        markCloseShown();
        // やることはある? ある → 決定の下に約束
        if (hasTask && conclusion && taskBody && taskBody.trim()) {
          addFollowUpPromise(conclusion.id, taskBody.trim(), taskDate || null);
        }
        return NextResponse.json({ ok: true, conclusionId: conclusion?.id });
      }
      return NextResponse.json({ error: "invalid resolution" }, { status: 400 });
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
    case "someday": {
      const { id, decision, date } = payload; // do(今日/日付) | keep | cancel
      if (decision === "do") {
        setPromiseDate(id, date || todayIso());
      } else if (decision === "keep" || decision === "cancel") {
        somedayAnswer(id, decision);
      } else {
        return NextResponse.json({ error: "invalid decision" }, { status: 400 });
      }
      return NextResponse.json({ ok: true });
    }
    default:
      return NextResponse.json({ error: "unknown question type" }, { status: 400 });
  }
}
