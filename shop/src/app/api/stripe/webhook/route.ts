import { NextResponse, type NextRequest } from "next/server";
import type Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { env } from "@/lib/env";
import { expireSession, fulfilSession } from "@/lib/booking";

// Register in Stripe: <SITE_URL>/shop/api/stripe/webhook with events
// checkout.session.completed, checkout.session.async_payment_succeeded and
// checkout.session.expired. Handlers are idempotent; a 500 makes Stripe retry.
export async function POST(req: NextRequest) {
  const signature = req.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "Missing signature" }, { status: 400 });

  let event: Stripe.Event;
  try {
    event = stripe().webhooks.constructEvent(await req.text(), signature, env.stripeWebhookSecret());
  } catch (e) {
    console.error("webhook signature failed", e);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded":
        await fulfilSession(event.data.object);
        break;
      case "checkout.session.expired":
        await expireSession(event.data.object);
        break;
    }
  } catch (e) {
    console.error(`webhook ${event.type} ${event.id} failed`, e);
    return NextResponse.json({ error: "Handler failed" }, { status: 500 });
  }
  return NextResponse.json({ received: true });
}
