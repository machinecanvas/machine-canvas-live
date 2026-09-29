import "server-only";
import type Stripe from "stripe";
import { BOOKING, NEW_CUSTOMER_DISCOUNT_PCT, type Category, type Slot } from "@/config";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { stripe } from "@/lib/stripe";
import { shopUrl } from "@/lib/env";
import { isSlotAvailable } from "@/lib/availability";
import { formatLongDate, isBookableDate, slotLabel, slotWindow } from "@/lib/dates";
import { areaM2, customPrice, formatGBP, newCustomerDiscount, validDimensions } from "@/lib/pricing";
import { inspectUpload, signedDownloadUrl, uploadDpi } from "@/lib/uploads";
import { createEvent, deleteEvent } from "@/lib/gcal";
import { sendBookingEmails, sendConflictEmails } from "@/lib/email";
import type { Booking, Product } from "@/lib/types";

/** An error whose message is safe to show to the customer. */
export class BookingError extends Error {}

export type CheckoutInput = {
  item:
    | { kind: "product"; productId: string; sizeLabel: string }
    | { kind: "custom"; uploadPath: string; category: Category; widthCm: number; heightCm: number; acceptLowRes: boolean };
  date: string;
  slot: Slot;
  customer: { name: string; email: string; phone: string; address: string };
};

type ResolvedItem = {
  productId: string | null;
  sizeLabel: string | null;
  uploadPath: string | null;
  category: Category;
  widthCm: number;
  heightCm: number;
  amountPence: number;
  title: string;
  imageUrl: string | null;
};

/** Work out what is being bought and its price, entirely from server-side data. */
async function resolveItem(input: CheckoutInput["item"]): Promise<ResolvedItem> {
  if (input.kind === "product") {
    const { data, error } = await supabaseAdmin().from("products").select("*").eq("id", input.productId).eq("active", true).maybeSingle();
    if (error) throw error;
    const product = data as Product | null;
    if (!product) throw new BookingError("This product is no longer available.");
    const size = product.size_options.find((s) => s.label === input.sizeLabel);
    if (!size) throw new BookingError("Please choose a size.");
    return {
      productId: product.id,
      sizeLabel: size.label,
      uploadPath: null,
      category: product.category,
      widthCm: size.width_cm,
      heightCm: size.height_cm,
      amountPence: size.price_pence,
      title: product.title,
      imageUrl: product.image_url,
    };
  }

  if (!validDimensions(input.widthCm, input.heightCm)) throw new BookingError("Please enter a valid width and height.");
  const upload = await inspectUpload(input.uploadPath).catch((e: Error) => {
    throw new BookingError(e.message);
  });
  const { verdict } = uploadDpi(upload, input.widthCm, input.heightCm);
  if (verdict === "block") throw new BookingError("Your image resolution is too low for this size. Please upload a larger image or choose a smaller size.");
  if (verdict === "warn" && !input.acceptLowRes) throw new BookingError("Please confirm you're happy with the lower print resolution.");
  return {
    productId: null,
    sizeLabel: null,
    uploadPath: input.uploadPath,
    category: input.category,
    widthCm: input.widthCm,
    heightCm: input.heightCm,
    amountPence: customPrice(input.category, input.widthCm, input.heightCm).pricePence,
    title: "Custom print",
    imageUrl: null,
  };
}

/**
 * Release holds whose 10-minute window has passed. Their Stripe sessions are
 * expired first so a lapsed hold can never be paid for; a session that has
 * already completed is left for the webhook to mark paid.
 */
export async function expireStaleHolds(filter?: { date: string; slot: Slot }): Promise<number> {
  const db = supabaseAdmin();
  let query = db.from("bookings").select("id, stripe_session_id").eq("status", "held").lt("hold_expires_at", new Date().toISOString());
  if (filter) query = query.eq("date", filter.date).eq("slot", filter.slot);
  const { data, error } = await query.limit(100);
  if (error) throw error;

  let expired = 0;
  for (const hold of data) {
    if (hold.stripe_session_id) {
      try {
        await stripe().checkout.sessions.expire(hold.stripe_session_id);
      } catch {
        const session = await stripe().checkout.sessions.retrieve(hold.stripe_session_id);
        if (session.status === "complete") continue; // paid: webhook will (or did) confirm it
      }
    }
    const { error: updErr } = await db.from("bookings").update({ status: "expired" }).eq("id", hold.id).eq("status", "held");
    if (updErr) throw updErr;
    expired++;
  }
  return expired;
}

