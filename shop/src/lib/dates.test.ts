import { describe, expect, it } from "vitest";
import { addDays, bookableRange, daysInMonth, isBookableDate, localToUtc, todayLocal } from "./dates";

describe("dates", () => {
  it("converts UK wall-clock time to UTC across DST", () => {
    expect(localToUtc("2026-07-01", "09:00").toISOString()).toBe("2026-07-01T08:00:00.000Z"); // BST
    expect(localToUtc("2026-12-01", "09:00").toISOString()).toBe("2026-12-01T09:00:00.000Z"); // GMT
  });

  it("uses the UK date, not the UTC date", () => {
    // 23:30 UTC on 30 June is 00:30 BST on 1 July
    expect(todayLocal(new Date("2026-06-30T23:30:00Z"))).toBe("2026-07-01");
  });

  it("enforces the notice period", () => {
    const now = new Date("2026-10-01T10:00:00Z");
    expect(bookableRange(now).first).toBe("2026-10-04");
    expect(isBookableDate("2026-10-03", now)).toBe(false);
    expect(isBookableDate("2026-10-04", now)).toBe(true);
    expect(isBookableDate("2026-09-30", now)).toBe(false);
  });

  it("lists days in a month and adds days", () => {
    expect(daysInMonth("2028-02")).toHaveLength(29);
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });
});
