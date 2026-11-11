"use client";

import { useEffect, useState } from "react";
import { ForestEntryDTO } from "@/lib/types";

export function CaptureInput({ onCreated }: { onCreated: () => void }) {
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [tips, setTips] = useState<ForestEntryDTO[]>([]);
  const [treeRootId, setTreeRootId] = useState<number | null>(null);

  const writing = body.trim().length > 0;

  useEffect(() => {
    if (!writing) return;
    fetch("/api/forest")
      .then((r) => r.json())
      .then((d) => setTips((d.forest ?? []).slice(0, 3)));
  }, [writing]);

  async function submit(intent: "record" | "promise") {
    if (!body.trim() || busy) return;
    setBusy(true);
    try {
      await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body, intent, treeRootId }),
      });
      setBody("");
      setTreeRootId(null);
      onCreated();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-lg border border-neutral-300 p-3 dark:border-neutral-700">
      <textarea
        className="w-full resize-none bg-transparent text-sm outline-none"
        rows={3}
        placeholder="書く(2〜3文まで。「明日」「金曜」「30分」などはそのまま読み取られます)"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit("record");
        }}
      />
      {writing && tips.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-1 text-xs">
          <span className="text-neutral-500">つなぐ:</span>
          <button
            onClick={() => setTreeRootId(null)}
            className={`rounded border px-2 py-0.5 ${
              treeRootId === null
                ? "border-neutral-800 bg-neutral-800 text-white dark:border-neutral-200 dark:bg-neutral-200 dark:text-neutral-900"
                : "border-neutral-300 dark:border-neutral-700"
            }`}
          >
            選ばない
          </button>
          {tips.map((t) => (
            <button
              key={t.root.id}
              onClick={() => setTreeRootId(t.root.id)}
              className={`max-w-[10rem] truncate rounded border px-2 py-0.5 ${
                treeRootId === t.root.id
                  ? "border-neutral-800 bg-neutral-800 text-white dark:border-neutral-200 dark:bg-neutral-200 dark:text-neutral-900"
                  : "border-neutral-300 dark:border-neutral-700"
              }`}
            >
              {t.name}
            </button>
          ))}
        </div>
      )}
      {writing && (
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => submit("record")}
            className="rounded bg-neutral-800 px-3 py-1 text-sm text-white disabled:opacity-50 dark:bg-neutral-200 dark:text-neutral-900"
          >
            記録する
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => submit("promise")}
            className="rounded border border-neutral-400 px-3 py-1 text-sm disabled:opacity-50"
          >
            未来へ置く
          </button>
        </div>
      )}
    </div>
  );
}
