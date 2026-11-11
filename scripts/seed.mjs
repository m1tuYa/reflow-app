// 往還の動作確認用シード。既存の data/reflow.db を作り直して現実的なデータを入れる。
// 使い方: npm run seed
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, "..", "data");
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
const dbPath = path.join(dataDir, "reflow.db");

for (const suffix of ["", "-wal", "-shm"]) {
  const f = dbPath + suffix;
  if (fs.existsSync(f)) fs.rmSync(f);
}

const db = new Database(dbPath);
db.pragma("journal_mode = WAL");
db.exec(`
  CREATE TABLE posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    body TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    parent_id INTEGER REFERENCES posts(id) ON DELETE SET NULL,
    status TEXT NOT NULL CHECK(status IN ('record','promise','done','released')),
    promise_date TEXT,
    date_undetermined INTEGER NOT NULL DEFAULT 0,
    estimate_minutes INTEGER,
    order_index INTEGER,
    started_at TEXT,
    ended_at TEXT,
    next_recall_at TEXT,
    recall_interval_days REAL NOT NULL DEFAULT 2,
    last_recalled_at TEXT,
    snoozed_until TEXT,
    tree_name TEXT,
    needs_continuation INTEGER NOT NULL DEFAULT 0,
    continuation_rejected TEXT NOT NULL DEFAULT '[]',
    is_conclusion INTEGER NOT NULL DEFAULT 0,
    is_closed INTEGER NOT NULL DEFAULT 0,
    stalled_asked_at TEXT,
    verify_at TEXT,
    verified_at TEXT
  );
  CREATE TABLE daily_state (
    date TEXT PRIMARY KEY,
    carryover_shown INTEGER NOT NULL DEFAULT 0,
    order_confirmed_at TEXT,
    recall_shown INTEGER NOT NULL DEFAULT 0,
    close_shown INTEGER NOT NULL DEFAULT 0
  );
  CREATE VIRTUAL TABLE posts_fts USING fts5(body, content='posts', content_rowid='id', tokenize='trigram');
  CREATE TRIGGER posts_ai AFTER INSERT ON posts BEGIN
    INSERT INTO posts_fts(rowid, body) VALUES (new.id, new.body);
  END;
  CREATE TRIGGER posts_ad AFTER DELETE ON posts BEGIN
    INSERT INTO posts_fts(posts_fts, rowid, body) VALUES('delete', old.id, old.body);
  END;
  CREATE TRIGGER posts_au AFTER UPDATE ON posts BEGIN
    INSERT INTO posts_fts(posts_fts, rowid, body) VALUES('delete', old.id, old.body);
    INSERT INTO posts_fts(rowid, body) VALUES (new.id, new.body);
  END;
`);

const now = new Date();
const iso = (d) => d.toISOString();
const daysAgo = (n) => {
  const d = new Date(now);
  d.setDate(d.getDate() - n);
  return iso(d);
};
const dateOnly = (n) => daysAgo(n).slice(0, 10); // n日前(マイナスで未来)
const todayDate = dateOnly(0);
const minsAgo = (n) => {
  const d = new Date(now);
  d.setMinutes(d.getMinutes() - n);
  return iso(d);
};

const cols = [
  "body", "created_at", "updated_at", "parent_id", "status", "promise_date",
  "date_undetermined", "estimate_minutes", "order_index", "started_at", "ended_at",
  "next_recall_at", "recall_interval_days", "last_recalled_at", "snoozed_until",
  "tree_name", "needs_continuation", "continuation_rejected", "is_conclusion",
  "is_closed", "stalled_asked_at", "verify_at", "verified_at",
];
const stmt = db.prepare(
  `INSERT INTO posts (${cols.join(",")}) VALUES (${cols.map(() => "?").join(",")})`
);

function insert(o) {
  const def = {
    parent_id: null, status: "record", promise_date: null, date_undetermined: 0,
    estimate_minutes: null, order_index: null, started_at: null, ended_at: null,
    next_recall_at: null, recall_interval_days: 2, last_recalled_at: null,
    snoozed_until: null, tree_name: null, needs_continuation: 0,
    continuation_rejected: "[]", is_conclusion: 0, is_closed: 0,
    stalled_asked_at: null, verify_at: null, verified_at: null,
  };
  const r = { ...def, ...o };
  const created = r.created_at ?? daysAgo(1);
  const updated = r.updated_at ?? created;
  const info = stmt.run(
    r.body, created, updated, r.parent_id, r.status, r.promise_date,
    r.date_undetermined, r.estimate_minutes, r.order_index, r.started_at, r.ended_at,
    r.next_recall_at, r.recall_interval_days, r.last_recalled_at, r.snoozed_until,
    r.tree_name, r.needs_continuation, r.continuation_rejected, r.is_conclusion,
    r.is_closed, r.stalled_asked_at, r.verify_at, r.verified_at
  );
  return info.lastInsertRowid;
}

// ===== 考えの木 =====

// 木A: 往還を毎日使う実験 — 結論+確かめる日(今日が確認日 → 効いた?が出る)
const A = insert({
  body: "往還を毎日使う実験を始めた。義務に感じたらすぐ見直す。",
  tree_name: "往還を毎日使う実験",
  created_at: daysAgo(20), updated_at: daysAgo(2),
});
const A1 = insert({
  body: "問いが多すぎると朝に開くのが億劫になる。",
  parent_id: A, created_at: daysAgo(18), updated_at: daysAgo(3),
});
insert({
  body: "朝の問いを5問までに絞ると、ちょうど心地よかった。これを基本にする。",
  parent_id: A1, is_conclusion: 1, is_closed: 1,
  created_at: daysAgo(16), updated_at: daysAgo(16),
  verify_at: daysAgo(1), // 確かめる日が来た → 「効いた?」
});
insert({
  body: "朝の順番確認が実際に効くか2週間観察する。",
  parent_id: A, created_at: daysAgo(6), updated_at: daysAgo(1),
});

