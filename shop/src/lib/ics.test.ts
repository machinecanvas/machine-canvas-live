import { describe, expect, it } from "vitest";
import { buildIcs } from "./ics";

describe("buildIcs", () => {
  it("builds a valid VEVENT with UTC times and escaped text", () => {
    const ics = buildIcs({
      uid: "abc@machinecanvas",
      start: new Date("2026-10-05T08:00:00Z"),
      end: new Date("2026-10-05T12:00:00Z"),
      summary: "Wall print, installation",
      description: "Line one\nLine two",
      location: "1 High St; Lytham",
      organizerEmail: "info@example.com",
    });
    expect(ics).toContain("DTSTART:20261005T080000Z");
    expect(ics).toContain("DTEND:20261005T120000Z");
    expect(ics).toContain("SUMMARY:Wall print\\, installation");
    expect(ics).toContain("DESCRIPTION:Line one\\nLine two");
    expect(ics).toContain("LOCATION:1 High St\; Lytham");
    expect(ics.split("\r\n").every((l) => l.length <= 75)).toBe(true);
  });
});
