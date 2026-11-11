"use client";

import { useCallback, useEffect, useState } from "react";
import { ForestEntryDTO, TreeNodeDTO } from "@/lib/types";

export function ContextPane({ reloadKey, onChanged }: { reloadKey: number; onChanged: () => void }) {
  const [forest, setForest] = useState<ForestEntryDTO[]>([]);
  const [openRoot, setOpenRoot] = useState<number | null>(null);

  const loadForest = useCallback(() => {
    fetch("/api/forest")
      .then((r) => r.json())
      .then((d) => setForest(d.forest ?? []));
  }, []);

  useEffect(() => {
    loadForest();
  }, [loadForest, reloadKey]);

  if (openRoot != null) {
    return (
      <TreeView
        rootId={openRoot}
        reloadKey={reloadKey}
        onBack={() => setOpenRoot(null)}
        onChanged={() => {
          loadForest();
          onChanged();
        }}
      />
    );
  }

  return (
    <div>
      <h2 className="mb-3 text-sm font-semibold text-neutral-500">森</h2>
      {forest.length === 0 ? (
        <p className="text-sm text-neutral-500">
          まだ木がありません。考えを書くと、ここに育っていきます。
        </p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {forest.map((e) => (
            <li key={e.root.id}>
              <button
                onClick={() => setOpenRoot(e.root.id)}
                className={`flex w-full items-center justify-between rounded border px-3 py-2 text-left text-sm transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800 ${
                  e.stalled
                    ? "border-neutral-200 text-neutral-400 dark:border-neutral-800"
                    : "border-neutral-300 dark:border-neutral-700"
                }`}
              >
                <span className="truncate">{e.name}</span>
                <span className="ml-2 shrink-0 text-xs text-neutral-500">
                  {e.nodeCount}
                  {e.stalled ? " · 止" : ""}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// 局所的な2列表示: 見出し(親)+今の世代を全文、右に子の冒頭1行カード
function TreeView({
  rootId,
  reloadKey,
  onBack,
  onChanged,
}: {
  rootId: number;
  reloadKey: number;
  onBack: () => void;
  onChanged: () => void;
}) {
  const [tree, setTree] = useState<TreeNodeDTO | null>(null);
  const [focusId, setFocusId] = useState<number>(rootId);
  const [dragId, setDragId] = useState<number | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [nameInput, setNameInput] = useState("");

  const load = useCallback(() => {
    fetch(`/api/tree/${rootId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setTree);
  }, [rootId]);

  useEffect(() => {
    load();
  }, [load, reloadKey]);

  if (!tree) return <p className="text-sm text-neutral-500">読み込み中…</p>;

  // focus ノードを木の中から探す
  const focus = findNode(tree, focusId) ?? tree;
  const parentOfFocus = findParent(tree, focusId);

  async function reparent(id: number, newParentId: number | null) {
    await fetch("/api/posts/reparent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, newParentId }),
    });
    setDragId(null);
    load();
    onChanged();
  }

  async function saveName() {
    await fetch(`/api/tree/${rootId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: nameInput }),
    });
    setRenaming(false);
    load();
    onChanged();
  }

  const generation = depthOf(tree, focusId) + 1; // 1始まり
  const totalGen = maxDepth(tree) + 1;
  const treeName = tree.post.tree_name || firstLine(tree.post.body);

  return (
    <div>
      {/* パンくず + 世代表示 */}
      <div className="mb-2 flex items-start justify-between gap-2 text-xs">
        <div className="min-w-0">
          <button onClick={onBack} className="text-neutral-500 hover:underline">
            森
          </button>
          <span className="text-neutral-400"> › </span>
          <span className="text-neutral-600 dark:text-neutral-300">{treeName}</span>
        </div>
        <div className="shrink-0 text-right text-neutral-500">
          {generation}世代目を表示中・全{totalGen}世代
        </div>
      </div>

      <div className="mb-2 flex items-center justify-between">
        {renaming ? (
          <span className="flex gap-1">
            <input
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              placeholder="木の名前"
              className="rounded border border-neutral-400 bg-transparent px-1 text-xs outline-none"
            />
            <button onClick={saveName} className="text-xs underline">
              保存
            </button>
          </span>
        ) : (
          <button
            onClick={() => {
              setNameInput(tree.post.tree_name ?? "");
              setRenaming(true);
            }}
            className="text-xs text-neutral-500 hover:underline"
          >
            名前をつける
          </button>
        )}
      </div>

      {/* 見出し: focus の親(押すと1世代上がる) */}
      {parentOfFocus && (
        <button
          onClick={() => setFocusId(parentOfFocus.post.id)}
          className="mb-1 text-xs text-neutral-500 hover:underline"
        >
          ↑ {firstLine(parentOfFocus.post.body)}
        </button>
      )}
      <div
        className="mb-3 rounded-lg border border-neutral-300 bg-neutral-50 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
        onDragOver={(e) => dragId != null && e.preventDefault()}
        onDrop={() => dragId != null && dragId !== focus.post.id && reparent(dragId, focus.post.id)}
      >
        <span className="text-xs text-neutral-500">見出し {dateLabel(focus.post.created_at)}</span>
        <p className="whitespace-pre-wrap">{focus.post.body}</p>
      </div>

      {focus.children.length === 0 ? (
        <p className="text-xs text-neutral-500">この先はまだありません</p>
      ) : (
        <>
          {/* 列見出し */}
          <div className="mb-1 flex gap-2 text-xs text-neutral-400">
            <span className="flex-1">いまの世代 — 読む</span>
            <span className="hidden w-40 shrink-0 sm:block">それぞれの子 — 眺める</span>
          </div>
          <ul className="flex flex-col gap-2">
            {focus.children.map((child) => (
              <li key={child.post.id} className="flex gap-2">
                <div
                  draggable
                  onDragStart={() => setDragId(child.post.id)}
                  onDragEnd={() => setDragId(null)}
                  onDragOver={(e) => dragId != null && e.preventDefault()}
                  onDrop={(e) => {
                    e.stopPropagation();
                    if (dragId != null && dragId !== child.post.id) reparent(dragId, child.post.id);
                  }}
                  className={`flex-1 cursor-grab rounded-lg border px-3 py-2 text-sm dark:border-neutral-700 ${nodeTone(
                    child
                  )}`}
                  onClick={() => child.children.length > 0 && setFocusId(child.post.id)}
                >
                  <div className="mb-0.5 flex items-center gap-2 text-xs text-neutral-400">
                    <span>{dateLabel(child.post.created_at)}</span>
                    {child.post.is_conclusion === 1 && (
                      <span className="text-emerald-600 dark:text-emerald-400">結論</span>
                    )}
                    {child.post.status === "promise" && <span>約束</span>}
                    {child.post.status === "done" && <span>済み</span>}
                    {child.children.length > 0 && (
                      <span className="ml-auto">子{child.children.length}</span>
                    )}
                  </div>
                  <p className="whitespace-pre-wrap">{child.post.body}</p>
                </div>
                {/* 右列: 子の冒頭1行カード(収まらない分は +n) */}
                {child.children.length > 0 && (
                  <div className="hidden w-40 shrink-0 flex-col gap-1 sm:flex">
                    {child.children.slice(0, 3).map((gc) => (
                      <button
                        key={gc.post.id}
                        onClick={() => setFocusId(child.post.id)}
                        className="truncate rounded border border-neutral-200 px-2 py-1 text-left text-xs text-neutral-500 dark:border-neutral-800"
                      >
                        {firstLine(gc.post.body)}
                      </button>
                    ))}
                    {child.children.length > 3 && (
                      <button
                        onClick={() => setFocusId(child.post.id)}
                        className="rounded px-2 py-0.5 text-left text-xs text-neutral-400 hover:underline"
                      >
                        +{child.children.length - 3}件
                      </button>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </>
      )}

      {dragId != null ? (
        <p className="mt-2 text-xs text-neutral-400">
          カードの上に落とすと「子(深める)」になります
        </p>
      ) : (
        <p className="mt-3 border-t border-neutral-200 pt-2 text-xs leading-relaxed text-neutral-400 dark:border-neutral-800">
          見出し = 親(押すと1つ上の世代へ)。右の子は冒頭1行だけ、押すと降りて全文を読む。
        </p>
      )}
    </div>
  );
}

function depthOf(root: TreeNodeDTO, id: number, depth = 0): number {
  if (root.post.id === id) return depth;
  for (const c of root.children) {
    const d = depthOf(c, id, depth + 1);
    if (d >= 0) return d;
  }
  return -1;
}

function maxDepth(n: TreeNodeDTO): number {
  if (n.children.length === 0) return 0;
  return 1 + Math.max(...n.children.map(maxDepth));
}

function dateLabel(iso: string): string {
  const d = new Date(iso);
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

function nodeTone(n: TreeNodeDTO): string {
  if (n.post.is_conclusion === 1)
    return "border-emerald-400 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-950";
  if (n.descendantCount === 0) return "border-neutral-200 text-neutral-500 dark:border-neutral-800";
  return "border-neutral-300";
}

function findNode(n: TreeNodeDTO, id: number): TreeNodeDTO | null {
  if (n.post.id === id) return n;
  for (const c of n.children) {
    const f = findNode(c, id);
    if (f) return f;
  }
  return null;
}

function findParent(n: TreeNodeDTO, id: number, parent: TreeNodeDTO | null = null): TreeNodeDTO | null {
  if (n.post.id === id) return parent;
  for (const c of n.children) {
    const f = findParent(c, id, n);
    if (f) return f;
  }
  return null;
}

function firstLine(body: string): string {
  const line = body.split("\n")[0].trim();
  return line.length > 20 ? line.slice(0, 20) + "…" : line;
}
