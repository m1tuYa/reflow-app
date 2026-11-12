"use client";

import { TimelineItemDTO } from "@/lib/types";
import { hhmm, md } from "@/lib/format";
import { PostCard } from "./PostCard";

export function PastList({
  items,
  selectedId,
  onSelect,
  onChanged,
}: {
  items: TimelineItemDTO[];
  selectedId: number | null;
  onSelect: (id: number | null) => void;
  onChanged: () => void;
}) {
  if (items.length === 0) {
    return <p className="text-sm text-neutral-500">まだ記録がありません</p>;
  }
  return (
    <div className="flex flex-col gap-1.5">
      {items.map((it) => {
        const { post } = it;
        const isDone = post.status === "done";
        const over =
          it.actualMinutes != null &&
          post.estimate_minutes != null &&
          it.actualMinutes > post.estimate_minutes;
        const timeLabel = isDone
          ? `${post.started_at ? hhmm(post.started_at) : ""}${
              post.ended_at ? "–" + hhmm(post.ended_at) : ""
            }`
          : md(it.time);
        return (
          <PostCard
            key={post.id}
            post={post}
            selected={selectedId === post.id}
            onToggle={onSelect}
            onChanged={onChanged}
            leading={
              <div className="w-24 shrink-0 pt-0.5 text-xs tabular-nums text-neutral-500">
                {timeLabel}
              </div>
            }
            meta={
              isDone && it.actualMinutes != null ? (
                <p className="mt-0.5 text-xs text-neutral-500">
                  実績 {it.actualMinutes}分 / 見積 {post.estimate_minutes ?? "—"}分
                  {over && (
                    <span className="text-red-600 dark:text-red-400">
                      {" "}
                      (+{it.actualMinutes - (post.estimate_minutes ?? 0)}分)
                    </span>
                  )}
                </p>
              ) : null
            }
          />
        );
      })}
    </div>
  );
}
