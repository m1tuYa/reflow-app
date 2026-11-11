"use client";

import { useCallback, useEffect, useState } from "react";
import { CaptureInput } from "@/components/CaptureInput";
import { QuestionCard } from "@/components/QuestionCard";
import { TodayPromises } from "@/components/TodayPromises";
import { RecentFeed } from "@/components/RecentFeed";
import { ContextPane } from "@/components/ContextPane";
import { CurrentQuestionResponse, PostDTO } from "@/lib/types";

export default function Home() {
  const [question, setQuestion] = useState<CurrentQuestionResponse>({
    question: null,
    remaining: 0,
  });
  const [today, setToday] = useState<PostDTO[]>([]);
  const [recent, setRecent] = useState<PostDTO[]>([]);
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<PostDTO[] | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const refetch = useCallback(() => {
    fetch("/api/questions/current")
      .then((r) => r.json())
      .then(setQuestion);
    fetch("/api/posts?scope=today")
      .then((r) => r.json())
      .then(setToday);
    fetch("/api/posts?scope=recent")
      .then((r) => r.json())
      .then(setRecent);
  }, []);

  // 左で何か変わったら右(文脈ペイン)も更新する
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
    <div className="min-h-screen bg-neutral-100 px-4 py-6 dark:bg-neutral-950 dark:text-neutral-100">
      <div className="mx-auto max-w-5xl">
        <h1 className="mb-4 text-lg font-semibold">往還</h1>
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          {/* 左: 時間軸(書く・答える・やる) */}
          <main className="flex flex-col gap-4">
            <CaptureInput onCreated={load} />

            {question.question && (
              <QuestionCard
                question={question.question}
                remaining={question.remaining}
                onAnswered={load}
              />
            )}

            <section>
              <h2 className="mb-2 text-sm font-semibold text-neutral-500">
                いま線 — 今日の約束
              </h2>
              <TodayPromises posts={today} onChanged={load} />
            </section>

            <section>
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-neutral-500">記録</h2>
                <div className="flex gap-2 text-xs">
                  <a href="/api/export?format=md" className="underline">
                    書き出し(md)
                  </a>
                  <a href="/api/export?format=json" className="underline">
                    書き出し(json)
                  </a>
                </div>
              </div>
              <input
                type="text"
                placeholder="探す"
                value={query}
                onChange={(e) => handleQueryChange(e.target.value)}
                className="mb-2 w-full rounded border border-neutral-300 bg-transparent px-2 py-1 text-sm outline-none dark:border-neutral-700"
              />
              <RecentFeed posts={searchResults ?? recent} onChanged={load} />
            </section>
          </main>

          {/* 右: 文脈(森・木) */}
          <aside className="lg:sticky lg:top-6 lg:h-fit">
            <div className="rounded-lg border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-900">
              <ContextPane reloadKey={reloadKey} onChanged={load} />
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
