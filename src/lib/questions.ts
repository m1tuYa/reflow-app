import { getDb, Post } from "./db";
import {
  continuationCandidate,
  listDueSomeday,
  listDueVerifications,
  listNeedsContinuation,
  listOverduePromises,
  listStalledTips,
  listTodayPromises,
  rootOf,
  snooze,
} from "./posts";

const MORNING_CARRYOVER_CAP = 5;
const DAYTIME_RECALL_CAP = 3;
const CLOSE_CAP = 1; // 閉じる問い(どうなった?)の上限 1日1件

type DailyState = {
  date: string;
  carryover_shown: number;
  order_confirmed_at: string | null;
  recall_shown: number;
  close_shown: number;
};

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function ensureDailyState(date: string): DailyState {
  const db = getDb();
  db.prepare(`INSERT OR IGNORE INTO daily_state (date) VALUES (?)`).run(date);
  return db.prepare(`SELECT * FROM daily_state WHERE date = ?`).get(date) as DailyState;
}

function isSnoozed(post: Post): boolean {
  return !!post.snoozed_until && post.snoozed_until > new Date().toISOString();
}

export type Question =
  | { type: "continuation"; post: Post; candidate: Post } // これは〇〇の続き?
  | { type: "when"; post: Post }
  | { type: "carryover"; post: Post }
  | { type: "morningOrder"; posts: Post[] }
  | { type: "verify"; post: Post } // あの決めたことは効いた?
  | { type: "stalled"; post: Post } // この考え、どうなった?
  | { type: "recall"; post: Post }
  | { type: "someday"; post: Post }; // まだやりたい?

// 優先順位(設計書):
//  書いた直後(続き?/いつやる?) > 約束に関わる持ち越し > 確かめる日 > 止まった枝 > 過去の戻り
export function buildQueue(): Question[] {
  const db = getDb();
  const date = todayIso();
  const state = ensureDailyState(date);
  const queue: Question[] = [];

  // 書いた直後: これは〇〇の続き?(つなげる木があるときだけ)
  for (const p of listNeedsContinuation().filter((p) => !isSnoozed(p))) {
    const cand = continuationCandidate(p);
    if (cand) queue.push({ type: "continuation", post: p, candidate: cand });
  }

  // 書いた直後: いつやる?
  const undetermined = (
    db
      .prepare(`SELECT * FROM posts WHERE status='promise' AND date_undetermined=1`)
      .all() as Post[]
  ).filter((p) => !isSnoozed(p));
  for (const p of undetermined) queue.push({ type: "when", post: p });

  // 朝: 持ち越し判断
  const overdue = listOverduePromises(date).filter((p) => !isSnoozed(p));
  const carryoverRoom = Math.max(0, MORNING_CARRYOVER_CAP - state.carryover_shown);
  const shownOverdue = overdue.slice(0, carryoverRoom);
  for (const p of shownOverdue) queue.push({ type: "carryover", post: p });

  // 朝: 順番確認
  const todays = listTodayPromises(date);
  if (!state.order_confirmed_at && todays.length > 0 && overdue.length <= shownOverdue.length) {
    queue.push({ type: "morningOrder", posts: todays });
  }

  // 確かめる日: 効いた?
  for (const p of listDueVerifications().filter((p) => !isSnoozed(p))) {
    queue.push({ type: "verify", post: p });
  }

  // 止まった枝: どうなった?(1日1件)
  if (state.close_shown < CLOSE_CAP) {
    const stalled = listStalledTips().filter((p) => !isSnoozed(p));
    if (stalled[0]) queue.push({ type: "stalled", post: stalled[0] });
  }

  // 過去の戻り: 今はどう思う?
  const dueRecall = (
    db
      .prepare(
        `SELECT * FROM posts WHERE next_recall_at IS NOT NULL AND next_recall_at <= ? ORDER BY next_recall_at ASC`
      )
      .all(new Date().toISOString()) as Post[]
  ).filter((p) => !isSnoozed(p));
  const recallRoom = Math.max(0, DAYTIME_RECALL_CAP - state.recall_shown);
  for (const p of dueRecall.slice(0, recallRoom)) queue.push({ type: "recall", post: p });

  // いつか: まだやりたい?(最もおだやかなので最後)
  for (const p of listDueSomeday().filter((p) => !isSnoozed(p))) {
    queue.push({ type: "someday", post: p });
  }

  return queue;
}

export type QuestionContext = { rootId: number; focusId: number; highlightId?: number } | null;

// その問いに答えるために右へ出す文脈(木とその注目ノード)
function contextFor(q: Question): QuestionContext {
  switch (q.type) {
    case "continuation":
      return { rootId: q.candidate.id, focusId: q.candidate.id, highlightId: q.candidate.id };
    case "recall":
    case "stalled":
    case "verify": {
      const root = rootOf(q.post.id);
      // 根が投稿自身でなければ、その投稿の親を見出しにして周辺を見せる
      const parent = q.post.parent_id ?? q.post.id;
      return {
        rootId: root,
        focusId: root === q.post.id ? q.post.id : parent,
        highlightId: q.post.id,
      };
    }
    default:
      return null; // when/carryover/morningOrder/someday は森のまま
  }
}

export function getCurrentQuestion(): {
  question: Question | null;
  remaining: number;
  context: QuestionContext;
} {
  const queue = buildQueue();
  const question = queue[0] ?? null;
  return {
    question,
    remaining: Math.max(0, queue.length - 1),
    context: question ? contextFor(question) : null,
  };
}

export function markCarryoverShown(): void {
  const date = todayIso();
  ensureDailyState(date);
  getDb()
    .prepare(`UPDATE daily_state SET carryover_shown = carryover_shown + 1 WHERE date = ?`)
    .run(date);
}

export function markOrderConfirmed(): void {
  const date = todayIso();
  ensureDailyState(date);
  getDb()
    .prepare(`UPDATE daily_state SET order_confirmed_at = ? WHERE date = ?`)
    .run(new Date().toISOString(), date);
}

export function markRecallShown(): void {
  const date = todayIso();
  ensureDailyState(date);
  getDb()
    .prepare(`UPDATE daily_state SET recall_shown = recall_shown + 1 WHERE date = ?`)
    .run(date);
}

export function markCloseShown(): void {
  const date = todayIso();
  ensureDailyState(date);
  getDb()
    .prepare(`UPDATE daily_state SET close_shown = close_shown + 1 WHERE date = ?`)
    .run(date);
}

export function snoozeQuestion(question: Question): void {
  if (question.type === "morningOrder") return;
  snooze(question.post.id, 4);
}
