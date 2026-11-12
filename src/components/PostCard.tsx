"use client";

import { ReactNode, useState } from "react";
import { PostDTO } from "@/lib/types";
import { shiftDate, dateStrOf } from "@/lib/format";
import { LinkedText } from "./LinkedText";
import { useCardActions } from "./CardActions";

// 選択できるカード。選択中だけ操作(編集/削除/変換)を出す。
export function PostCard({
  post,
  selected,
  onToggle,
  onChanged,
  leading,
  meta,
  trailing,
  extraActions,
}: {
  post: PostDTO;
  selected: boolean;
  onToggle: (id: number | null) => void;
  onChanged: () => void;
  leading?: ReactNode;
  meta?: ReactNode;
  trailing?: ReactNode;
  extraActions?: ReactNode;
}) {
  const [editing, setEditing] = useState(false);
  const [dating, setDating] = useState(false);
  const [value, setValue] = useState(post.body);
  const { requestConnect } = useCardActions();

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
  async function convert() {
    const to = post.status === "record" ? "promise" : "record";
    await fetch(`/api/posts/${post.id}/convert`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to }),
    });
    onChanged();
  }

  async function setDate(date: string | null) {
    await fetch(`/api/posts/${post.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ promise_date: date }),
    });
    setDating(false);
    onChanged();
  }

  const today = dateStrOf(new Date().toISOString());
  const canConvert = post.status === "record" || post.status === "promise";
  const convertLabel = post.status === "record" ? "未来へ置く" : "記録にする";

  return (
    <div
      className={`rounded-lg border bg-white px-3 py-2 dark:bg-neutral-900 ${
        selected
          ? "border-blue-500 ring-1 ring-blue-500"
          : "border-neutral-200 dark:border-neutral-800"
      }`}
    >
      <div
        className="flex cursor-pointer gap-3"
        onClick={() => !editing && onToggle(selected ? null : post.id)}
      >
        {leading}
        <div className="min-w-0 flex-1">
          {editing ? (
            <div className="flex flex-col gap-1" onClick={(e) => e.stopPropagation()}>
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
              {meta}
            </>
          )}
        </div>
        {trailing}
      </div>

      {selected && !editing && dating && (
        <div
          className="mt-2 flex flex-wrap items-center gap-2 border-t border-neutral-100 pt-2 text-xs dark:border-neutral-800"
          onClick={(e) => e.stopPropagation()}
        >
          <span className="text-neutral-500">いつやる?</span>
          <ActionButton onClick={() => setDate(today)}>今日</ActionButton>
          <ActionButton onClick={() => setDate(shiftDate(today, 1))}>明日</ActionButton>
          <input
            type="date"
            defaultValue={post.promise_date ?? ""}
            onChange={(e) => e.target.value && setDate(e.target.value)}
            className="rounded border border-neutral-300 bg-transparent px-1 py-0.5 outline-none dark:border-neutral-700"
          />
          <ActionButton onClick={() => setDate(null)}>いつか</ActionButton>
          <button className="text-neutral-500 underline" onClick={() => setDating(false)}>
            やめる
          </button>
        </div>
      )}

      {selected && !editing && !dating && (
        <div
          className="mt-2 flex flex-wrap gap-2 border-t border-neutral-100 pt-2 text-xs dark:border-neutral-800"
          onClick={(e) => e.stopPropagation()}
        >
          {extraActions}
          {post.status === "promise" && (
            <ActionButton onClick={() => setDating(true)}>日付を変える</ActionButton>
          )}
          <ActionButton onClick={() => requestConnect(post.id)}>
            {post.parent_id == null ? "木につなぐ" : "つなぎ直す"}
          </ActionButton>
          <ActionButton onClick={() => setEditing(true)}>編集</ActionButton>
          {canConvert && <ActionButton onClick={convert}>{convertLabel}</ActionButton>}
          <ActionButton onClick={remove}>削除</ActionButton>
        </div>
      )}
    </div>
  );
}

export function ActionButton({
  onClick,
  children,
}: {
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded border border-neutral-300 px-2 py-0.5 hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
    >
      {children}
    </button>
  );
}
