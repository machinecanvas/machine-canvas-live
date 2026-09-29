"use client";

import { useState } from "react";
import { BOOKING, BUSINESS, NEW_CUSTOMER_DISCOUNT_PCT } from "@/config";
import { api } from "@/lib/paths";
import { formatGBP, newCustomerDiscount } from "@/lib/pricing";
import { BookingCalendar, type SlotChoice } from "@/components/BookingCalendar";

export type CheckoutItem =
  | { kind: "product"; productId: string; sizeLabel: string }
  | { kind: "custom"; uploadPath: string; category: "wall" | "floor"; widthCm: number; heightCm: number; acceptLowRes: boolean };

/**
 * Calendar + customer details + "Continue to payment". The price shown here
 * is for display only; the server recalculates it before creating the Stripe
 * session.
 */
export function CheckoutForm({
  item,
  pricePence,
  blockedReason,
  firstMonth,
  lastMonth,
}: {
  item: CheckoutItem | null;
  pricePence: number | null;
  blockedReason: string | null;
  firstMonth: string;
  lastMonth: string;
}) {
  const [choice, setChoice] = useState<SlotChoice>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!item || !choice) return;
    const form = new FormData(e.currentTarget);
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(api("/checkout"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          item,
          date: choice.date,
          slot: choice.slot,
          customer: {
            name: form.get("name"),
            email: form.get("email"),
            phone: form.get("phone"),
            address: form.get("address"),
          },
          acceptTerms: form.get("terms") === "on",
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!res.ok || !data.url) throw new Error(data.error ?? "Something went wrong. Please try again.");
      window.location.assign(data.url);
    } catch (err) {
      setError((err as Error).message);
      setChoice(null);
      setRefreshKey((k) => k + 1);
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-8">
      <section>
        <h2 className="mb-1 text-xl">1. Pick your installation date</h2>
        <p className="mb-4 text-sm text-zinc-400">
          Two slots a day. Dates need at least {BOOKING.NOTICE_DAYS} days' notice. Your slot is held for {BOOKING.HOLD_MINUTES} minutes while you pay.
        </p>
        <BookingCalendar firstMonth={firstMonth} lastMonth={lastMonth} value={choice} onChange={setChoice} refreshKey={refreshKey} />
      </section>

      <section>
        <h2 className="mb-4 text-xl">2. Your details</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <label>
            <span className="mono-label label">Full name</span>
            <input name="name" required maxLength={120} autoComplete="name" className="field" />
          </label>
          <label>
            <span className="mono-label label">Phone</span>
            <input name="phone" required type="tel" maxLength={40} autoComplete="tel" className="field" />
          </label>
          <label className="sm:col-span-2">
            <span className="mono-label label">Email</span>
            <input name="email" required type="email" maxLength={200} autoComplete="email" className="field" />
          </label>
          <label className="sm:col-span-2">
            <span className="mono-label label">Installation address (incl. postcode)</span>
            <textarea name="address" required rows={3} maxLength={500} autoComplete="street-address" className="field" />
          </label>
        </div>
        <label className="mt-4 flex items-start gap-3 text-sm text-zinc-400">
          <input name="terms" type="checkbox" required className="mt-1 accent-cyan" />
          <span>
            I agree to the{" "}
            <a href={`${BUSINESS.siteUrl}/terms`} target="_blank" className="underline hover:text-cyan">
              terms &amp; conditions
            </a>{" "}
            and{" "}
            <a href={`${BUSINESS.siteUrl}/refunds`} target="_blank" className="underline hover:text-cyan">
              refund &amp; cancellation policy
            </a>
            .
          </span>
        </label>
      </section>

      <section className="border-t border-zinc-800 pt-6">
        {blockedReason ? (
          <p className="text-yellowk">{blockedReason}</p>
        ) : (
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="mono-label">Total</p>
              <p className="font-display text-3xl font-extrabold">
                {pricePence ? formatGBP(pricePence) : "—"} <span className="text-sm font-normal text-zinc-400">inc. VAT</span>
              </p>
              {pricePence && NEW_CUSTOMER_DISCOUNT_PCT > 0 ? (
                <p className="mt-1 text-sm text-cyan">
                  First booking with us? You pay {formatGBP(pricePence - newCustomerDiscount(pricePence))} ({NEW_CUSTOMER_DISCOUNT_PCT}% off, applied
                  automatically at checkout).
                </p>
              ) : null}
            </div>
            <button type="submit" className="btn btn-cyan" disabled={!item || !choice || submitting}>
              {submitting ? "Reserving your slot…" : choice ? "Continue to payment" : "Choose a date first"}
            </button>
          </div>
        )}
        {error && (
          <p role="alert" className="mt-4 text-magenta">
            {error}
          </p>
        )}
      </section>
    </form>
  );
}
