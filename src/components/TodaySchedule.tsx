"use client";

import { PostDTO } from "@/lib/types";
import { hhmm, hhmmAfter } from "@/lib/format";

// 朝の問いに答えるための文脈: 今日の予定の時間帯と終了予定
export function TodaySchedule({
  label,
  now,
  posts,
  overdue,
}: {
  label: string;
  now: string;
  posts: PostDTO[];
  overdue: PostDTO[];
}) {
  const rows: { p: PostDTO; start: string; end: string; est: number }[] = [];
  let cursor = now ? new Date(now).getTime() : 0;
  for (const p of posts) {
    const est = p.estimate_minutes ?? 0;
    const start = new Date(cursor).toISOString();
    cursor += est * 60000;
    rows.push({ p, start, end: new Date(cursor).toISOString(), est });
  }
  const total = rows.reduce((s, r) => s + r.est, 0);
  const noEstimate = posts.filter((p) => p.estimate_minutes == null).length;

  return (
    <div>
      <p className="mb-2 text-xs text-blue-700 dark:text-blue-400">{label}</p>
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-sm font-semibold">今日の予定</h2>
        <span className="text-xs text-neutral-500">
          合計 {total}分 · 終了予定 {now ? hhmmAfter(now, total) : "—"}
        </span>
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-neutral-500">今日この後の約束はありません</p>
      ) : (
        <ol className="flex flex-col gap-1">
          {rows.map(({ p, start, end, est }) => (
            <li
              key={p.id}
              className="flex items-center gap-3 rounded border border-neutral-200 px-2 py-1.5 text-sm dark:border-neutral-800"
            >
              <span className="w-24 shrink-0 text-xs tabular-nums text-neutral-500">
                {est > 0 && now ? `${hhmm(start)}–${hhmm(end)}` : "見積なし"}
              </span>
              <span className="min-w-0 flex-1 truncate">{p.body}</span>
            </li>
          ))}
        </ol>
      )}
      {noEstimate > 0 && (
        <p className="mt-2 text-xs text-neutral-500">見積もりのない約束が{noEstimate}件あります</p>
      )}
      {overdue.length > 0 && (
        <>
          <h3 className="mb-1 mt-4 text-xs font-semibold text-amber-700 dark:text-amber-400">
            持ち越し {overdue.length}件
          </h3>
          <ul className="flex flex-col gap-1">
            {overdue.map((p) => (
              <li key={p.id} className="truncate text-xs text-neutral-600 dark:text-neutral-400">
                {p.promise_date} · {p.body}
                {p.estimate_minutes != null ? ` (${p.estimate_minutes}分)` : ""}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
