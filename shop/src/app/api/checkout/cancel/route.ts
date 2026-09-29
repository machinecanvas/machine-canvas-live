import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { releaseHold } from "@/lib/booking";
import { shopUrl } from "@/lib/env";

// Stripe's cancel_url lands here: free the held slot, then show the page.
export async function GET(req: NextRequest) {
  const id = z.uuid().safeParse(req.nextUrl.searchParams.get("booking"));
  if (id.success) {
    await releaseHold(id.data).catch((e) => console.error("release hold failed", e));
  }
  // Absolute public URL: behind the Netlify proxy the request origin is the Vercel host.
  return NextResponse.redirect(shopUrl("/cancelled"), 303);
}
