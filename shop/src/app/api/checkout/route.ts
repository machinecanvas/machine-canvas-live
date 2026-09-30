import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { BookingError, startCheckout } from "@/lib/booking";
import { DATE_RE } from "@/lib/dates";
import { rateLimit } from "@/lib/rate-limit";

const Item = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("product"),
    productId: z.uuid(),
    size: z.union([
      z.object({ label: z.string().min(1).max(100) }),
      z.object({ widthCm: z.number().finite(), heightCm: z.number().finite() }),
    ]),
  }),
  z.object({
    kind: z.literal("custom"),
    uploadPath: z.string().max(200),
    category: z.enum(["wall", "floor"]),
    widthCm: z.number().finite(),
    heightCm: z.number().finite(),
    acceptLowRes: z.boolean(),
  }),
]);

const Body = z.object({
  item: Item,
  date: z.string().regex(DATE_RE),
  slot: z.enum(["morning", "evening"]),
  customer: z.object({
    name: z.string().trim().min(2).max(120),
    email: z.email().max(200),
    phone: z.string().trim().min(7).max(40),
    address: z.string().trim().min(10).max(500),
  }),
  acceptTerms: z.literal(true),
});

export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Please check your details and try again." }, { status: 400 });
  }
  if (!(await rateLimit("checkout", 10, 10 * 60))) {
    return NextResponse.json({ error: "Too many attempts. Please wait a few minutes." }, { status: 429 });
  }
  try {
    const url = await startCheckout(parsed.data);
    return NextResponse.json({ url });
  } catch (e) {
    if (e instanceof BookingError) return NextResponse.json({ error: e.message }, { status: 409 });
    console.error("checkout failed", e);
    return NextResponse.json({ error: "We couldn't start checkout. Please try again." }, { status: 500 });
  }
}
