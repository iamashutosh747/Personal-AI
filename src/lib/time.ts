import type { World } from "./types";

/** Hour of day (0-23) in the given IANA time zone. */
export function hourIn(timeZone: string, now = new Date()): number {
  try {
    const h = new Intl.DateTimeFormat("en-US", { hour: "numeric", hour12: false, timeZone }).format(now);
    return Number(h) % 24;
  } catch {
    return now.getUTCHours();
  }
}

/** YYYY-MM-DD for "today" in the given time zone. */
export function todayIn(timeZone: string, now = new Date()): string {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  } catch {
    return now.toISOString().slice(0, 10);
  }
}

export function greetingFor(hour: number): string {
  if (hour < 5) return "Still awake";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  if (hour < 22) return "Good evening";
  return "Late night";
}

/** When automatic worlds are on, the light follows the clock. */
export function worldForHour(hour: number, chosen: World): World {
  if (hour >= 0 && hour < 5) return "quiet-observatory";
  if (hour >= 5 && hour < 8) return "golden-hour";
  if (hour >= 17 && hour < 20) return "golden-hour";
  if (hour >= 20) return "midnight-library";
  return chosen;
}

export function formatDate(iso: string | null | undefined, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "long", year: "numeric" }) {
  if (!iso) return "";
  const d = iso.length === 10 ? new Date(`${iso}T12:00:00Z`) : new Date(iso);
  return new Intl.DateTimeFormat("en-GB", { ...opts, timeZone: iso.length === 10 ? "UTC" : undefined }).format(d);
}

export function relativeTime(iso: string, now = new Date()): string {
  const diff = (now.getTime() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} h ago`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)} d ago`;
  return formatDate(iso, { day: "numeric", month: "short", year: diff > 86400 * 300 ? "numeric" : undefined });
}

/** Local midnight on `date` (YYYY-MM-DD) for a browser whose Date#getTimezoneOffset() is `offsetMinutes`. */
export function localMidnightUtc(date: string, offsetMinutes: number) {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d) + offsetMinutes * 60000);
}

// Request-time clock helpers. Server components render once per request, so
// reading the clock there is correct; these keep that intent explicit.
export const nowMs = () => Date.now();
export const isoNow = () => new Date().toISOString();
export const isoDaysAgo = (days: number) => new Date(Date.now() - days * 86400000).toISOString();
export const isPast = (iso: string) => Date.parse(iso) <= Date.now();

export function pickOne<T>(list: T[]): T | undefined {
  return list.length ? list[Math.floor(Math.random() * list.length)] : undefined;
}
