function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export function hhmm(iso: string): string {
  const d = new Date(iso);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function md(isoOrDate: string): string {
  const d = new Date(isoOrDate.length <= 10 ? isoOrDate + "T00:00:00" : isoOrDate);
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

// base(ISO) から minutes 後の HH:MM
export function hhmmAfter(baseIso: string, minutes: number): string {
  return hhmm(new Date(new Date(baseIso).getTime() + minutes * 60000).toISOString());
}

// ISO文字列(またはYYYY-MM-DD)から YYYY-MM-DD
export function dateStrOf(iso: string): string {
  const d = new Date(iso.length <= 10 ? iso + "T00:00:00" : iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// YYYY-MM-DD を delta 日ずらす
export function shiftDate(dateStr: string, delta: number): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + delta);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
