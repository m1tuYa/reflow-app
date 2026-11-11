"use client";

import { useCallback, useEffect, useState } from "react";
import { RoutineDTO } from "@/lib/types";
import { md } from "@/lib/format";

export function ManagePanel({ onChanged }: { onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  const [routines, setRoutines] = useState<RoutineDTO[]>([]);
  const [body, setBody] = useState("");
  const [estimate, setEstimate] = useState("");
  const [interval, setInterval] = useState("7");
  const [importMsg, setImportMsg] = useState("");

  const loadRoutines = useCallback(() => {
    fetch("/api/routines")
      .then((r) => r.json())
      .then(setRoutines);
  }, []);

  useEffect(() => {
    if (open) loadRoutines();
  }, [open, loadRoutines]);

  async function addRoutine() {
    if (!body.trim()) return;
    await fetch("/api/routines", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        body: body.trim(),
        estimateMinutes: estimate ? Number(estimate) : null,
        intervalDays: Number(interval),
      }),
    });
    setBody("");
    setEstimate("");
    setInterval("7");
    loadRoutines();
    onChanged();
  }

  async function removeRoutine(id: number) {
    await fetch(`/api/routines/${id}`, { method: "DELETE" });
    loadRoutines();
    onChanged();
  }

  async function onImport(file: File) {
    const text = await file.text();
    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      setImportMsg("JSONとして読めませんでした");
      return;
    }
    const res = await fetch("/api/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const j = await res.json();
    if (res.ok) {
      setImportMsg(`${j.imported}件を復元しました`);
      onChanged();
    } else {
      setImportMsg(j.error ?? "復元に失敗しました");
    }
  }

  return (
    <div className="mt-2">
      <button
        onClick={() => setOpen((o) => !o)}
        className="text-xs text-neutral-400 hover:underline"
      >
        {open ? "▾ ルーチン・復元" : "▸ ルーチン・復元"}
      </button>
      {open && (
        <div className="mt-2 flex flex-col gap-4 rounded-lg border border-neutral-200 p-3 text-sm dark:border-neutral-800">
          <div>
            <p className="mb-1 text-xs font-semibold text-neutral-500">ルーチン(決まった間隔で約束に出る)</p>
            {routines.length === 0 ? (
              <p className="text-xs text-neutral-400">まだありません</p>
            ) : (
              <ul className="mb-2 flex flex-col gap-1">
                {routines.map((r) => (
                  <li
                    key={r.id}
                    className="flex items-center justify-between gap-2 text-xs"
                  >
                    <span className="min-w-0 truncate">
                      {r.body}
                      <span className="text-neutral-400">
                        {" "}
                        / {r.interval_days}日ごと / 次回 {md(r.next_run)}
                        {r.estimate_minutes ? ` / ${r.estimate_minutes}分` : ""}
                      </span>
                    </span>
                    <button
                      onClick={() => removeRoutine(r.id)}
                      className="shrink-0 text-neutral-400 hover:underline"
                    >
                      削除
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex flex-wrap items-center gap-1">
              <input
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="やること"
                className="min-w-0 flex-1 rounded border border-neutral-300 bg-transparent px-2 py-1 text-xs outline-none dark:border-neutral-700"
              />
              <input
                value={estimate}
                onChange={(e) => setEstimate(e.target.value)}
                placeholder="分"
                className="w-12 rounded border border-neutral-300 bg-transparent px-2 py-1 text-xs outline-none dark:border-neutral-700"
              />
              <span className="text-xs text-neutral-400">
                <input
                  value={interval}
                  onChange={(e) => setInterval(e.target.value)}
                  className="w-10 rounded border border-neutral-300 bg-transparent px-1 py-1 text-center text-xs outline-none dark:border-neutral-700"
                />
                日ごと
              </span>
              <button
                onClick={addRoutine}
                className="rounded border border-neutral-400 px-2 py-1 text-xs"
              >
                追加
              </button>
            </div>
          </div>

          <div>
            <p className="mb-1 text-xs font-semibold text-neutral-500">
              復元(書き出したJSONから)
            </p>
            <p className="mb-1 text-xs text-neutral-400">
              いまのデータは全て置き換わります。
            </p>
            <input
              type="file"
              accept="application/json,.json"
              onChange={(e) => e.target.files?.[0] && onImport(e.target.files[0])}
              className="text-xs"
            />
            {importMsg && <p className="mt-1 text-xs text-neutral-500">{importMsg}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
