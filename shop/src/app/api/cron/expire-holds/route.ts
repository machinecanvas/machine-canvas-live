import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";
import { expireStaleHolds } from "@/lib/booking";

export const dynamic = "force-dynamic";

// Vercel Cron (see vercel.json) calls this every minute with
// "Authorization: Bearer $CRON_SECRET".
export async function GET(req: NextRequest) {
  if (req.headers.get("authorization") !== `Bearer ${env.cronSecret()}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const expired = await expireStaleHolds();
  return NextResponse.json({ expired });
}
