"use client";

import { useCallback, useEffect, useState } from "react";
import { ForestEntryDTO, TreeNodeDTO } from "@/lib/types";
import { draftDropHandlers } from "@/lib/dnd";

export type AttachTarget = { rootId: number; parentId: number; label: string };

// 右ペインで「どこにつなぐか」を選ぶ。
//  - 上に最近触った木(とその先端)、検索で名前や中身から探せる
//  - 木を押すと、その木の「最新の先端の続き」が既定の位置になる
//  - 開いた木の中で「この下に」を押すと、正確な位置を選べる
export function TreePicker({
  title,
  hint,
  selected,
  excludeId,
  confirmLabel,
  allowNewRoot,
  onPick,
  reloadKey,
}: {
  title: string;
  hint?: string;
  selected: AttachTarget | null;
  // つなぎ直すカード自身(その子孫も含め、つなぐ先にできない)
  excludeId?: number;
  // 既定位置を選んだだけでは確定しない(つなぎ直しのとき)。押すと onPick。
  confirmLabel?: string;
  allowNewRoot?: string;
  onPick: (target: AttachTarget | null) => void;
  reloadKey: number;
}) {
  const [query, setQuery] = useState("");
  const [forest, setForest] = useState<ForestEntryDTO[]>([]);
  const [openRoot, setOpenRoot] = useState<number | null>(selected?.rootId ?? null);
  const [hover, setHover] = useState<string | null>(null);

  useEffect(() => {
    const handle = setTimeout(
      () => {
        fetch(`/api/forest?q=${encodeURIComponent(query.trim())}`)
          .then((r) => r.json())
          .then((d) => setForest(d.forest ?? []));
      },
      query ? 200 : 0
    );
    return () => clearTimeout(handle);
  }, [query, reloadKey]);

  const visible = forest.filter((e) => e.root.id !== excludeId);
  const recent = query ? [] : visible.slice(0, 3);
  const rest = query ? visible : visible.slice(3);

  if (openRoot != null) {
    return (
      <PickerTree
        rootId={openRoot}
        selected={selected}
        excludeId={excludeId}
        confirmLabel={confirmLabel}
        reloadKey={reloadKey}
        onBack={() => setOpenRoot(null)}
        onPick={onPick}
      />
    );
  }

  return (
    <div>
      <p className="mb-1 text-xs text-blue-700 dark:text-blue-400">{title}</p>
      {hint && <p className="mb-2 text-xs text-neutral-500">{hint}</p>}

      {selected && (
        <div className="mb-2 flex items-center gap-2 rounded border border-blue-500 bg-blue-50 px-2 py-1 text-xs dark:bg-blue-950/40">
          <span className="min-w-0 flex-1 truncate">つなぐ先: {selected.label}</span>
          <button className="underline" onClick={() => setOpenRoot(selected.rootId)}>
            位置を変える
          </button>
          <button className="underline" onClick={() => onPick(null)}>
            外す
          </button>
        </div>
      )}

      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="木を名前や中身で探す"
        className="mb-3 w-full rounded border border-neutral-300 bg-transparent px-2 py-1 text-sm outline-none dark:border-neutral-700"
      />

      {recent.length > 0 && (
        <>
          <p className="mb-1 text-xs text-neutral-400">最近触った木 — 押すと最新の先端の続きにつなぐ</p>
          <ul className="mb-3 flex flex-col gap-1.5">
            {recent.map((e) => (
              <TreeRow
                key={e.root.id}
                entry={e}
                active={selected?.rootId === e.root.id}
                dropHover={hover === `t${e.root.id}`}
                dropProps={draftDropHandlers(`t${e.root.id}`, setHover, () => chooseDefault(e, true))}
                onChoose={() => chooseDefault(e)}
                onOpen={() => setOpenRoot(e.root.id)}
              />
            ))}
          </ul>
        </>
      )}

      {rest.length > 0 && (
        <>
          <p className="mb-1 text-xs text-neutral-400">{query ? "見つかった木" : "ほかの木"}</p>
          <ul className="flex max-h-80 flex-col gap-1 overflow-y-auto pr-1">
            {rest.map((e) => (
              <TreeRow
                key={e.root.id}
                entry={e}
                compact
                active={selected?.rootId === e.root.id}
                dropHover={hover === `t${e.root.id}`}
                dropProps={draftDropHandlers(`t${e.root.id}`, setHover, () => chooseDefault(e, true))}
                onChoose={() => chooseDefault(e)}
                onOpen={() => setOpenRoot(e.root.id)}
              />
            ))}
          </ul>
        </>
      )}
      {visible.length === 0 && (
        <p className="text-sm text-neutral-500">
          {query ? "見つかりませんでした" : "まだ木がありません"}
        </p>
      )}

      {allowNewRoot && (
        <button
          onClick={() => onPick(null)}
          className="mt-3 text-xs text-neutral-500 underline"
        >
          {allowNewRoot}
        </button>
      )}
    </div>
  );

  // 木を押す: 書くときは既定位置で即決。つなぎ直しは開いて位置を確かめてから。
  async function chooseDefault(e: ForestEntryDTO, dropped = false) {
    if (confirmLabel && !dropped) {
      setOpenRoot(e.root.id);
      return;
    }
    const tree: TreeNodeDTO | null = await fetch(`/api/tree/${e.root.id}`).then((r) =>
      r.ok ? r.json() : null
    );
    if (!tree) return;
    onPick(defaultTarget(tree, e.name));
  }
}

