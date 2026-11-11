"use client";

import { useState } from "react";
import { TimelineItemDTO } from "@/lib/types";
import { hhmm, md } from "@/lib/format";
import { LinkedText } from "./LinkedText";

function Row({ item, onChanged }: { item: TimelineItemDTO; onChanged: () => void }) {
  const { post } = item;
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(post.body);

  async function save() {
    if (!value.trim()) return;
    await fetch(`/api/posts/${post.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: value.trim() }),
    });
    setEditing(false);
    onChanged();
  }
  async function remove() {
    await fetch(`/api/posts/${post.id}`, { method: "DELETE" });
    onChanged();
  }

  const isDone = post.status === "done";
  const over =
    item.actualMinutes != null &&
    post.estimate_minutes != null &&
    item.actualMinutes > post.estimate_minutes;
  const timeLabel = isDone
    ? `${post.started_at ? hhmm(post.started_at) : ""}${
        post.ended_at ? "–" + hhmm(post.ended_at) : ""
      }`
    : md(item.time);

  return (
    <div className="flex gap-3 rounded-lg border border-neutral-200 bg-white px-3 py-2 dark:border-neutral-800 dark:bg-neutral-900">
      <div className="w-24 shrink-0 pt-0.5 text-xs tabular-nums text-neutral-500">
        {timeLabel}
      </div>
      <div className="min-w-0 flex-1">
        {editing ? (
          <div className="flex flex-col gap-1">
            <textarea
              className="w-full resize-none rounded border border-neutral-400 bg-transparent p-1 text-sm outline-none"
              rows={2}
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
            <div className="flex gap-2">
              <button className="rounded border border-neutral-400 px-2 py-0.5 text-xs" onClick={save}>
                保存
              </button>
              <button
                className="rounded border border-neutral-400 px-2 py-0.5 text-xs"
                onClick={() => {
                  setEditing(false);
                  setValue(post.body);
                }}
              >
                取消
              </button>
            </div>
          </div>
        ) : (
          <>
            <LinkedText text={post.body} className="whitespace-pre-wrap text-sm" />
            {isDone && item.actualMinutes != null && (
              <p className="mt-0.5 text-xs text-neutral-500">
                実績 {item.actualMinutes}分 / 見積 {post.estimate_minutes ?? "—"}分
                {over && (
                  <span className="text-red-600 dark:text-red-400">
                    {" "}
                    (+{item.actualMinutes - (post.estimate_minutes ?? 0)}分)
                  </span>
                )}
              </p>
            )}
          </>
        )}
      </div>
      {!editing && (
        <div className="flex shrink-0 gap-2 text-xs text-neutral-400">
          <button className="hover:underline" onClick={() => setEditing(true)}>
            編集
          </button>
          <button className="hover:underline" onClick={remove}>
            削除
          </button>
        </div>
      )}
    </div>
  );
}

export function PastList({
  items,
  onChanged,
}: {
  items: TimelineItemDTO[];
  onChanged: () => void;
}) {
  if (items.length === 0) {
    return <p className="text-sm text-neutral-500">まだ記録がありません</p>;
  }
  return (
    <div className="flex flex-col gap-1.5">
      {items.map((it) => (
        <Row key={it.post.id} item={it} onChanged={onChanged} />
      ))}
    </div>
  );
}
