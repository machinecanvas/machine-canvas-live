import { NextResponse, type NextRequest } from "next/server";
import { monthAvailability } from "@/lib/availability";
import { MONTH_RE } from "@/lib/dates";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const month = req.nextUrl.searchParams.get("month") ?? "";
  if (!MONTH_RE.test(month)) return NextResponse.json({ error: "Invalid month" }, { status: 400 });
  if (!(await rateLimit("availability", 120, 60))) {
    return NextResponse.json({ error: "Too many requests, please slow down." }, { status: 429 });
  }
  try {
    return NextResponse.json({ days: await monthAvailability(month) }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("availability failed", e);
    return NextResponse.json({ error: "Could not load availability. Please try again." }, { status: 500 });
  }
}
