"use client";

import { useEffect, useState } from "react";
import { PostDTO, TreeNodeDTO } from "@/lib/types";
import { md } from "@/lib/format";

// 「効いた?」に答えるための文脈: 決定と、そこから生まれた約束の見積もりと実績
export function VerifySummary({
  rootId,
  decisionId,
  reloadKey,
}: {
  rootId: number;
  decisionId: number;
  reloadKey: number;
}) {
  const [tree, setTree] = useState<TreeNodeDTO | null>(null);

  useEffect(() => {
    fetch(`/api/tree/${rootId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setTree);
  }, [rootId, reloadKey]);

  if (!tree) return null;
  const decision = findNode(tree, decisionId);
  if (!decision) return null;

  const promises = descendants(decision).filter(
    (p) => p.status === "promise" || p.status === "done" || p.status === "released"
  );
  const done = promises.filter((p) => p.status === "done");
  const est = done.reduce((s, p) => s + (p.estimate_minutes ?? 0), 0);
  const act = done.reduce((s, p) => s + (actual(p) ?? 0), 0);

  return (
    <div className="mb-4 rounded-lg border border-emerald-300 bg-emerald-50/60 p-3 text-sm dark:border-emerald-800 dark:bg-emerald-950/30">
      <p className="mb-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
        決めたこと · {md(decision.post.created_at)}
      </p>
      <p className="mb-3 whitespace-pre-wrap">{decision.post.body}</p>

      <p className="mb-1 text-xs font-semibold text-neutral-500">
        生まれた約束 {promises.length}件
        {promises.length > 0 && ` · 済み${done.length}件`}
      </p>
      {promises.length === 0 ? (
        <p className="text-xs text-neutral-500">この決定から生まれた約束はありません</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {promises.map((p) => {
            const a = actual(p);
            const over = a != null && p.estimate_minutes != null && a > p.estimate_minutes;
            return (
              <li key={p.id} className="flex items-start gap-2 text-xs">
                <span
                  className={`shrink-0 rounded px-1 ${
                    p.status === "done"
                      ? "bg-emerald-600 text-white"
                      : p.status === "released"
                        ? "bg-neutral-300 text-neutral-700 dark:bg-neutral-700 dark:text-neutral-200"
                        : "border border-neutral-400"
                  }`}
                >
                  {p.status === "done" ? "済み" : p.status === "released" ? "やめた" : "未"}
                </span>
                <span className="min-w-0 flex-1">{p.body}</span>
                <span className="shrink-0 tabular-nums text-neutral-500">
                  {p.status === "done"
                    ? `実績${a ?? "—"}分 / 見積${p.estimate_minutes ?? "—"}分`
                    : p.promise_date
                      ? `${md(p.promise_date)}予定`
                      : "いつか"}
                  {over && (
                    <span className="text-red-600 dark:text-red-400">
                      {" "}
                      (+{a! - p.estimate_minutes!}分)
                    </span>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      )}
      {done.length > 0 && (
        <p className="mt-2 text-xs text-neutral-500">
          済んだ分の合計: 実績{act}分 / 見積{est}分
        </p>
      )}
    </div>
  );
}

function actual(p: PostDTO): number | null {
  if (!p.started_at || !p.ended_at) return null;
  return Math.round((new Date(p.ended_at).getTime() - new Date(p.started_at).getTime()) / 60000);
}

function descendants(n: TreeNodeDTO): PostDTO[] {
  return n.children.flatMap((c) => [c.post, ...descendants(c)]);
}

function findNode(n: TreeNodeDTO, id: number): TreeNodeDTO | null {
  if (n.post.id === id) return n;
  for (const c of n.children) {
    const f = findNode(c, id);
    if (f) return f;
  }
  return null;
}
