"use client";

import { useState } from "react";
import { PostDTO } from "@/lib/types";

function Item({ post, onChanged }: { post: PostDTO; onChanged: () => void }) {
  const [showDate, setShowDate] = useState(false);
  const [date, setDate] = useState("");

  async function decide(decision: "today" | "otherDate" | "cancel", d?: string) {
    await fetch("/api/questions/answer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "carryover", id: post.id, decision, date: d }),
    });
    onChanged();
  }

  return (
    <div className="flex items-center justify-between gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 dark:border-amber-800/60 dark:bg-amber-950/30">
      <div className="min-w-0">
        <p className="truncate text-sm">{post.body}</p>
        <p className="text-xs text-neutral-500">{post.promise_date} から持ち越し</p>
      </div>
      <div className="flex shrink-0 items-center gap-1 text-xs">
        {showDate ? (
          <>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="rounded border border-neutral-400 bg-transparent px-1 outline-none"
            />
            <button
              className="rounded border border-neutral-400 px-2 py-1"
              onClick={() => date && decide("otherDate", date)}
            >
              決定
            </button>
          </>
        ) : (
          <>
            <button
              className="rounded border border-neutral-400 px-2 py-1"
              onClick={() => decide("today")}
            >
              今日やる
            </button>
            <button
              className="rounded border border-neutral-400 px-2 py-1"
              onClick={() => setShowDate(true)}
            >
              未来へ投げる
            </button>
            <button
              className="rounded border border-neutral-400 px-2 py-1"
              onClick={() => decide("cancel")}
            >
              捨てる
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export function CarryoverPile({ posts, onChanged }: { posts: PostDTO[]; onChanged: () => void }) {
  if (posts.length === 0) return null;
  return (
    <div>
      <p className="mb-1 text-xs font-medium text-neutral-500">
        いま線に溜まっている — 選ばないと消えない
      </p>
      <div className="flex flex-col gap-1.5">
        {posts.map((p) => (
          <Item key={p.id} post={p} onChanged={onChanged} />
        ))}
      </div>
    </div>
  );
}
