import "server-only";
import { bookableRange } from "@/lib/dates";

/** First and last months the calendar can show. */
export function calendarMonths(): { firstMonth: string; lastMonth: string } {
  const { first, last } = bookableRange();
  return { firstMonth: first.slice(0, 7), lastMonth: last.slice(0, 7) };
}
