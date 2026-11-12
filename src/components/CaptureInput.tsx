"use client";

import { useState } from "react";
import { PostDTO } from "@/lib/types";
import { AttachTarget } from "./TreePicker";

// 常にある入力欄。つなぐ先は書き始めると右に出る一覧から選ぶ(任意)。
export function CaptureInput({
  attach,
  onAttachChange,
  onWritingChange,
  onCreated,
}: {
  attach: AttachTarget | null;
  onAttachChange: (t: AttachTarget | null) => void;
  onWritingChange: (writing: boolean) => void;
  onCreated: (post: PostDTO) => void;
}) {
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);

  const writing = body.trim().length > 0;

  function change(next: string) {
    setBody(next);
    const w = next.trim().length > 0;
    if (w !== writing) onWritingChange(w);
  }

  async function submit(intent: "record" | "promise") {
    if (!body.trim() || busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body, intent, parentId: attach?.parentId ?? null }),
      });
      const post = (await res.json()) as PostDTO;
      setBody("");
      onAttachChange(null);
      onWritingChange(false);
      onCreated(post);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-lg border border-neutral-300 p-3 dark:border-neutral-700">
      <textarea
        className="w-full resize-none bg-transparent text-sm outline-none"
        rows={3}
        placeholder="書く(線より上=記録、線より下=未来への約束。「明日」「金曜」「30分」はそのまま読み取られます)"
        value={body}
        onChange={(e) => change(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit("record");
        }}
      />
      {writing && (
        <div className="mt-2 flex items-center gap-2 text-xs">
          {attach ? (
            <span className="flex min-w-0 items-center gap-1 rounded border border-blue-500 bg-blue-50 px-2 py-0.5 dark:bg-blue-950/40">
              <span className="truncate">→ {attach.label}</span>
              <button
                onClick={() => onAttachChange(null)}
                className="text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100"
                title="つなぐ先を外す"
              >
                ×
              </button>
            </span>
          ) : (
            <span className="text-neutral-500">
              つなぐ木は右で選べます(選ばなければ書いた後に聞きます)
            </span>
          )}
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
