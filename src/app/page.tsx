"use client";

import { useCallback, useEffect, useState } from "react";
import { CaptureInput } from "@/components/CaptureInput";
import { QuestionCard } from "@/components/QuestionCard";
import { TodayPromises } from "@/components/TodayPromises";
import { PastList } from "@/components/PastList";
import { CarryoverPile } from "@/components/CarryoverPile";
import { RecentFeed } from "@/components/RecentFeed";
import { ContextPane } from "@/components/ContextPane";
import { CurrentQuestionResponse, PostDTO, TimelineDTO } from "@/lib/types";
import { hhmm, hhmmAfter, md } from "@/lib/format";

const EMPTY_TIMELINE: TimelineDTO = {
  now: "",
  past: [],
  overdue: [],
  todayUpcoming: [],
  tomorrow: [],
  someday: [],
  returning: [],
  endMinutes: 0,
};

export default function Home() {
  const [question, setQuestion] = useState<CurrentQuestionResponse>({
    question: null,
    remaining: 0,
  });
  const [timeline, setTimeline] = useState<TimelineDTO>(EMPTY_TIMELINE);
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<PostDTO[] | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const refetch = useCallback(() => {
    fetch("/api/questions/current")
      .then((r) => r.json())
      .then(setQuestion);
    fetch("/api/timeline")
      .then((r) => r.json())
      .then(setTimeline);
  }, []);

  const load = useCallback(() => {
    refetch();
    setReloadKey((k) => k + 1);
  }, [refetch]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) return;
    const handle = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(trimmed)}`)
        .then((r) => r.json())
        .then(setSearchResults);
    }, 250);
    return () => clearTimeout(handle);
  }, [query]);

  function handleQueryChange(value: string) {
    setQuery(value);
    if (!value.trim()) setSearchResults(null);
  }

  return (
    <div className="min-h-screen bg-neutral-100 px-4 py-5 dark:bg-neutral-950 dark:text-neutral-100">
      <div className="mx-auto max-w-6xl">
        {/* ヘッダー */}
        <header className="mb-5 flex items-center justify-between gap-4">
          <div className="flex items-baseline gap-3">
            <h1 className="text-lg font-semibold">往還</h1>
            {timeline.now && (
              <span className="text-sm text-neutral-500">{md(timeline.now)}</span>
            )}
          </div>
          <input
            type="text"
            placeholder="過去の自分を探す"
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            className="w-64 rounded border border-neutral-300 bg-white px-3 py-1.5 text-sm outline-none dark:border-neutral-700 dark:bg-neutral-900"
          />
        </header>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* 左: 時間軸 */}
          <main className="flex flex-col gap-3">
            {searchResults ? (
              <section>
                <h2 className="mb-2 text-sm font-semibold text-neutral-500">
                  検索結果「{query}」
                </h2>
                <RecentFeed posts={searchResults} onChanged={load} />
              </section>
            ) : (
              <>
                {/* 過去 — 記録 */}
                <section>
                  <h2 className="mb-2 text-xs font-semibold tracking-wide text-neutral-500">
                    過去 — 記録
                  </h2>
                  <PastList items={timeline.past} onChanged={load} />
                </section>

                {/* 出ている問い(いま線のすぐ上) */}
                {question.question && (
                  <QuestionCard
                    question={question.question}
                    remaining={question.remaining}
                    onAnswered={load}
                  />
                )}

                {/* いま線 */}
                <div className="flex items-center gap-2 py-1">
                  <span className="h-2 w-2 rounded-full bg-blue-600" />
                  <span className="text-sm font-medium text-blue-700 dark:text-blue-400">
                    いま {timeline.now ? hhmm(timeline.now) : "—"}
                  </span>
                  <span className="h-px flex-1 bg-blue-600/40" />
                </div>

                <CaptureInput onCreated={load} />

                <CarryoverPile posts={timeline.overdue} onChanged={load} />

                {/* 未来 — 今日この後 */}
                <section>
                  <div className="mb-2 flex items-baseline justify-between">
                    <h2 className="text-xs font-semibold tracking-wide text-neutral-500">
                      未来 — 今日この後
                    </h2>
                    {timeline.endMinutes > 0 && (
                      <span className="text-xs text-neutral-500">
                        終了予定 {hhmmAfter(timeline.now, timeline.endMinutes)}
                      </span>
                    )}
                  </div>
                  <TodayPromises
                    posts={timeline.todayUpcoming}
                    now={timeline.now}
                    onChanged={load}
                  />
                </section>

                {/* 明日 */}
                {timeline.tomorrow.length > 0 && (
                  <section>
                    <h2 className="mb-2 text-xs font-semibold tracking-wide text-neutral-500">
                      明日
                    </h2>
                    <SimpleList posts={timeline.tomorrow} tag="自分が置いた" />
                  </section>
                )}

                {/* いつでも */}
                {(timeline.someday.length > 0 || timeline.returning.length > 0) && (
                  <section>
                    <h2 className="mb-2 text-xs font-semibold tracking-wide text-neutral-500">
                      いつでも
                    </h2>
                    <div className="flex flex-col gap-1.5">
                      {timeline.someday.map((p) => (
                        <SimpleRow key={p.id} body={p.body} tag="自分が置いた" />
                      ))}
                      {timeline.returning.map((p) => (
                        <SimpleRow
                          key={p.id}
                          body={`「${firstLine(p.body)}」が戻ってくる`}
                          tag="システムが置いた"
                        />
                      ))}
                    </div>
                  </section>
                )}
              </>
            )}

            <div className="mt-1 flex justify-end gap-3 text-xs text-neutral-400">
              <a href="/api/export?format=md" className="hover:underline">
                書き出し(md)
              </a>
              <a href="/api/export?format=json" className="hover:underline">
                書き出し(json)
              </a>
            </div>
          </main>

          {/* 右: 文脈(森・木) */}
          <aside className="lg:sticky lg:top-5 lg:h-fit">
            <div className="rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
              <ContextPane reloadKey={reloadKey} onChanged={load} />
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

function SimpleList({ posts, tag }: { posts: PostDTO[]; tag: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      {posts.map((p) => (
        <SimpleRow key={p.id} body={p.body} tag={tag} estimate={p.estimate_minutes} />
      ))}
    </div>
  );
}

function SimpleRow({
  body,
  tag,
  estimate,
}: {
  body: string;
  tag: string;
  estimate?: number | null;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm dark:border-neutral-800 dark:bg-neutral-900">
      <span className="min-w-0 flex-1 truncate">{body}</span>
      {estimate != null && <span className="shrink-0 text-xs text-neutral-500">{estimate}分</span>}
      <span className="shrink-0 text-xs text-neutral-400">{tag}</span>
    </div>
  );
}

function firstLine(body: string): string {
  const line = body.split("\n")[0].trim();
  return line.length > 18 ? line.slice(0, 18) + "…" : line;
}
