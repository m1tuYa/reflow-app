"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CaptureInput } from "@/components/CaptureInput";
import { QuestionCard } from "@/components/QuestionCard";
import { TodayPromises } from "@/components/TodayPromises";
import { PastList } from "@/components/PastList";
import { CarryoverPile } from "@/components/CarryoverPile";
import { RecentFeed } from "@/components/RecentFeed";
import { ContextPane } from "@/components/ContextPane";
import { ManagePanel } from "@/components/ManagePanel";
import { PostCard } from "@/components/PostCard";
import { TreePicker, AttachTarget } from "@/components/TreePicker";
import { TodaySchedule } from "@/components/TodaySchedule";
import { VerifySummary } from "@/components/VerifySummary";
import { CardActionsContext } from "@/components/CardActions";
import {
  CurrentQuestionResponse,
  PostDTO,
  QuestionContext,
  TimelineDTO,
  TimelineItemDTO,
} from "@/lib/types";
import { dateStrOf, hhmm, hhmmAfter, md, shiftDate } from "@/lib/format";

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
    context: null,
  });
  const [timeline, setTimeline] = useState<TimelineDTO>(EMPTY_TIMELINE);
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<PostDTO[] | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [viewDate, setViewDate] = useState<string | null>(null); // 別の日を見る(#44)
  const [dayItems, setDayItems] = useState<TimelineItemDTO[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [connectingId, setConnectingId] = useState<number | null>(null); // つなぎ直し中
  const [justWrittenId, setJustWrittenId] = useState<number | null>(null);
  const [dismissedRunningId, setDismissedRunningId] = useState<number | null>(null);
  const [focusInfo, setFocusInfo] = useState<{
    id: number;
    context: QuestionContext;
    post: PostDTO | null;
  } | null>(null);
  const [writing, setWriting] = useState(false);
  const [attach, setAttach] = useState<AttachTarget | null>(null);
  const [pastOpen, setPastOpen] = useState(false); // 過去—記録は既定で畳む

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

  // ---- 左の動きに右が応じる ----
  // 右に出すものの優先順位:
  //  書いている → つなぐ先を選ぶ / つなぎ直し中 → つなぐ先を選ぶ / 選んだカード → その位置
  //  → いま書いた投稿の位置 → 実行中の約束の「なぜ」 → 問いの文脈 → 森
  const runningPost = timeline.todayUpcoming.find((p) => p.started_at && !p.ended_at) ?? null;
  const runningId =
    runningPost && runningPost.id !== dismissedRunningId ? runningPost.id : null;
  const activeId = selectedId ?? justWrittenId ?? runningId;

  useEffect(() => {
    if (activeId == null) return;
    let cancelled = false;
    fetch(`/api/context?post=${activeId}`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        if (d.exists === false) {
          // 消えたカードなら選択を外す
          setSelectedId((cur) => (cur === activeId ? null : cur));
          setJustWrittenId((cur) => (cur === activeId ? null : cur));
          setConnectingId((cur) => (cur === activeId ? null : cur));
        }
        setFocusInfo({ id: activeId, context: d.context ?? null, post: d.post ?? null });
      });
    return () => {
      cancelled = true;
    };
  }, [activeId, reloadKey]);

  const info = focusInfo && focusInfo.id === activeId ? focusInfo : null;

  function selectCard(id: number | null) {
    setSelectedId(id);
    setConnectingId(null);
    setJustWrittenId(null);
  }

  function clearFocus() {
    setSelectedId(null);
    setConnectingId(null);
    setJustWrittenId(null);
  }

  const requestConnect = useCallback((id: number) => {
    setSelectedId(id);
    setConnectingId(id);
    setJustWrittenId(null);
  }, []);

  async function connectTo(id: number, target: AttachTarget | null) {
    await fetch("/api/posts/reparent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, newParentId: target?.parentId ?? null }),
    });
    setConnectingId(null);
    load();
  }

  // Esc で選択を外す
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
      setSelectedId(null);
      setConnectingId(null);
      setJustWrittenId(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const cardActions = useMemo(() => ({ requestConnect }), [requestConnect]);

  function renderPane() {
    if (writing) {
      return (
        <TreePicker
          key="write"
          title="書いている考えを、どの木につなぐ?"
          hint="選ばなくても大丈夫。書いた後に「続き?」と聞きます。"
          selected={attach}
          onPick={setAttach}
          reloadKey={reloadKey}
        />
      );
    }
    const connectId = connectingId ?? (selectedId != null && info && !info.context ? selectedId : null);
    if (connectId != null && info?.post) {
      const p = info.post;
      const moving = connectingId != null;
      return (
        <div>
          <div className="mb-3 rounded border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm dark:border-neutral-800 dark:bg-neutral-950">
            <p className="mb-0.5 text-xs text-neutral-500">
              {moving
                ? "このカードをつなぎ直す"
                : p.status === "promise"
                  ? "この約束はまだ「なぜ」につながっていません(つながなくても大丈夫)"
                  : "このカードはまだどの木にもつながっていません"}
            </p>
            <p className="line-clamp-3">{p.body}</p>
          </div>
          <TreePicker
            key={`connect:${connectId}`}
            title="つなぐ先を選ぶ"
            selected={null}
            excludeId={p.id}
            confirmLabel="ここにつなぐ"
            allowNewRoot={p.parent_id != null && p.status !== "promise" ? "木から外して新しい木にする" : undefined}
            onPick={(t) => connectTo(p.id, t)}
            reloadKey={reloadKey}
          />
          {moving && (
            <button
              onClick={() => setConnectingId(null)}
              className="mt-3 text-xs text-neutral-500 underline"
            >
              やめる
            </button>
          )}
        </div>
      );
    }
    if (selectedId != null) {
      if (!info) return <p className="text-sm text-neutral-500">読み込み中…</p>;
      return (
        <ContextPane
          reloadKey={reloadKey}
          context={info.context}
          contextLabel="選んだカードの位置"
          headerExtra={
            <button
              onClick={() => requestConnect(selectedId)}
              className="text-xs text-neutral-500 underline"
            >
              つなぎ直す
            </button>
          }
          onLeave={clearFocus}
          onChanged={load}
        />
      );
    }
    if (justWrittenId != null && info?.context) {
      return (
        <ContextPane
          reloadKey={reloadKey}
          context={info.context}
          contextLabel="いま書いた投稿の位置"
          onLeave={() => setJustWrittenId(null)}
          onChanged={load}
        />
      );
    }
    if (runningId != null && info?.context) {
      return (
        <ContextPane
          reloadKey={reloadKey}
          context={info.context}
          contextLabel="いまやっている約束の「なぜ」"
          onLeave={() => setDismissedRunningId(runningId)}
          onChanged={load}
        />
      );
    }
    const qt = question.question?.type;
    if (qt === "morningOrder" || qt === "carryover") {
      return (
        <TodaySchedule
          label="この問いに答えるための文脈"
          now={timeline.now}
          posts={timeline.todayUpcoming}
          overdue={timeline.overdue}
        />
      );
    }
    if (question.question?.type === "verify" && question.context) {
      return (
        <>
          <VerifySummary
            rootId={question.context.rootId}
            decisionId={question.question.post.id}
            reloadKey={reloadKey}
          />
          <ContextPane reloadKey={reloadKey} context={question.context} onChanged={load} />
        </>
      );
    }
    return <ContextPane reloadKey={reloadKey} context={question.context} onChanged={load} />;
  }

  const loadDay = useCallback((date: string) => {
    fetch(`/api/day?date=${date}`)
      .then((r) => r.json())
      .then((d) => setDayItems(d.items ?? []));
  }, []);

  useEffect(() => {
    if (viewDate) loadDay(viewDate);
  }, [viewDate, loadDay, reloadKey]);

  const todayStr = timeline.now ? dateStrOf(timeline.now) : "";
  const shownDate = viewDate ?? todayStr;

  return (
    <CardActionsContext.Provider value={cardActions}>
    <div className="min-h-screen bg-neutral-100 px-4 py-5 dark:bg-neutral-950 dark:text-neutral-100">
      <div className="mx-auto max-w-6xl">
        {/* ヘッダー */}
        <header className="mb-5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-semibold">往還</h1>
            {shownDate && (
              <div className="flex items-center gap-1 text-sm text-neutral-500">
                <button
                  onClick={() => setViewDate(shiftDate(shownDate, -1))}
                  className="rounded px-1 hover:bg-neutral-200 dark:hover:bg-neutral-800"
                  title="前の日"
                >
                  ◀
                </button>
                <input
                  type="date"
                  value={shownDate}
                  onChange={(e) =>
                    setViewDate(e.target.value === todayStr ? null : e.target.value)
                  }
                  className="bg-transparent text-sm outline-none"
                />
                <button
                  onClick={() =>
                    setViewDate(
                      shiftDate(shownDate, 1) > todayStr ? null : shiftDate(shownDate, 1)
                    )
                  }
                  className="rounded px-1 hover:bg-neutral-200 dark:hover:bg-neutral-800"
                  title="次の日"
                >
                  ▶
                </button>
                {viewDate && (
                  <button onClick={() => setViewDate(null)} className="ml-1 underline">
                    今日へ
                  </button>
                )}
              </div>
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
                <RecentFeed
                  posts={searchResults}
                  selectedId={selectedId}
                  onSelect={selectCard}
                  onChanged={load}
                />
              </section>
            ) : viewDate ? (
              <section>
                <h2 className="mb-2 text-sm font-semibold text-neutral-500">
                  {md(viewDate)} の記録
                </h2>
                {dayItems.length === 0 ? (
                  <p className="text-sm text-neutral-500">この日の記録はありません</p>
                ) : (
                  <PastList
                    items={dayItems}
                    selectedId={selectedId}
                    onSelect={selectCard}
                    onChanged={load}
                  />
                )}
              </section>
            ) : (
              <>
                {/* 過去 — 記録(既定で畳む。開くとスクロールでさかのぼれる) */}
                <section>
                  <button
                    onClick={() => setPastOpen((o) => !o)}
                    className="mb-2 flex w-full items-center gap-2 text-xs font-semibold tracking-wide text-neutral-500"
                  >
                    <span>{pastOpen ? "▾" : "▸"}</span>
                    <span>過去 — 記録</span>
                    <span className="font-normal text-neutral-400">{timeline.past.length}件</span>
                  </button>
                  {pastOpen && (
                    <div className="max-h-96 overflow-y-auto pr-1">
                      <PastList
                        items={timeline.past}
                        selectedId={selectedId}
                        onSelect={selectCard}
                        onChanged={load}
                      />
                    </div>
                  )}
                </section>

                {/* 出ている問い(いま線のすぐ上) */}
                {question.question &&
                  (writing ? (
                    // 書いている最中は問いを畳む(書きたい衝動を優先)
                    <p className="rounded-lg border border-dashed border-neutral-300 px-3 py-2 text-xs text-neutral-500 dark:border-neutral-700">
                      問いは書き終えたら戻ります(あと{question.remaining + 1}問)
                    </p>
                  ) : (
                    <QuestionCard
                      question={question.question}
                      remaining={question.remaining}
                      onAnswered={load}
                    />
                  ))}

                {/* いま線 */}
                <div className="flex items-center gap-2 py-1">
                  <span className="h-2 w-2 rounded-full bg-blue-600" />
                  <span className="text-sm font-medium text-blue-700 dark:text-blue-400">
                    いま {timeline.now ? hhmm(timeline.now) : "—"}
                  </span>
                  <span className="h-px flex-1 bg-blue-600/40" />
                </div>

                <CaptureInput
                  attach={attach}
                  onAttachChange={setAttach}
                  onWritingChange={setWriting}
                  onCreated={(post) => {
                    setSelectedId(null);
                    setConnectingId(null);
                    setJustWrittenId(post.id);
                    load();
                  }}
                />

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
                    selectedId={selectedId}
                    onSelect={selectCard}
                    onChanged={load}
                  />
                </section>

                {/* 明日 */}
                {timeline.tomorrow.length > 0 && (
                  <section>
                    <h2 className="mb-2 text-xs font-semibold tracking-wide text-neutral-500">
                      明日
                    </h2>
                    <div className="flex flex-col gap-1.5">
                      {timeline.tomorrow.map((p) => (
                        <PostCard
                          key={p.id}
                          post={p}
                          selected={selectedId === p.id}
                          onToggle={selectCard}
                          onChanged={load}
                          trailing={<Tag>自分が置いた</Tag>}
                        />
                      ))}
                    </div>
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
                        <PostCard
                          key={p.id}
                          post={p}
                          selected={selectedId === p.id}
                          onToggle={selectCard}
                          onChanged={load}
                          trailing={<Tag>自分が置いた</Tag>}
                        />
                      ))}
                      {timeline.returning.map((p) => (
                        <PostCard
                          key={p.id}
                          post={p}
                          selected={selectedId === p.id}
                          onToggle={selectCard}
                          onChanged={load}
                          trailing={<Tag>戻ってくる</Tag>}
                        />
                      ))}
                    </div>
                  </section>
                )}
              </>
            )}

            <div className="mt-1 flex items-center justify-between">
              <ManagePanel onChanged={load} />
              <div className="flex gap-3 text-xs text-neutral-400">
                <a href="/api/export?format=md" className="hover:underline">
                  書き出し(md)
                </a>
                <a href="/api/export?format=json" className="hover:underline">
                  書き出し(json)
                </a>
              </div>
            </div>
          </main>

          {/* 右: 文脈(森・木) */}
          <aside className="lg:sticky lg:top-5 lg:h-fit">
            <div className="rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
              {renderPane()}
            </div>
          </aside>
        </div>
      </div>
    </div>
    </CardActionsContext.Provider>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return <span className="shrink-0 self-start text-xs text-neutral-400">{children}</span>;
}
