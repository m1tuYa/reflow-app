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

function formatEndTime(minutesFromNow: number): string {
  const d = new Date(Date.now() + minutesFromNow * 60000);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function SortableRow({ post, onChanged }: { post: PostDTO; onChanged: () => void }) {
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
      className="flex items-center justify-between rounded border border-neutral-300 px-2 py-1 text-sm dark:border-neutral-700"
    >
      <span className="flex items-center gap-2">
        <span
          {...attributes}
          {...listeners}
          className="cursor-grab select-none text-neutral-400"
          title="ドラッグで並び替え"
        >
          ⠿
        </span>
        <span className={post.status === "done" ? "text-neutral-400 line-through" : ""}>
          {post.body}
        </span>
        {post.estimate_minutes && (
          <span className="text-xs text-neutral-500">({post.estimate_minutes}分)</span>
        )}
      </span>
      {post.status !== "done" &&
        (post.started_at ? (
          <button
            onClick={finish}
            className="rounded bg-neutral-800 px-2 py-0.5 text-xs text-white dark:bg-neutral-200 dark:text-neutral-900"
          >
            終える
          </button>
        ) : (
          <button onClick={start} className="rounded border border-neutral-400 px-2 py-0.5 text-xs">
            始める
          </button>
        ))}
    </li>
  );
}

export function TodayPromises({
  posts,
  onChanged,
}: {
  posts: PostDTO[];
  onChanged: () => void;
}) {
  const [ids, setIds] = useState(posts.map((p) => p.id));
  const sensors = useSensors(useSensor(PointerSensor));

  const byId = new Map(posts.map((p) => [p.id, p]));
  const ordered = ids.map((id) => byId.get(id)).filter((p): p is PostDTO => !!p);
  for (const p of posts) if (!ids.includes(p.id)) ordered.push(p);

  const remainingMinutes = ordered
    .filter((p) => p.status !== "done")
    .reduce((sum, p) => sum + (p.estimate_minutes ?? 0), 0);

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
    return <p className="text-sm text-neutral-500">今日の約束はありません</p>;
  }

  return (
    <div>
      <p className="mb-2 text-xs text-neutral-500">
        終了予定 {formatEndTime(remainingMinutes)} 頃(残り見積り{remainingMinutes}分)
      </p>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={ordered.map((p) => p.id)} strategy={verticalListSortingStrategy}>
          <ul className="flex flex-col gap-1">
            {ordered.map((p) => (
              <SortableRow key={p.id} post={p} onChanged={onChanged} />
            ))}
          </ul>
        </SortableContext>
      </DndContext>
    </div>
  );
}
