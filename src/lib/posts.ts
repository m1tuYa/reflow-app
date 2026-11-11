import { getDb, Post } from "./db";
import { parsePromiseDate, parseEstimateMinutes } from "./parse";

const INITIAL_RECALL_INTERVAL_DAYS = 2;
const MIN_RECALL_INTERVAL_DAYS = 1;

function nowIso(): string {
  return new Date().toISOString();
}

function addDaysIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

export function createPost(input: {
  body: string;
  intent: "record" | "promise";
  parentId?: number | null;
  // 書きながら木を選んだとき。その木の最新の先端の弟として入る。
  treeRootId?: number | null;
  isConclusion?: boolean;
}): Post {
  const db = getDb();
  const now = new Date();
  const detectedDate = parsePromiseDate(input.body, now);
  const estimateMinutes = parseEstimateMinutes(input.body);

  let status: Post["status"] = input.intent;
  let promiseDate: string | null = null;
  let dateUndetermined = 0;
  let nextRecallAt: string | null = null;

  if (input.intent === "promise") {
    if (detectedDate) {
      promiseDate = detectedDate;
    } else {
      dateUndetermined = 1; // 「いつやる?」の問いが未解決
    }
  } else {
    status = "record";
    nextRecallAt = addDaysIso(INITIAL_RECALL_INTERVAL_DAYS);
  }

  // 親の決定: 明示 parentId > 選んだ木の最新の先端の弟 > なし
  let parentId: number | null = input.parentId ?? null;
  if (parentId == null && input.treeRootId != null) {
    parentId = attachParentForTree(input.treeRootId);
  }

  // 考えを木を選ばずに書いた(親なし record)とき、後で「続き?」と問う。
  // ただし、つなげる相手の木が1つも無ければ問わず新しい根にする。
  let needsContinuation = 0;
  if (
    input.intent === "record" &&
    !input.isConclusion &&
    parentId == null &&
    forestRoots().length > 0
  ) {
    needsContinuation = 1;
  }

  const ts = now.toISOString();
  const result = db
    .prepare(
      `INSERT INTO posts (body, created_at, updated_at, parent_id, status, promise_date, date_undetermined, estimate_minutes, next_recall_at, recall_interval_days, needs_continuation, is_conclusion)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      input.body,
      ts,
      ts,
      parentId,
      status,
      promiseDate,
      dateUndetermined,
      estimateMinutes,
      nextRecallAt,
      INITIAL_RECALL_INTERVAL_DAYS,
      needsContinuation,
      input.isConclusion ? 1 : 0
    );

  // つないだ先の木は「最近触った」状態にして、先端候補の順位を上げる
  if (parentId != null) touchAncestors(parentId);

  return getPost(result.lastInsertRowid as number)!;
}

export function getPost(id: number): Post | undefined {
  return getDb().prepare("SELECT * FROM posts WHERE id = ?").get(id) as Post | undefined;
}

export function updatePostBody(id: number, body: string): Post | undefined {
  getDb()
    .prepare("UPDATE posts SET body = ?, updated_at = ? WHERE id = ?")
    .run(body, nowIso(), id);
  return getPost(id);
}

export function deletePost(id: number): void {
  getDb().prepare("DELETE FROM posts WHERE id = ?").run(id);
}

export function listRecent(limit = 50): Post[] {
  return getDb()
    .prepare("SELECT * FROM posts ORDER BY created_at DESC LIMIT ?")
    .all(limit) as Post[];
}

export function listTodayPromises(dateIso: string): Post[] {
  return getDb()
    .prepare(
      `SELECT * FROM posts WHERE status IN ('promise', 'done') AND promise_date = ?
       ORDER BY order_index IS NULL, order_index ASC, created_at ASC`
    )
    .all(dateIso) as Post[];
}

export function listOverduePromises(dateIso: string): Post[] {
  return getDb()
    .prepare(
      `SELECT * FROM posts WHERE status = 'promise' AND promise_date IS NOT NULL AND promise_date < ?
       ORDER BY promise_date ASC`
    )
    .all(dateIso) as Post[];
}

export function setPromiseDate(id: number, dateIso: string | null): Post | undefined {
  getDb()
    .prepare(
      "UPDATE posts SET promise_date = ?, date_undetermined = 0, updated_at = ? WHERE id = ?"
    )
    .run(dateIso, nowIso(), id);
  return getPost(id);
}

export function reorderToday(orderedIds: number[]): void {
  const db = getDb();
  const stmt = db.prepare("UPDATE posts SET order_index = ? WHERE id = ?");
  const tx = db.transaction((ids: number[]) => {
    ids.forEach((id, idx) => stmt.run(idx, id));
  });
  tx(orderedIds);
}

export function startPromise(id: number): Post | undefined {
  getDb()
    .prepare("UPDATE posts SET started_at = ?, updated_at = ? WHERE id = ?")
    .run(nowIso(), nowIso(), id);
  return getPost(id);
}

export function finishPromise(id: number): Post | undefined {
  getDb()
    .prepare("UPDATE posts SET ended_at = ?, status = 'done', updated_at = ? WHERE id = ?")
    .run(nowIso(), nowIso(), id);
  return getPost(id);
}

export function carryOverDecision(
  id: number,
  decision: "today" | "otherDate" | "cancel",
  otherDate?: string
): Post | undefined {
  const today = new Date().toISOString().slice(0, 10);
  if (decision === "today") return setPromiseDate(id, today);
  if (decision === "otherDate" && otherDate) return setPromiseDate(id, otherDate);
  getDb()
    .prepare("UPDATE posts SET status = 'released', updated_at = ? WHERE id = ?")
    .run(nowIso(), id);
  return getPost(id);
}

export function recallAnswer(id: number, action: "write" | "skip", body?: string): void {
  const db = getDb();
  const post = getPost(id);
  if (!post) return;
  if (action === "skip") {
    const newInterval = post.recall_interval_days * 2;
    db.prepare(
      "UPDATE posts SET recall_interval_days = ?, next_recall_at = ?, last_recalled_at = ? WHERE id = ?"
    ).run(newInterval, addDaysIso(newInterval), nowIso(), id);
  } else {
    const newInterval = Math.max(MIN_RECALL_INTERVAL_DAYS, post.recall_interval_days / 2);
    db.prepare(
      "UPDATE posts SET recall_interval_days = ?, next_recall_at = ?, last_recalled_at = ? WHERE id = ?"
    ).run(newInterval, addDaysIso(newInterval), nowIso(), id);
    if (body) {
      createPost({ body, intent: "record", parentId: id });
    }
  }
}

export function snooze(id: number, hours = 4): void {
  const d = new Date();
  d.setHours(d.getHours() + hours);
  getDb().prepare("UPDATE posts SET snoozed_until = ? WHERE id = ?").run(d.toISOString(), id);
}

export function search(query: string): Post[] {
  const db = getDb();
  // trigram tokenizer can't match patterns shorter than 3 chars; fall back to LIKE for those.
  if (query.length < 3) {
    return db
      .prepare(`SELECT * FROM posts WHERE body LIKE ? ORDER BY created_at DESC LIMIT 100`)
      .all(`%${query}%`) as Post[];
  }
  return db
    .prepare(
      `SELECT p.* FROM posts p JOIN posts_fts f ON f.rowid = p.id
       WHERE posts_fts MATCH ? ORDER BY p.created_at DESC LIMIT 100`
    )
    .all(query) as Post[];
}

export function allPosts(): Post[] {
  return getDb().prepare("SELECT * FROM posts ORDER BY created_at ASC").all() as Post[];
}

// ---- 時間軸 (いま線) ----

export type TimelineItem = {
  post: Post;
  time: string; // 並べ替えに使う実効時刻(ISO)
  actualMinutes: number | null; // 約束の実績(分)
};

function actualMinutes(p: Post): number | null {
  if (p.started_at && p.ended_at) {
    return Math.round((new Date(p.ended_at).getTime() - new Date(p.started_at).getTime()) / 60000);
  }
  return null;
}

export function getTimeline(): {
  now: string;
  past: TimelineItem[];
  overdue: Post[];
  todayUpcoming: Post[];
  tomorrow: Post[];
  someday: Post[];
  returning: Post[];
  endMinutes: number;
} {
  const db = getDb();
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const tomorrowDate = new Date(now);
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  const tomorrowStr = tomorrowDate.toISOString().slice(0, 10);

  // 過去 — 記録: 記録と済みの約束、直近20件を時刻の昇順(新しいものが下=いま線に近い)
  const pastRaw = db
    .prepare(
      `SELECT * FROM posts WHERE status IN ('record','done')
       ORDER BY CASE WHEN status='done' THEN COALESCE(ended_at, updated_at) ELSE created_at END DESC
       LIMIT 20`
    )
    .all() as Post[];
  const past: TimelineItem[] = pastRaw
    .map((p) => ({
      post: p,
      time: p.status === "done" ? p.ended_at || p.updated_at : p.created_at,
      actualMinutes: actualMinutes(p),
    }))
    .sort((a, b) => a.time.localeCompare(b.time));

  const overdue = db
    .prepare(
      `SELECT * FROM posts WHERE status='promise' AND promise_date IS NOT NULL AND promise_date < ?
       ORDER BY promise_date ASC`
    )
    .all(todayStr) as Post[];

  const todayUpcoming = db
    .prepare(
      `SELECT * FROM posts WHERE status='promise' AND promise_date = ?
       ORDER BY order_index IS NULL, order_index ASC, created_at ASC`
    )
    .all(todayStr) as Post[];

  const tomorrow = db
    .prepare(
      `SELECT * FROM posts WHERE status='promise' AND promise_date = ? ORDER BY created_at ASC`
    )
    .all(tomorrowStr) as Post[];

  // いつか: 日付のない約束
  const someday = db
    .prepare(
      `SELECT * FROM posts WHERE status='promise' AND promise_date IS NULL AND date_undetermined = 0
       ORDER BY created_at ASC`
    )
    .all() as Post[];

  // システムが戻してくる過去(今はどう思う?の対象)
  const returning = db
    .prepare(
      `SELECT * FROM posts WHERE status='record' AND next_recall_at IS NOT NULL AND next_recall_at <= ?
       ORDER BY next_recall_at ASC LIMIT 5`
    )
    .all(now.toISOString()) as Post[];

  const endMinutes = todayUpcoming.reduce((s, p) => s + (p.estimate_minutes ?? 0), 0);

  return {
    now: now.toISOString(),
    past,
    overdue,
    todayUpcoming,
    tomorrow,
    someday,
    returning,
    endMinutes,
  };
}

// ---- 木構造 (段階2) ----

const STALL_DAYS = 21; // 枝が「止まった」とみなす期間

function allLiving(): Post[] {
  return getDb()
    .prepare("SELECT * FROM posts WHERE status != 'released'")
    .all() as Post[];
}

function childrenOf(all: Post[], id: number): Post[] {
  return all.filter((p) => p.parent_id === id).sort((a, b) => a.created_at.localeCompare(b.created_at));
}

// 森の根: 親のない「考え」(record/done)。親なしの約束(頼まれ仕事・ルーチン)は木に入らない。
export function forestRoots(): Post[] {
  return getDb()
    .prepare(
      "SELECT * FROM posts WHERE parent_id IS NULL AND status IN ('record','done') ORDER BY updated_at DESC"
    )
    .all() as Post[];
}

function subtreeIds(all: Post[], rootId: number): number[] {
  const ids: number[] = [];
  const stack = [rootId];
  while (stack.length) {
    const cur = stack.pop()!;
    ids.push(cur);
    for (const c of all.filter((p) => p.parent_id === cur)) stack.push(c.id);
  }
  return ids;
}

// 木の最新の先端(先端=子のない葉。最近書かれたもの)
function latestTip(all: Post[], rootId: number): Post | undefined {
  const ids = new Set(subtreeIds(all, rootId));
  const leaves = all.filter(
    (p) => ids.has(p.id) && !all.some((c) => c.parent_id === p.id)
  );
  if (leaves.length === 0) return all.find((p) => p.id === rootId);
  return leaves.sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
}

// 木を選んで書いたときの親: 最新の先端の弟(=同じ親)。先端が根なら根の子。
function attachParentForTree(rootId: number): number | null {
  const all = allLiving();
  const tip = latestTip(all, rootId);
  if (!tip) return rootId;
  if (tip.id === rootId) return rootId; // 先端が根 → 根の子
  return tip.parent_id; // 弟 = 先端と同じ親
}

function touchAncestors(id: number | null): void {
  const db = getDb();
  const all = allLiving();
  let cur = id;
  const seen = new Set<number>();
  while (cur != null && !seen.has(cur)) {
    seen.add(cur);
    db.prepare("UPDATE posts SET updated_at = ? WHERE id = ?").run(nowIso(), cur);
    const node = all.find((p) => p.id === cur);
    cur = node?.parent_id ?? null;
  }
}

export type TreeNode = {
  post: Post;
  children: TreeNode[];
  descendantCount: number; // 子と孫以下を合わせた数
};

function buildNode(all: Post[], id: number): TreeNode {
  const post = all.find((p) => p.id === id)!;
  const children = childrenOf(all, id).map((c) => buildNode(all, c.id));
  const descendantCount = children.reduce((s, c) => s + 1 + c.descendantCount, 0);
  return { post, children, descendantCount };
}

export function getTree(rootId: number): TreeNode | null {
  const all = allLiving();
  if (!all.some((p) => p.id === rootId)) return null;
  return buildNode(all, rootId);
}

export type ForestEntry = {
  root: Post;
  name: string;
  nodeCount: number; // 根を含む総数
  stalled: boolean; // 止まっている木
  lastActivity: string;
};

export function listForest(): ForestEntry[] {
  const all = allLiving();
  const roots = all
    .filter((p) => p.parent_id === null && (p.status === "record" || p.status === "done"))
    .filter((p) => p.is_conclusion === 0 || true);
  const staleBefore = new Date();
  staleBefore.setDate(staleBefore.getDate() - STALL_DAYS);
  const staleIso = staleBefore.toISOString();

  const entries = roots.map((root) => {
    const ids = subtreeIds(all, root.id);
    const nodes = all.filter((p) => ids.includes(p.id));
    const lastActivity = nodes.reduce(
      (m, p) => (p.updated_at > m ? p.updated_at : m),
      root.updated_at
    );
    return {
      root,
      name: root.tree_name || firstLine(root.body),
      nodeCount: ids.length,
      stalled: lastActivity < staleIso,
      lastActivity,
    };
  });
  return entries.sort((a, b) => b.lastActivity.localeCompare(a.lastActivity));
}

function firstLine(body: string): string {
  const line = body.split("\n")[0].trim();
  return line.length > 24 ? line.slice(0, 24) + "…" : line;
}

// 位置の手直し(段階2 #35): 子にする(onto) / 弟にする(between)
export function reparent(id: number, newParentId: number | null): Post | undefined {
  if (id === newParentId) return getPost(id);
  // 循環防止: 新しい親が自分の子孫ならやめる
  if (newParentId != null) {
    const all = allLiving();
    if (subtreeIds(all, id).includes(newParentId)) return getPost(id);
  }
  getDb()
    .prepare("UPDATE posts SET parent_id = ?, updated_at = ? WHERE id = ?")
    .run(newParentId, nowIso(), id);
  if (newParentId != null) touchAncestors(newParentId);
  return getPost(id);
}

export function renameTree(rootId: number, name: string): Post | undefined {
  getDb()
    .prepare("UPDATE posts SET tree_name = ?, updated_at = ? WHERE id = ?")
    .run(name.trim() || null, nowIso(), rootId);
  return getPost(rootId);
}

// 書く最中に右へ出す「最近触った木」(先端つき、上位3つ)
export function recentTreeTips(limit = 3): { root: Post; tip: Post }[] {
  const all = allLiving();
  return listForest()
    .slice(0, limit)
    .map((e) => ({ root: e.root, tip: latestTip(all, e.root.id)! }))
    .filter((x) => x.tip);
}

// ---- 「続き?」(段階2) ----

// ある親なし考えに対して今出す候補の木(最近触った順、拒否済みと自分を除く)
export function continuationCandidate(post: Post): Post | null {
  const rejected: number[] = JSON.parse(post.continuation_rejected || "[]");
  const cand = forestRoots().find((r) => r.id !== post.id && !rejected.includes(r.id));
  return cand ?? null;
}

export function listNeedsContinuation(): Post[] {
  return getDb()
    .prepare("SELECT * FROM posts WHERE needs_continuation = 1 ORDER BY created_at DESC")
    .all() as Post[];
}

export function resolveContinuation(
  id: number,
  decision: "yes" | "no" | "new"
): Post | undefined {
  const db = getDb();
  const post = getPost(id);
  if (!post) return;
  if (decision === "yes") {
    const cand = continuationCandidate(post);
    if (cand) {
      const parentId = attachParentForTree(cand.id);
      db.prepare(
        "UPDATE posts SET parent_id = ?, needs_continuation = 0, updated_at = ? WHERE id = ?"
      ).run(parentId, nowIso(), id);
      touchAncestors(parentId);
    } else {
      db.prepare("UPDATE posts SET needs_continuation = 0 WHERE id = ?").run(id);
    }
  } else if (decision === "no") {
    const cand = continuationCandidate(post);
    const rejected: number[] = JSON.parse(post.continuation_rejected || "[]");
    if (cand) rejected.push(cand.id);
    const next = forestRoots().find((r) => r.id !== id && !rejected.includes(r.id));
    db.prepare(
      "UPDATE posts SET continuation_rejected = ?, needs_continuation = ? WHERE id = ?"
    ).run(JSON.stringify(rejected), next ? 1 : 0, id);
  } else {
    // 新しい考え → 根のまま
    db.prepare("UPDATE posts SET needs_continuation = 0 WHERE id = ?").run(id);
  }
  return getPost(id);
}

// ---- 止まった枝 / 確かめる日 (段階3) ----

// 止まった枝: 先端(葉)の考えで、3週間伸びておらず、閉じていない・結論でない
export function listStalledTips(): Post[] {
  const all = allLiving();
  const staleBefore = new Date();
  staleBefore.setDate(staleBefore.getDate() - STALL_DAYS);
  const staleIso = staleBefore.toISOString();
  return all.filter(
    (p) =>
      p.status === "record" &&
      p.is_closed === 0 &&
      p.is_conclusion === 0 &&
      p.needs_continuation === 0 &&
      p.updated_at < staleIso &&
      (p.stalled_asked_at === null || p.stalled_asked_at < staleIso) &&
      !all.some((c) => c.parent_id === p.id) // 葉
  );
}

export function markStalledAsked(id: number): void {
  getDb().prepare("UPDATE posts SET stalled_asked_at = ? WHERE id = ?").run(nowIso(), id);
}

// 「どうなった?」書く → 結論を子として作り、枝を閉じる。続けて「やることはある?」
export function closeStalled(
  id: number,
  resolution: "write" | "release",
  conclusionBody?: string
): { closed: Post | undefined; conclusion?: Post } {
  const db = getDb();
  if (resolution === "release") {
    db.prepare("UPDATE posts SET is_closed = 1, updated_at = ? WHERE id = ?").run(nowIso(), id);
    return { closed: getPost(id) };
  }
  // 書く: 結論の子を作り、元の葉を閉じる
  db.prepare("UPDATE posts SET is_closed = 1, updated_at = ? WHERE id = ?").run(nowIso(), id);
  const conclusion = createPost({
    body: conclusionBody || "(結論)",
    intent: "record",
    parentId: id,
    isConclusion: true,
  });
  // 結論自体は再び「どうなった?」の対象にしない
  db.prepare("UPDATE posts SET is_closed = 1 WHERE id = ?").run(conclusion.id);
  return { closed: getPost(id), conclusion };
}

// 「やることはある?」ある → 決定(結論)の下に約束を置き、確かめる日(初期2週間後)を決める
export function addFollowUpPromise(
  conclusionId: number,
  body: string,
  dateIso: string | null
): Post {
  const db = getDb();
  const promise = createPost({ body, intent: "promise", parentId: conclusionId });
  if (dateIso) setPromiseDate(promise.id, dateIso);
  db.prepare("UPDATE posts SET verify_at = ? WHERE id = ?").run(addDaysIso(14), conclusionId);
  return promise;
}

export function listDueVerifications(): Post[] {
  return getDb()
    .prepare(
      "SELECT * FROM posts WHERE verify_at IS NOT NULL AND verify_at <= ? AND verified_at IS NULL ORDER BY verify_at ASC"
    )
    .all(nowIso()) as Post[];
}

export function answerVerify(id: number, body: string): Post | undefined {
  const db = getDb();
  db.prepare("UPDATE posts SET verified_at = ? WHERE id = ?").run(nowIso(), id);
  createPost({ body, intent: "record", parentId: id, isConclusion: true });
  return getPost(id);
}
