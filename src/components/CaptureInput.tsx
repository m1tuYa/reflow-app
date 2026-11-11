"use client";

import { useState } from "react";

export function CaptureInput({ onCreated }: { onCreated: () => void }) {
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(intent: "record" | "promise") {
    if (!body.trim() || busy) return;
    setBusy(true);
    try {
      await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body, intent }),
      });
      setBody("");
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
      {body.trim() && (
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