function TreeRow({
  entry,
  active,
  compact,
  dropHover,
  dropProps,
  onChoose,
  onOpen,
}: {
  entry: ForestEntryDTO;
  active: boolean;
  compact?: boolean;
  dropHover: boolean;
  dropProps: ReturnType<typeof draftDropHandlers>;
  onChoose: () => void;
  onOpen: () => void;
}) {
  return (
    <li
      {...dropProps}
      className={`flex items-stretch rounded border text-sm ${
        dropHover
          ? "border-blue-500 bg-blue-100 ring-2 ring-blue-400 dark:bg-blue-900/40"
          : active
          ? "border-blue-500 ring-1 ring-blue-500"
          : entry.stalled
            ? "border-neutral-200 text-neutral-400 dark:border-neutral-800"
            : "border-neutral-300 dark:border-neutral-700"
      }`}
    >
      <button
        onClick={onChoose}
        className="min-w-0 flex-1 px-3 py-1.5 text-left hover:bg-neutral-100 dark:hover:bg-neutral-800"
      >
        <span className="flex items-center gap-2">
          <span className="truncate font-medium">{entry.name}</span>
          <span className="shrink-0 text-xs text-neutral-400">{entry.nodeCount}</span>
        </span>
        {!compact && entry.tip && (
          <span className="block truncate text-xs text-neutral-500">先端: {entry.tip}</span>
        )}
        {entry.hit && (
          <span className="block truncate text-xs text-amber-700 dark:text-amber-400">
            「{entry.hit}」
          </span>
        )}
      </button>
      <button
        onClick={onOpen}
        title="木を開いて位置を選ぶ"
        className="shrink-0 border-l border-neutral-200 px-2 text-xs text-neutral-500 hover:bg-neutral-100 dark:border-neutral-800 dark:hover:bg-neutral-800"
      >
        開く ›
      </button>
    </li>
  );
}

