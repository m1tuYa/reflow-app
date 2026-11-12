"use client";

import { PostDTO } from "@/lib/types";
import { PostCard } from "./PostCard";

const STATUS_LABEL: Record<PostDTO["status"], string> = {
  record: "記録",
  promise: "約束",
  done: "済み",
  released: "手放した",
};

export function RecentFeed({
  posts,
  selectedId,
  onSelect,
  onChanged,
}: {
  posts: PostDTO[];
  selectedId: number | null;
  onSelect: (id: number | null) => void;
  onChanged: () => void;
}) {
  if (posts.length === 0) return <p className="text-sm text-neutral-500">まだありません</p>;
  return (
    <div className="flex flex-col gap-1.5">
      {posts.map((p) => (
        <PostCard
          key={p.id}
          post={p}
          selected={selectedId === p.id}
          onToggle={onSelect}
          onChanged={onChanged}
          meta={
            <p className="mt-0.5 text-xs text-neutral-500">
              {STATUS_LABEL[p.status]}
              {p.promise_date ? ` · ${p.promise_date}` : ""} · {p.created_at.slice(0, 16)}
            </p>
          }
        />
      ))}
    </div>
  );
}
