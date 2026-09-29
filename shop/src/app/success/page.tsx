import type { Metadata } from "next";
import Link from "next/link";
import { stripe } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { formatLongDate, slotLabel } from "@/lib/dates";
import { formatGBP } from "@/lib/pricing";
import type { Booking } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Booking confirmed", robots: { index: false } };

export default async function SuccessPage({ searchParams }: { searchParams: Promise<{ session_id?: string }> }) {
  const { session_id } = await searchParams;
  let booking: Booking | null = null;
  if (session_id?.startsWith("cs_")) {
    const session = await stripe().checkout.sessions.retrieve(session_id).catch(() => null);
    const id = session?.metadata?.booking_id;
    if (session && id) {
      const { data } = await supabaseAdmin().from("bookings").select("*").eq("id", id).eq("stripe_session_id", session.id).maybeSingle();
      booking = data as Booking | null;
    }
  }

  return (
    <div className="mx-auto max-w-2xl text-center">
      <p className="mono-label mb-3">Payment received</p>
      <h1 className="font-serif text-4xl font-black sm:text-5xl">You're booked in</h1>
      {booking ? (
        <div className="mt-8 border border-zinc-800 p-6 text-left">
          <dl className="grid gap-3 sm:grid-cols-[10rem_1fr]">
            <dt className="mono-label">Reference</dt>
            <dd className="font-mono">{booking.id.slice(0, 8).toUpperCase()}</dd>
            <dt className="mono-label">Install date</dt>
            <dd>
              {formatLongDate(booking.date)}, {slotLabel(booking.slot)}
            </dd>
            <dt className="mono-label">Address</dt>
            <dd className="whitespace-pre-line">{booking.install_address}</dd>
            <dt className="mono-label">Paid</dt>
            <dd>{formatGBP(booking.amount_pence)} inc. VAT</dd>
          </dl>
        </div>
      ) : null}
      <p className="mt-8 text-zinc-400">
        A confirmation email with a calendar invite is on its way to you. If it hasn't arrived in a few minutes, check your spam folder or get in touch.
      </p>
      <Link href="/" className="btn mt-8">
        Back to the shop
      </Link>
    </div>
  );
}