/** Validate, hold the slot for 10 minutes and create a Stripe Checkout session. Returns its URL. */
export async function startCheckout(input: CheckoutInput): Promise<string> {
  const item = await resolveItem(input.item);

  if (areaM2(item.widthCm, item.heightCm) > BOOKING.MAX_AREA_M2_PER_SLOT) {
    throw new BookingError(`Jobs over ${BOOKING.MAX_AREA_M2_PER_SLOT} m² need a site survey. Please contact us for a quote.`);
  }
  if (!isBookableDate(input.date)) throw new BookingError("That date can't be booked. Please choose another.");

  await expireStaleHolds({ date: input.date, slot: input.slot });
  if (!(await isSlotAvailable(input.date, input.slot))) {
    throw new BookingError("Sorry, that slot has just been taken. Please choose another.");
  }

  const db = supabaseAdmin();

  // First booking for this email/phone gets the new-customer discount.
  let discountPence = 0;
  if (NEW_CUSTOMER_DISCOUNT_PCT > 0) {
    const { data: returning, error: rcErr } = await db.rpc("is_returning_customer", {
      p_email: input.customer.email,
      p_phone: input.customer.phone,
    });
    if (rcErr) throw rcErr;
    if (returning !== true) discountPence = newCustomerDiscount(item.amountPence);
  }
  const chargePence = item.amountPence - discountPence;

  const { data: bookingId, error } = await db.rpc("create_hold", {
    p_product_id: item.productId,
    p_size_label: item.sizeLabel,
    p_custom_upload_path: item.uploadPath,
    p_width_cm: item.widthCm,
    p_height_cm: item.heightCm,
    p_category: item.category,
    p_date: input.date,
    p_slot: input.slot,
    p_customer_name: input.customer.name,
    p_customer_email: input.customer.email,
    p_customer_phone: input.customer.phone,
    p_install_address: input.customer.address,
    p_amount_pence: chargePence,
    p_discount_pence: discountPence,
    p_hold_minutes: BOOKING.HOLD_MINUTES,
  });
  if (error) {
    if (error.message.includes("slot_taken")) throw new BookingError("Sorry, that slot has just been taken. Please choose another.");
    if (error.message.includes("blocked")) throw new BookingError("That date isn't available. Please choose another.");
    throw error;
  }

  const size = `${item.widthCm} × ${item.heightCm} cm`;
  const when = `${formatLongDate(input.date)}, ${slotLabel(input.slot)}`;
  try {
    const session = await stripe().checkout.sessions.create(
      {
        mode: "payment",
        currency: "gbp",
        customer_email: input.customer.email,
        client_reference_id: bookingId,
        metadata: { booking_id: bookingId },
        payment_intent_data: { metadata: { booking_id: bookingId } },
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: "gbp",
              unit_amount: chargePence,
              tax_behavior: "inclusive",
              product_data: {
                name: `${item.title}: ${item.category} print, supplied and installed`,
                description: [
                  `${item.sizeLabel ? `${item.sizeLabel}, ` : ""}${size}. Installation ${when}.`,
                  discountPence ? `${NEW_CUSTOMER_DISCOUNT_PCT}% new customer discount applied (normally ${formatGBP(item.amountPence)}).` : "",
                  "Price includes 20% VAT.",
                ]
                  .filter(Boolean)
                  .join(" "),
                ...(item.imageUrl ? { images: [item.imageUrl] } : {}),
              },
            },
          },
        ],
        // Stripe's minimum is 30 minutes; our own 10-minute hold is enforced
        // by expireStaleHolds, which expires this session early.
        expires_at: Math.floor(Date.now() / 1000) + 30 * 60 + 60,
        success_url: `${shopUrl("/success")}?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${shopUrl("/api/checkout/cancel")}?booking=${bookingId}`,
      },
      { idempotencyKey: `checkout-${bookingId}` },
    );
    const { error: updErr } = await db.from("bookings").update({ stripe_session_id: session.id }).eq("id", bookingId);
    if (updErr) throw updErr;
    if (!session.url) throw new Error("Stripe returned no checkout URL");
    return session.url;
  } catch (e) {
    await db.from("bookings").update({ status: "expired" }).eq("id", bookingId).eq("status", "held");
    throw e;
  }
}

/** Customer backed out of Stripe Checkout: free the slot straight away. */
export async function releaseHold(bookingId: string): Promise<void> {
  const db = supabaseAdmin();
  const { data } = await db.from("bookings").select("id, status, stripe_session_id").eq("id", bookingId).maybeSingle();
  if (!data || data.status !== "held") return;
  if (data.stripe_session_id) {
    try {
      await stripe().checkout.sessions.expire(data.stripe_session_id);
    } catch {
      const session = await stripe().checkout.sessions.retrieve(data.stripe_session_id);
      if (session.status === "complete") return;
    }
  }
  await db.from("bookings").update({ status: "expired" }).eq("id", bookingId).eq("status", "held");
}