// 開いた木の中で位置を選ぶ(局所2列ではなく、選ぶための簡潔な表示)
function PickerTree({
  rootId,
  selected,
  excludeId,
  confirmLabel,
  reloadKey,
  onBack,
  onPick,
}: {
  rootId: number;
  selected: AttachTarget | null;
  excludeId?: number;
  confirmLabel?: string;
  reloadKey: number;
  onBack: () => void;
  onPick: (target: AttachTarget | null) => void;
}) {
  const [tree, setTree] = useState<TreeNodeDTO | null>(null);
  const [focusId, setFocusId] = useState<number | null>(null);
  const [hover, setHover] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch(`/api/tree/${rootId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((t: TreeNodeDTO | null) => {
        setTree(t);
        if (t) {
          // 既定位置(選択中、なければ最新の先端の親)の世代から見せる
          const start =
            selected?.rootId === rootId ? selected.parentId : defaultTarget(t, "").parentId;
          setFocusId((cur) => cur ?? start);
        }
      });
  }, [rootId, selected]);

  useEffect(() => {
    load();
  }, [load, reloadKey]);

  if (!tree) return <p className="text-sm text-neutral-500">読み込み中…</p>;

  const name = tree.post.tree_name || firstLine(tree.post.body);
  const focus = findNode(tree, focusId ?? rootId) ?? tree;
  const parent = findParent(tree, focus.post.id);
  const excluded = new Set(excludeId != null ? subtreeIdsOf(findNode(tree, excludeId)) : []);
  const def = defaultTarget(tree, name);

  function target(node: TreeNodeDTO): AttachTarget {
    return { rootId, parentId: node.post.id, label: `${name} › ${firstLine(node.post.body)}` };
  }
  const isSel = (id: number) => selected?.rootId === rootId && selected.parentId === id;

  return (
    <div>
      <div className="mb-2 flex items-center gap-1 text-xs">
        <button onClick={onBack} className="text-neutral-500 hover:underline">
          ‹ 木を選び直す
        </button>
        <span className="text-neutral-400"> / </span>
        <span className="truncate text-neutral-600 dark:text-neutral-300">{name}</span>
      </div>

      <button
        onClick={() => onPick(def)}
        className={`mb-3 w-full rounded border px-3 py-1.5 text-left text-xs ${
          isSel(def.parentId)
            ? "border-blue-500 bg-blue-50 ring-1 ring-blue-500 dark:bg-blue-950/40"
            : "border-neutral-300 hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
        }`}
      >
        {confirmLabel ? `${confirmLabel}: ` : ""}最新の先端の続きにつなぐ(既定)
      </button>

      {parent && (
        <button
          onClick={() => setFocusId(parent.post.id)}
          className="mb-1 text-xs text-neutral-500 hover:underline"
        >
          ↑ {firstLine(parent.post.body)}
        </button>
      )}

      <NodeRow
        node={focus}
        heading
        selected={isSel(focus.post.id)}
        disabled={excluded.has(focus.post.id)}
        dropHover={hover === `n${focus.post.id}`}
        dropProps={draftDropHandlers(`n${focus.post.id}`, setHover, () => onPick(target(focus)))}
        onHere={() => onPick(target(focus))}
      />

      <ul
        {...draftDropHandlers(`g${focus.post.id}`, setHover, () => onPick(target(focus)))}
        className={`ml-4 mt-1.5 flex flex-col gap-1.5 border-l pl-3 py-1 ${
          hover === `g${focus.post.id}`
            ? "border-l-2 border-blue-500 bg-blue-50/60 dark:bg-blue-950/30"
            : "border-neutral-200 dark:border-neutral-800"
        }`}
      >
        {focus.children.length === 0 && (
          <li className="text-xs text-neutral-400">この下はまだありません</li>
        )}
        {focus.children.map((c) => (
          <NodeRow
            key={c.post.id}
            node={c}
            selected={isSel(c.post.id)}
            disabled={excluded.has(c.post.id)}
            dropHover={hover === `n${c.post.id}`}
            dropProps={draftDropHandlers(`n${c.post.id}`, setHover, () => onPick(target(c)))}
            onHere={() => onPick(target(c))}
            onDescend={c.children.length > 0 ? () => setFocusId(c.post.id) : undefined}
          />
        ))}
      </ul>
      <p className="mt-3 text-xs text-neutral-400">
        「この下に」を押すか、カードの上に落とすと子(深める)。カードの間に落とすと弟(続ける)。
      </p>
    </div>
  );
}

function NodeRow({
  node,
  heading,
  selected,
  disabled,
  dropHover,
  dropProps,
  onHere,
  onDescend,
}: {
  node: TreeNodeDTO;
  heading?: boolean;
  selected: boolean;
  disabled: boolean;
  dropHover: boolean;
  dropProps: ReturnType<typeof draftDropHandlers>;
  onHere: () => void;
  onDescend?: () => void;
}) {
  return (
    <li
      {...(disabled ? {} : dropProps)}
      className={`flex list-none items-start gap-2 rounded border px-2 py-1.5 text-sm ${
        dropHover
          ? "border-blue-500 bg-blue-100 ring-2 ring-blue-400 dark:bg-blue-900/40"
          : selected
          ? "border-blue-500 bg-blue-50 ring-1 ring-blue-500 dark:bg-blue-950/40"
          : heading
            ? "border-neutral-300 bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900"
            : "border-neutral-200 dark:border-neutral-800"
      } ${disabled ? "opacity-40" : ""}`}
    >
      <button
        disabled={!onDescend}
        onClick={onDescend}
        className="min-w-0 flex-1 text-left disabled:cursor-default"
      >
        <span className="line-clamp-2">{node.post.body}</span>
        {onDescend && (
          <span className="text-xs text-neutral-400">子{node.children.length} ›</span>
        )}
      </button>
      {!disabled && (
        <button
          onClick={onHere}
          className="shrink-0 rounded border border-neutral-300 px-1.5 py-0.5 text-xs hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
        >
          {selected ? "✓ ここ" : "この下に"}
        </button>
      )}
    </li>
  );
}

// 既定の位置: 最新の先端の弟(=先端の親の子)。先端が根なら根の子。
export function defaultTarget(tree: TreeNodeDTO, name: string): AttachTarget {
  let tip: TreeNodeDTO = tree;
  let tipParent: TreeNodeDTO | null = null;
  const walk = (n: TreeNodeDTO, p: TreeNodeDTO | null) => {
    if (n.children.length === 0 && n !== tree) {
      if (tip === tree || n.post.created_at > tip.post.created_at) {
        tip = n;
        tipParent = p;
      }
    }
    n.children.forEach((c) => walk(c, n));
  };
  walk(tree, null);
  const parentNode: TreeNodeDTO = tipParent ?? tree;
  const label = name || tree.post.tree_name || firstLine(tree.post.body);
  return {
    rootId: tree.post.id,
    parentId: parentNode.post.id,
    label: tip === tree ? label : `${label} › 「${firstLine(tip.post.body)}」の続き`,
  };
}

function subtreeIdsOf(n: TreeNodeDTO | null): number[] {
  if (!n) return [];
  return [n.post.id, ...n.children.flatMap(subtreeIdsOf)];
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
