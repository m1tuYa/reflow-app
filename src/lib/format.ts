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