async function loadBooking(id: string): Promise<Booking> {
  const { data, error } = await supabaseAdmin().from("bookings").select("*").eq("id", id).single();
  if (error) throw error;
  return data as Booking;
}

async function itemTitle(booking: Booking): Promise<string> {
  if (!booking.product_id) return booking.custom_upload_path ? "Custom print" : "Print";
  const { data } = await supabaseAdmin().from("products").select("title").eq("id", booking.product_id).maybeSingle();
  return data?.title ?? "Print";
}

/**
 * Confirm a paid Checkout session (Stripe webhook). Safe to call repeatedly:
 * each side effect records that it has happened and is skipped on retries.
 */
export async function fulfilSession(session: Stripe.Checkout.Session): Promise<void> {
  const bookingId = session.metadata?.booking_id;
  if (!bookingId) return; // not a shop session
  if (session.payment_status !== "paid") return; // async payment: wait for async_payment_succeeded

  const paymentIntent = typeof session.payment_intent === "string" ? session.payment_intent : (session.payment_intent?.id ?? null);
  const db = supabaseAdmin();
  const { data: result, error } = await db.rpc("mark_booking_paid", {
    p_booking_id: bookingId,
    p_session_id: session.id,
    p_payment_intent_id: paymentIntent,
  });
  if (error) throw error;

  if (result === "not_found") {
    console.error(`Stripe session ${session.id} has no matching booking ${bookingId}`);
    return;
  }

  let booking = await loadBooking(bookingId);

  if (result === "conflict") {
    if (!booking.refunded_at && paymentIntent) {
      await stripe().refunds.create({ payment_intent: paymentIntent }, { idempotencyKey: `conflict-refund-${bookingId}` });
      await db.from("bookings").update({ refunded_at: new Date().toISOString(), status: "cancelled" }).eq("id", bookingId);
      await sendConflictEmails(booking);
    }
    return;
  }

  const title = await itemTitle(booking);
  const downloadLink = booking.custom_upload_path ? await signedDownloadUrl(booking.custom_upload_path) : null;

  if (!booking.calendar_event_id) {
    const { start, end } = slotWindow(booking.date, booking.slot);
    const lines = [
      `${title}: ${booking.category} print, ${booking.size_label ? `${booking.size_label}, ` : ""}${Number(booking.width_cm)} × ${Number(booking.height_cm)} cm`,
      `Customer: ${booking.customer_name}, ${booking.customer_phone}, ${booking.customer_email}`,
      `Paid: £${(booking.amount_pence / 100).toFixed(2)} inc. VAT${booking.discount_pence ? ` (new customer discount £${(booking.discount_pence / 100).toFixed(2)})` : ""}`,
      downloadLink ? `Artwork (link valid 7 days, fresh link in admin): ${downloadLink}` : "",
      `Booking ID: ${booking.id}`,
    ].filter(Boolean);
    const eventId = await createEvent({
      bookingId: booking.id,
      summary: `Install: ${title} (${booking.category}) – ${booking.customer_name}`,
      description: lines.join("\n"),
      location: booking.install_address,
      start,
      end,
    });
    if (eventId) {
      await db.from("bookings").update({ calendar_event_id: eventId }).eq("id", bookingId);
      booking = { ...booking, calendar_event_id: eventId };
    }
  }

  if (!booking.emails_sent_at) {
    await sendBookingEmails({ booking, itemTitle: title, customUploadLink: downloadLink });
    await db.from("bookings").update({ emails_sent_at: new Date().toISOString() }).eq("id", bookingId);
  }
}

/** Stripe told us a Checkout session expired: free its slot if still held. */
export async function expireSession(session: Stripe.Checkout.Session): Promise<void> {
  const bookingId = session.metadata?.booking_id;
  if (!bookingId) return;
  await supabaseAdmin().from("bookings").update({ status: "expired" }).eq("id", bookingId).eq("stripe_session_id", session.id).eq("status", "held");
}

/** Admin cancel: refund if paid, free the slot, remove the calendar event. */
export async function cancelBooking(bookingId: string): Promise<void> {
  const booking = await loadBooking(bookingId);
  if (booking.status === "cancelled" || booking.status === "expired") return;

  if (booking.status === "held") {
    await releaseHold(bookingId);
    return;
  }

  if (booking.stripe_payment_intent_id && !booking.refunded_at) {
    await stripe().refunds.create({ payment_intent: booking.stripe_payment_intent_id }, { idempotencyKey: `cancel-refund-${bookingId}` });
  }
  if (booking.calendar_event_id) await deleteEvent(booking.calendar_event_id);

  const { error } = await supabaseAdmin()
    .from("bookings")
    .update({ status: "cancelled", refunded_at: booking.refunded_at ?? new Date().toISOString(), calendar_event_id: null })
    .eq("id", bookingId);
  if (error) throw error;
}
