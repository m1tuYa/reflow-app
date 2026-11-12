"use client";

import { useState } from "react";
import { Question } from "@/lib/types";
import { useCardActions } from "./CardActions";

async function answer(payload: Record<string, unknown>) {
  await fetch("/api/questions/answer", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export function QuestionCard({
  question,
  remaining,
  onAnswered,
}: {
  question: Question;
  remaining: number;
  onAnswered: () => void;
}) {
  const { requestConnect } = useCardActions();
  const [dateInput, setDateInput] = useState("");
  const [writeInput, setWriteInput] = useState("");
  const [showDate, setShowDate] = useState(false);
  const [showWrite, setShowWrite] = useState(false);
  // 「どうなった?」書いた後の「やることはある?」段階
  const [stalledStage, setStalledStage] = useState<"ask" | "followup">("ask");
  const [taskInput, setTaskInput] = useState("");
  const [taskDate, setTaskDate] = useState("");

  async function act(payload: Record<string, unknown>) {
    await answer(payload);
    setShowDate(false);
    setShowWrite(false);
    setDateInput("");
    setWriteInput("");
    setStalledStage("ask");
    setTaskInput("");
    setTaskDate("");
    onAnswered();
  }

  async function later(id: number) {
    await answer({ action: "later", id, type: question.type });
    onAnswered();
  }

  return (
    <div className="rounded-lg border border-neutral-300 bg-neutral-50 p-3 dark:border-neutral-700 dark:bg-neutral-900">
      {question.type === "continuation" && (
        <>
          <p className="text-sm font-medium">
            これは「{question.candidate.tree_name || firstLine(question.candidate.body)}」の続き?
          </p>
          <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
            {question.post.body}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Btn onClick={() => act({ type: "continuation", id: question.post.id, decision: "yes" })}>
              はい
            </Btn>
            <Btn onClick={() => act({ type: "continuation", id: question.post.id, decision: "no" })}>
              違う
            </Btn>
            <Btn onClick={() => act({ type: "continuation", id: question.post.id, decision: "new" })}>
              新しい考え
            </Btn>
          </div>
        </>
      )}

      {question.type === "when" && (
        <>
          <p className="text-sm font-medium">いつやる?</p>
          <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
            {question.post.body}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Btn onClick={() => act({ type: "when", id: question.post.id, decision: "today" })}>
              今日
            </Btn>
            {showDate ? (
              <span className="flex gap-1">
                <input
                  type="date"
                  value={dateInput}
                  onChange={(e) => setDateInput(e.target.value)}
                  className="rounded border border-neutral-400 px-1 text-sm"
                />
                <Btn
                  onClick={() =>
                    dateInput &&
                    act({ type: "when", id: question.post.id, decision: "date", date: dateInput })
                  }
                >
                  決定
                </Btn>
              </span>
            ) : (
              <Btn onClick={() => setShowDate(true)}>日付</Btn>
            )}
            <Btn onClick={() => act({ type: "when", id: question.post.id, decision: "someday" })}>
              いつか
            </Btn>
          </div>
        </>
      )}

      {question.type === "carryover" && (
        <>
          <p className="text-sm font-medium">やらなかった約束、今日やる?</p>
          <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
            {question.post.body}{" "}
            <span className="text-xs">({question.post.promise_date} 予定)</span>
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Btn
              onClick={() => act({ type: "carryover", id: question.post.id, decision: "today" })}
            >
              やる
            </Btn>
            {showDate ? (
              <span className="flex gap-1">
                <input
                  type="date"
                  value={dateInput}
                  onChange={(e) => setDateInput(e.target.value)}
                  className="rounded border border-neutral-400 px-1 text-sm"
                />
                <Btn
                  onClick={() =>
                    dateInput &&
                    act({
                      type: "carryover",
                      id: question.post.id,
                      decision: "otherDate",
                      date: dateInput,
                    })
                  }
                >
                  決定
                </Btn>
              </span>
            ) : (
              <Btn onClick={() => setShowDate(true)}>別の日</Btn>
            )}
            <Btn
              onClick={() => act({ type: "carryover", id: question.post.id, decision: "cancel" })}
            >
              やめる
            </Btn>
          </div>
        </>
      )}

      {question.type === "morningOrder" && (
        <>
          <p className="text-sm font-medium">今日の約束、この順でいい?</p>
          <ol className="mt-1 list-decimal pl-5 text-sm text-neutral-600 dark:text-neutral-400">
            {question.posts.map((p) => (
              <li key={p.id}>{p.body}</li>
            ))}
          </ol>
          <div className="mt-2 flex gap-2">
            <Btn onClick={() => act({ type: "morningOrder" })}>このまま</Btn>
            <Btn onClick={() => act({ type: "morningOrder" })}>並べ替えた(下で調整)</Btn>
          </div>
        </>
      )}

      {question.type === "recall" && (
        <>
          <p className="text-xs text-blue-700 dark:text-blue-400">
            {recallDate(question.post.created_at)}の自分から戻ってきた — 今はどう思う?
          </p>
          <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
            {question.post.body}
          </p>
          {showWrite ? (
            <div className="mt-2 flex flex-col gap-2">
              <textarea
                className="w-full resize-none rounded border border-neutral-400 bg-transparent p-1 text-sm outline-none"
                rows={2}
                value={writeInput}
                onChange={(e) => setWriteInput(e.target.value)}
              />
              <div className="flex gap-2">
                <Btn
                  onClick={() =>
                    writeInput.trim() &&
                    act({
                      type: "recall",
                      id: question.post.id,
                      action: "write",
                      body: writeInput.trim(),
                    })
                  }
                >
                  送る
                </Btn>
              </div>
            </div>
          ) : (
            <div className="mt-2 flex gap-2">
              <Btn onClick={() => setShowWrite(true)}>書く</Btn>
              <Btn
                onClick={() => act({ type: "recall", id: question.post.id, action: "skip" })}
              >
                流す
              </Btn>
              {/* つながらない投稿が戻ってきたときは、木につなぐ機会にする */}
              {question.post.parent_id == null && (
                <Btn onClick={() => requestConnect(question.post.id)}>木につなぐ</Btn>
              )}
            </div>
          )}
        </>
      )}

      {question.type === "verify" && (
        <>
          <p className="text-sm font-medium">あの決めたこと、効いた?</p>
          <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
            {question.post.body}
          </p>
          <div className="mt-2 flex flex-col gap-2">
            <textarea
              className="w-full resize-none rounded border border-neutral-400 bg-transparent p-1 text-sm outline-none"
              rows={2}
              placeholder="結果を書く"
              value={writeInput}
              onChange={(e) => setWriteInput(e.target.value)}
            />
            <div>
              <Btn
                onClick={() =>
                  writeInput.trim() &&
                  act({ type: "verify", id: question.post.id, body: writeInput.trim() })
                }
              >
                送る
              </Btn>
            </div>
          </div>
        </>
      )}

      {question.type === "stalled" && (
        <>
          {stalledStage === "ask" ? (
            <>
              <p className="text-sm font-medium">この考え、どうなった?</p>
              <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
                {question.post.body}
              </p>
              {showWrite ? (
                <div className="mt-2 flex flex-col gap-2">
                  <textarea
                    className="w-full resize-none rounded border border-neutral-400 bg-transparent p-1 text-sm outline-none"
                    rows={2}
                    placeholder="結論を書く"
                    value={writeInput}
                    onChange={(e) => setWriteInput(e.target.value)}
                  />
                  <div>
                    <Btn
                      onClick={() => writeInput.trim() && setStalledStage("followup")}
                    >
                      次へ
                    </Btn>
                  </div>
                </div>
              ) : (
                <div className="mt-2 flex gap-2">
                  <Btn onClick={() => setShowWrite(true)}>書く</Btn>
                  <Btn
                    onClick={() =>
                      act({ type: "stalled", id: question.post.id, resolution: "release" })
                    }
                  >
                    手放す
                  </Btn>
                </div>
              )}
            </>
          ) : (
            <>
              <p className="text-sm font-medium">やることはある?</p>
              <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
                結論: {writeInput}
              </p>
              <div className="mt-2 flex flex-col gap-2">
                <textarea
                  className="w-full resize-none rounded border border-neutral-400 bg-transparent p-1 text-sm outline-none"
                  rows={2}
                  placeholder="やること(空なら「ない」)"
                  value={taskInput}
                  onChange={(e) => setTaskInput(e.target.value)}
                />
                {taskInput.trim() && (
                  <input
                    type="date"
                    value={taskDate}
                    onChange={(e) => setTaskDate(e.target.value)}
                    className="w-40 rounded border border-neutral-400 bg-transparent px-1 text-sm outline-none"
                  />
                )}
                <div className="flex gap-2">
                  {taskInput.trim() ? (
                    <Btn
                      onClick={() =>
                        act({
                          type: "stalled",
                          id: question.post.id,
                          resolution: "write",
                          body: writeInput.trim(),
                          hasTask: true,
                          taskBody: taskInput.trim(),
                          taskDate: taskDate || null,
                        })
                      }
                    >
                      ある
                    </Btn>
                  ) : (
                    <Btn
                      onClick={() =>
                        act({
                          type: "stalled",
                          id: question.post.id,
                          resolution: "write",
                          body: writeInput.trim(),
                          hasTask: false,
                        })
                      }
                    >
                      ない
                    </Btn>
                  )}
                </div>
              </div>
            </>
          )}
        </>
      )}

      {question.type === "someday" && (
        <>
          <p className="text-sm font-medium">まだやりたい?</p>
          <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
            {question.post.body}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Btn onClick={() => act({ type: "someday", id: question.post.id, decision: "do" })}>
              やる(今日)
            </Btn>
            <Btn onClick={() => act({ type: "someday", id: question.post.id, decision: "keep" })}>
              まだ
            </Btn>
            <Btn onClick={() => act({ type: "someday", id: question.post.id, decision: "cancel" })}>
              やめる
            </Btn>
          </div>
        </>
      )}

      <div className="mt-2 flex items-center justify-between text-xs text-neutral-500">
        <span>あと{remaining}問</span>
        {question.type !== "morningOrder" && (
          <button className="underline" onClick={() => later(question.post.id)}>
            あとで
          </button>
        )}
      </div>
    </div>
  );
}

function firstLine(body: string): string {
  const line = body.split("\n")[0].trim();
  return line.length > 16 ? line.slice(0, 16) + "…" : line;
}

function recallDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

function Btn({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded border border-neutral-400 px-2 py-1 text-sm hover:bg-neutral-200 dark:hover:bg-neutral-800"
    >
      {children}
    </button>
  );
}