// 木B: 家計調査 — 止まった枝(30日更新なしの葉 → どうなった?が出る)
const B = insert({
  body: "家系・家計の調査をどう進めるか。戸籍PDFが約50枚ある。",
  tree_name: "家系調査の進め方",
  created_at: daysAgo(40), updated_at: daysAgo(4),
});
insert({
  body: "PIIを含むので処理は全部ローカルで完結させる。承認ゲートを必ず挟む。",
  parent_id: B, created_at: daysAgo(35), updated_at: daysAgo(4),
});
insert({
  body: "祖父母の代から時代を遡る順に読むと混乱しにくいはず。試していない。",
  parent_id: B, created_at: daysAgo(30), updated_at: daysAgo(30), // 止まった葉
});

// 木C: 読書メモ
const C = insert({
  body: "『時間術大全』を読み始めた。",
  tree_name: "読書『時間術大全』",
  created_at: daysAgo(10), updated_at: daysAgo(2),
});
insert({
  body: "毎日「一番大事なこと」を1つだけ選ぶ、という考えが刺さった。",
  parent_id: C, created_at: daysAgo(9), updated_at: daysAgo(2),
});
insert({
  body: "SNSはログアウトして摩擦を増やすと触る回数が減る。",
  parent_id: C, created_at: daysAgo(8), updated_at: daysAgo(5),
});

// 木D: 新しめの考え
const D = insert({
  body: "ブログをまた始めるか迷っている。続くか不安。",
  tree_name: "ブログを再開するか",
  created_at: daysAgo(3), updated_at: daysAgo(1),
});
insert({
  body: "公開前に10記事ためてから出すと、初速の不安が減りそう。",
  parent_id: D, created_at: daysAgo(2), updated_at: daysAgo(1),
});

// 木E: ずっと止まっている木(森で薄く表示される)
const E = insert({
  body: "英語のやり直しをしたい。",
  tree_name: "英語やり直し",
  created_at: daysAgo(60), updated_at: daysAgo(45),
});
insert({
  body: "まずは通勤中のポッドキャストから、と思ったが手をつけていない。",
  parent_id: E, created_at: daysAgo(50), updated_at: daysAgo(45),
});

// ===== 約束(タスク) =====

// 今日の約束(いま線)
insert({ body: "請求書を送る", status: "promise", promise_date: todayDate, estimate_minutes: 30, created_at: daysAgo(1) });
insert({ body: "ジムに行く", status: "promise", promise_date: todayDate, estimate_minutes: 60, created_at: daysAgo(1) });
// 済み(実績/見積が見えるよう時間差をつける。1つは見積内、1つは超過=赤)
insert({
  body: "朝の移行判断", status: "done", promise_date: todayDate, estimate_minutes: 30,
  started_at: minsAgo(480), ended_at: minsAgo(451), created_at: minsAgo(500), // 実績29分
});
insert({
  body: "手順書の改訂", status: "done", promise_date: todayDate, estimate_minutes: 60,
  started_at: minsAgo(260), ended_at: minsAgo(180), created_at: minsAgo(300), // 実績80分(+20)
});

// 持ち越し(昨日やらなかった → いま線に溜まる)
insert({ body: "読書メモの続き(第3章)", status: "promise", promise_date: dateOnly(1), estimate_minutes: 25, created_at: daysAgo(2) });

// 明日の約束
insert({ body: "歯医者", status: "promise", promise_date: dateOnly(-1), estimate_minutes: 30, created_at: daysAgo(1) });

// いつやる?(日付未検出 → いつやる?が出る)
insert({ body: "確定申告の準備を始める", status: "promise", date_undetermined: 1, created_at: daysAgo(1) });

// いつか(日付なしの約束)
insert({ body: "本棚を整理する", status: "promise", promise_date: null, date_undetermined: 0, created_at: daysAgo(5) });

// ルーチン的な先の約束
insert({ body: "週報を書く", status: "promise", promise_date: dateOnly(-2), estimate_minutes: 20, created_at: daysAgo(1) });

// 頼まれ仕事(親なしの約束。木には入らない)
insert({ body: "同僚のPRレビューを返す", status: "promise", promise_date: todayDate, estimate_minutes: 15, created_at: daysAgo(0) });

// ===== 過去の戻り & 単独メモ =====

// 戻りが来る考え(今はどう思う?が出る)
insert({
  body: "去年の目標は『毎週ジムに通う』だった。今もこれは有効だろうか。",
  tree_name: "去年の目標を見直す",
  created_at: daysAgo(90), updated_at: daysAgo(30),
  next_recall_at: daysAgo(1), last_recalled_at: daysAgo(14), recall_interval_days: 8,
});

// 木を選ばずに書いた考え(続き?が出る)
insert({
  body: "散歩中に思いついた: 往還に小さなウィジェットがあると、書く衝動を逃さないかも。",
  needs_continuation: 1, created_at: daysAgo(0),
});

// 単独メモ
insert({ body: "引っ越しの見積もりは3社取ると相場がわかる、と聞いた。", created_at: daysAgo(7), updated_at: daysAgo(7) });

const count = db.prepare("SELECT COUNT(*) AS n FROM posts").get().n;
console.log(`seeded ${count} posts into ${dbPath}`);
db.close();
