import "server-only";
import { SLOTS, type Slot } from "@/config";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { busyIntervals } from "@/lib/gcal";
import { bookableRange, daysInMonth, isBookableDate, localToUtc, slotWindow } from "@/lib/dates";
import type { DayAvailability } from "@/lib/types";

const SLOT_KEYS = Object.keys(SLOTS) as Slot[];

/**
 * Availability for every day in a month ("YYYY-MM"). A slot is free when it is
 * bookable (past the notice period), not blocked out, has no live booking
 * (paid, or held with an unexpired hold) and does not overlap a busy event in
 * the Google Calendar.
 */
export async function monthAvailability(month: string): Promise<DayAvailability[]> {
  const days = daysInMonth(month);
  const first = days[0];
  const last = days[days.length - 1];
  const db = supabaseAdmin();

  const [bookings, blockouts, busy] = await Promise.all([
    db.from("bookings").select("date, slot, status, hold_expires_at").gte("date", first).lte("date", last).in("status", ["held", "paid"]),
    db.from("blockouts").select("date, slot").gte("date", first).lte("date", last),
    busyIntervals(localToUtc(first, "00:00"), localToUtc(last, "23:59")),
  ]);
  if (bookings.error) throw bookings.error;
  if (blockouts.error) throw blockouts.error;

  const now = Date.now();
  const taken = new Set<string>();
  for (const b of bookings.data) {
    const live = b.status === "paid" || (b.hold_expires_at && new Date(b.hold_expires_at).getTime() > now);
    if (live) taken.add(`${b.date}:${b.slot}`);
  }
  for (const b of blockouts.data) {
    for (const s of b.slot ? [b.slot as Slot] : SLOT_KEYS) taken.add(`${b.date}:${s}`);
  }

  return days.map((date) => {
    const bookable = isBookableDate(date);
    const slots = {} as DayAvailability["slots"];
    for (const slot of SLOT_KEYS) {
      const { start, end } = slotWindow(date, slot);
      const clash = busy.some((i) => i.start < end && i.end > start);
      slots[slot] = bookable && !clash && !taken.has(`${date}:${slot}`) ? "available" : "unavailable";
    }
    return { date, bookable, slots };
  });
}

export async function isSlotAvailable(date: string, slot: Slot): Promise<boolean> {
  if (!isBookableDate(date)) return false;
  const month = date.slice(0, 7);
  const day = (await monthAvailability(month)).find((d) => d.date === date);
  return day?.slots[slot] === "available";
}

export { bookableRange };
