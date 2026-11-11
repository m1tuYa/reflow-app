"use client";

import { useState } from "react";
import { PostDTO } from "@/lib/types";

const STATUS_LABEL: Record<PostDTO["status"], string> = {
  record: "記録",
  promise: "約束",
  done: "済み",
  released: "手放した",
};

function Row({ post, onChanged }: { post: PostDTO; onChanged: () => void }) {
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

  return (
    <li className="rounded border border-neutral-200 p-2 text-sm dark:border-neutral-800">
      <div className="mb-1 flex items-center justify-between text-xs text-neutral-500">
        <span>
          {STATUS_LABEL[post.status]}
          {post.promise_date ? ` · ${post.promise_date}` : ""} · {post.created_at.slice(0, 16)}
        </span>
        {!editing && (
          <span className="flex gap-2">
            <button className="underline" onClick={() => setEditing(true)}>
              編集
            </button>
            <button className="underline" onClick={remove}>
              削除
            </button>
          </span>
        )}
      </div>
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
        <p className="whitespace-pre-wrap">{post.body}</p>
      )}
    </li>
  );
}

export function RecentFeed({ posts, onChanged }: { posts: PostDTO[]; onChanged: () => void }) {
  if (posts.length === 0) return <p className="text-sm text-neutral-500">まだありません</p>;
  return (
    <ul className="flex flex-col gap-2">
      {posts.map((p) => (
        <Row key={p.id} post={p} onChanged={onChanged} />
      ))}
    </ul>
  );
}
