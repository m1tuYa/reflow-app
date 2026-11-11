"use client";

import { useCallback, useEffect, useState } from "react";
import { CaptureInput } from "@/components/CaptureInput";
import { QuestionCard } from "@/components/QuestionCard";
import { TodayPromises } from "@/components/TodayPromises";
import { RecentFeed } from "@/components/RecentFeed";
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

  const load = useCallback(() => {
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

  useEffect(() => {
    load();
  }, [load]);

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
    <div className="min-h-screen bg-neutral-100 px-4 py-8 dark:bg-neutral-950 dark:text-neutral-100">
      <main className="mx-auto flex max-w-xl flex-col gap-4">
        <h1 className="text-lg font-semibold">往還</h1>

        <CaptureInput onCreated={load} />

        {question.question && (
          <QuestionCard
            question={question.question}
            remaining={question.remaining}
            onAnswered={load}
          />
        )}

        <hr className="border-neutral-300 dark:border-neutral-700" />

        <section>
          <h2 className="mb-2 text-sm font-semibold text-neutral-500">いま線 — 今日の約束</h2>
          <TodayPromises posts={today} onChanged={load} />
        </section>

        <hr className="border-neutral-300 dark:border-neutral-700" />

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
    </div>
  );
}
