import { BOOKING, SLOTS, type Slot } from "@/config";

// All booking dates are plain "YYYY-MM-DD" strings in UK local time.

const TZ = BOOKING.TIMEZONE;

export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export const MONTH_RE = /^\d{4}-\d{2}$/;

/** Today's date in the business timezone. */
export function todayLocal(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function daysInMonth(month: string): string[] {
  const [y, m] = month.split("-").map(Number);
  const count = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return Array.from({ length: count }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`);
}

/** First bookable date (today + notice period) and last bookable date. */
export function bookableRange(now = new Date()): { first: string; last: string } {
  const today = todayLocal(now);
  return { first: addDays(today, BOOKING.NOTICE_DAYS + 1), last: addDays(today, BOOKING.MAX_DAYS_AHEAD) };
}

export function isBookableDate(date: string, now = new Date()): boolean {
  if (!DATE_RE.test(date)) return false;
  const { first, last } = bookableRange(now);
  return date >= first && date <= last;
}

/** Offset in minutes of the business timezone from UTC at the given instant. */
function tzOffsetMinutes(at: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(at);
  const get = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return Math.round((asUtc - at.getTime()) / 60000);
}

/** Convert a UK wall-clock date + "HH:MM" to a UTC Date. */
export function localToUtc(date: string, time: string): Date {
  const naive = new Date(`${date}T${time}:00Z`);
  const offset = tzOffsetMinutes(naive);
  return new Date(naive.getTime() - offset * 60000);
}

export function slotWindow(date: string, slot: Slot): { start: Date; end: Date } {
  return { start: localToUtc(date, SLOTS[slot].start), end: localToUtc(date, SLOTS[slot].end) };
}

export function formatLongDate(date: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T12:00:00Z`));
}

export function slotLabel(slot: Slot): string {
  const s = SLOTS[slot];
  return `${s.label} (${s.start}–${s.end})`;
}
