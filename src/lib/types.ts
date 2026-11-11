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
};

export type Question =
  | { type: "when"; post: PostDTO }
  | { type: "carryover"; post: PostDTO }
  | { type: "morningOrder"; posts: PostDTO[] }
  | { type: "recall"; post: PostDTO };

export type CurrentQuestionResponse = {
  question: Question | null;
  remaining: number;
};
