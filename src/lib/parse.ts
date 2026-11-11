const WEEKDAY_KANJI = ["日", "月", "火", "水", "木", "金", "土"];

function toISODate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

function addDays(d: Date, days: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + days);
  return r;
}

// Reads a relative/absolute date expression out of free text (今日/明日/明後日/金曜/11/20 etc).
// Returns null when no date expression is found, meaning the post stays an untimed capture.
export function parsePromiseDate(text: string, now: Date = new Date()): string | null {
  if (/明後日/.test(text)) return toISODate(addDays(now, 2));
  if (/明日/.test(text)) return toISODate(addDays(now, 1));
  if (/今日/.test(text)) return toISODate(now);

  const weekdayMatch = text.match(/([日月火水木金土])曜(日)?/);
  if (weekdayMatch) {
    const target = WEEKDAY_KANJI.indexOf(weekdayMatch[1]);
    const todayIdx = now.getDay();
    let diff = target - todayIdx;
    if (diff < 0) diff += 7;
    return toISODate(addDays(now, diff));
  }

  const mdMatch = text.match(/(\d{1,2})\/(\d{1,2})/) || text.match(/(\d{1,2})月(\d{1,2})日/);
  if (mdMatch) {
    const month = parseInt(mdMatch[1], 10);
    const day = parseInt(mdMatch[2], 10);
    let year = now.getFullYear();
    let candidate = new Date(year, month - 1, day);
    if (candidate < new Date(now.getFullYear(), now.getMonth(), now.getDate())) {
      year += 1;
      candidate = new Date(year, month - 1, day);
    }
    return toISODate(candidate);
  }

  return null;
}

// Reads an estimate expression (30分 / 1時間 / 1時間30分) out of free text.
export function parseEstimateMinutes(text: string): number | null {
  const hm = text.match(/(\d+)\s*時間\s*(\d+)?\s*分?/);
  if (hm) {
    const hours = parseInt(hm[1], 10);
    const mins = hm[2] ? parseInt(hm[2], 10) : 0;
    return hours * 60 + mins;
  }
  const m = text.match(/(\d+)\s*分/);
  if (m) return parseInt(m[1], 10);
  return null;
}
