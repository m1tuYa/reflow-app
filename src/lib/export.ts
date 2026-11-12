import { Post, Routine } from "./db";

const STATUS_LABEL: Record<Post["status"], string> = {
  record: "記録",
  promise: "約束",
  done: "済み",
  released: "手放した",
};

export function toMarkdown(posts: Post[], routines: Routine[] = []): string {
  const lines: string[] = ["# 往還 書き出し", ""];
  for (const p of posts) {
    const meta: string[] = [STATUS_LABEL[p.status], p.created_at];
    if (p.promise_date) meta.push(`予定:${p.promise_date}`);
    if (p.estimate_minutes) meta.push(`見積:${p.estimate_minutes}分`);
    if (p.started_at) meta.push(`開始:${p.started_at}`);
    if (p.ended_at) meta.push(`終了:${p.ended_at}`);
    if (p.parent_id) meta.push(`親:#${p.parent_id}`);
    lines.push(`## #${p.id} (${meta.join(" / ")})`);
    lines.push("");
    lines.push(p.body);
    lines.push("");
  }
  if (routines.length > 0) {
    lines.push("# ルーチン", "");
    for (const r of routines) {
      const meta = [`${r.interval_days}日ごと`, `次回:${r.next_run}`];
      if (r.estimate_minutes) meta.push(`見積:${r.estimate_minutes}分`);
      if (!r.active) meta.push("停止中");
      lines.push(`- ${r.body} (${meta.join(" / ")})`);
    }
    lines.push("");
  }
  return lines.join("\n");
}
