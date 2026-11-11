"use client";

import { useState } from "react";
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { PostDTO } from "@/lib/types";
import { hhmm } from "@/lib/format";

function SortableRow({
  post,
  rangeLabel,
  onChanged,
}: {
  post: PostDTO;
  rangeLabel: string;
  onChanged: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: post.id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  async function start() {
    await fetch(`/api/posts/${post.id}/start`, { method: "POST" });
    onChanged();
  }
  async function finish() {
    await fetch(`/api/posts/${post.id}/finish`, { method: "POST" });
    onChanged();
  }

  return (
    <li
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm dark:border-neutral-800 dark:bg-neutral-900"
    >
      <span
        {...attributes}
        {...listeners}
        className="cursor-grab select-none text-neutral-300"
        title="ドラッグで並び替え"
      >
        ⠿
      </span>
      <span className="w-24 shrink-0 text-xs tabular-nums text-neutral-500">{rangeLabel}</span>
      <span className="min-w-0 flex-1 truncate">{post.body}</span>
      {post.estimate_minutes != null && (
        <span className="shrink-0 text-xs text-neutral-500">{post.estimate_minutes}分</span>
      )}
      {post.started_at ? (
        <button
          onClick={finish}
          className="shrink-0 rounded bg-neutral-800 px-2 py-0.5 text-xs text-white dark:bg-neutral-200 dark:text-neutral-900"
        >
          終える
        </button>
      ) : (
        <button
          onClick={start}
          className="shrink-0 rounded border border-neutral-400 px-2 py-0.5 text-xs"
        >
          始める
        </button>
      )}
    </li>
  );
}

export function TodayPromises({
  posts,
  now,
  onChanged,
}: {
  posts: PostDTO[];
  now: string;
  onChanged: () => void;
}) {
  const [ids, setIds] = useState(posts.map((p) => p.id));
  const sensors = useSensors(useSensor(PointerSensor));

  const byId = new Map(posts.map((p) => [p.id, p]));
  const ordered = ids.map((id) => byId.get(id)).filter((p): p is PostDTO => !!p);
  for (const p of posts) if (!ids.includes(p.id)) ordered.push(p);

  // 予測の時間帯: いまを起点に、見積もりを積み上げて各約束の帯を出す
  let cursor = new Date(now).getTime();
  const ranges = new Map<number, string>();
  for (const p of ordered) {
    const est = p.estimate_minutes ?? 0;
    const startIso = new Date(cursor).toISOString();
    const endIso = new Date(cursor + est * 60000).toISOString();
    ranges.set(p.id, est > 0 ? `${hhmm(startIso)}–${hhmm(endIso)}` : "");
    cursor += est * 60000;
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = ordered.findIndex((p) => p.id === active.id);
    const newIndex = ordered.findIndex((p) => p.id === over.id);
    const newOrder = arrayMove(ordered, oldIndex, newIndex).map((p) => p.id);
    setIds(newOrder);
    await fetch("/api/posts/reorder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: newOrder }),
    });
  }

  if (posts.length === 0) {
    return <p className="text-sm text-neutral-500">今日この後の約束はありません</p>;
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={ordered.map((p) => p.id)} strategy={verticalListSortingStrategy}>
        <ul className="flex flex-col gap-1.5">
          {ordered.map((p) => (
            <SortableRow
              key={p.id}
              post={p}
              rangeLabel={ranges.get(p.id) ?? ""}
              onChanged={onChanged}
            />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}
