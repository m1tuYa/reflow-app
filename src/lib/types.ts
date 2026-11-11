export type PostStatus = "record" | "promise" | "done" | "released";

export type PostDTO = {
  id: number;
  body: string;
  created_at: string;
  updated_at: string;
  parent_id: number | null;
  status: PostStatus;
  promise_date: string | null;
  date_undetermined: number;
  estimate_minutes: number | null;
  order_index: number | null;
  started_at: string | null;
  ended_at: string | null;
  next_recall_at: string | null;
  recall_interval_days: number;
  last_recalled_at: string | null;
  snoozed_until: string | null;
  tree_name: string | null;
  needs_continuation: number;
  continuation_rejected: string;
  is_conclusion: number;
  is_closed: number;
  stalled_asked_at: string | null;
  verify_at: string | null;
  verified_at: string | null;
};

export type Question =
  | { type: "continuation"; post: PostDTO; candidate: PostDTO }
  | { type: "when"; post: PostDTO }
  | { type: "carryover"; post: PostDTO }
  | { type: "morningOrder"; posts: PostDTO[] }
  | { type: "verify"; post: PostDTO }
  | { type: "stalled"; post: PostDTO }
  | { type: "recall"; post: PostDTO };

export type CurrentQuestionResponse = {
  question: Question | null;
  remaining: number;
};

export type TreeNodeDTO = {
  post: PostDTO;
  children: TreeNodeDTO[];
  descendantCount: number;
};

export type ForestEntryDTO = {
  root: PostDTO;
  name: string;
  nodeCount: number;
  stalled: boolean;
  lastActivity: string;
};
