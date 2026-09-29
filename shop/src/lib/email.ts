import "server-only";
import { Resend } from "resend";
import { BUSINESS } from "@/config";
import { env } from "@/lib/env";
import { formatGBP } from "@/lib/pricing";
import { formatLongDate, slotLabel, slotWindow } from "@/lib/dates";
import { buildIcs } from "@/lib/ics";
import type { Booking } from "@/lib/types";

let client: Resend | null = null;
function resend(): Resend {
  client ??= new Resend(env.resendApiKey());
  return client;
}

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function layout(title: string, rows: [string, string][], intro: string, outro = ""): string {
  const body = rows
    .map(
      ([k, v]) =>
        `<tr><td style="padding:8px 12px 8px 0;color:#71717a;font:12px monospace;text-transform:uppercase;letter-spacing:.1em;vertical-align:top">${esc(k)}</td><td style="padding:8px 0;color:#050505">${v}</td></tr>`,
    )
    .join("");
  return `<!doctype html><html><body style="margin:0;background:#FAFAF7;font-family:Helvetica,Arial,sans-serif">
<div style="max-width:560px;margin:0 auto;padding:24px">
<div style="height:4px;background:linear-gradient(90deg,#00E5FF,#FF2BD6,#FFE600,#050505)"></div>
<h1 style="font-size:22px;color:#050505;margin:24px 0 8px">${esc(title)}</h1>
<p style="color:#3a3a3a;line-height:1.5">${intro}</p>
<table style="width:100%;border-collapse:collapse;margin:16px 0">${body}</table>
${outro}
<p style="color:#71717a;font-size:12px;margin-top:32px">${esc(BUSINESS.name)} · <a href="${BUSINESS.siteUrl}" style="color:#71717a">${BUSINESS.siteUrl.replace("https://", "")}</a> · ${esc(BUSINESS.phone)}</p>
</div></body></html>`;
}

export type BookingEmailContext = {
  booking: Booking;
  itemTitle: string;
  customUploadLink: string | null; // signed URL, owner email only
};

function describeItem({ booking, itemTitle }: BookingEmailContext): string {
  const size = `${Number(booking.width_cm)} × ${Number(booking.height_cm)} cm`;
  return `${itemTitle} (${booking.category} print, ${booking.size_label ? `${booking.size_label}, ` : ""}${size})`;
}

export async function sendBookingEmails(ctx: BookingEmailContext): Promise<void> {
  const { booking } = ctx;
  const { start, end } = slotWindow(booking.date, booking.slot);
  const when = `${formatLongDate(booking.date)}, ${slotLabel(booking.slot)}`;
  const item = describeItem(ctx);
  const ics = buildIcs({
    uid: `${booking.id}@machinecanvas`,
    start,
    end,
    summary: `${BUSINESS.name}: ${booking.category} print installation`,
    description: `${item}\nBooking ref: ${booking.id.slice(0, 8).toUpperCase()}`,
    location: booking.install_address,
    organizerEmail: BUSINESS.contactEmail,
  });
  const ref = booking.id.slice(0, 8).toUpperCase();
  const attachments = [{ filename: "machine-canvas-booking.ics", content: Buffer.from(ics), contentType: "text/calendar" }];

  const customerRows: [string, string][] = [
    ["Booking ref", ref],
    ["Print", esc(item)],
    ["Date", esc(when)],
    ["Address", esc(booking.install_address).replace(/\n/g, "<br>")],
    ["Paid", `${formatGBP(booking.amount_pence)} inc. VAT`],
  ];

  const ownerRows: [string, string][] = [
    ...customerRows,
    ["Customer", esc(booking.customer_name)],
    ["Email", `<a href="mailto:${esc(booking.customer_email)}">${esc(booking.customer_email)}</a>`],
    ["Phone", esc(booking.customer_phone)],
  ];
  if (ctx.customUploadLink) {
    ownerRows.push(["Artwork", `<a href="${esc(ctx.customUploadLink)}">Download customer file</a> (link expires in 7 days; a fresh link is always available in the admin)`]);
  }

  await Promise.all([
    resend().emails.send(
      {
        from: env.emailFrom(),
        to: booking.customer_email,
        replyTo: BUSINESS.contactEmail,
        subject: `Booking confirmed: ${when}`,
        html: layout(
          "Your print is booked",
          customerRows,
          `Thanks ${esc(booking.customer_name.split(" ")[0])}, your payment has gone through and your installation slot is reserved. We'll be in touch before the day to confirm access and surface preparation.`,
          `<p style="color:#3a3a3a">Questions? Just reply to this email or call ${esc(BUSINESS.phone)}.</p>`,
        ),
        attachments,
      },
      { idempotencyKey: `booking-customer-${booking.id}` },
    ),
    resend().emails.send(
      {
        from: env.emailFrom(),
        to: env.ownerEmail(),
        replyTo: booking.customer_email,
        subject: `New booking: ${when} (${formatGBP(booking.amount_pence)})`,
        html: layout("New shop booking", ownerRows, "A new booking has been paid. It has been added to your Google Calendar."),
        attachments,
      },
      { idempotencyKey: `booking-owner-${booking.id}` },
    ),
  ]).then((results) => {
    for (const r of results) if (r.error) throw new Error(`Resend: ${r.error.message}`);
  });
}

/** Sent when a payment lands after the hold lapsed and the slot was taken. */
export async function sendConflictEmails(booking: Booking): Promise<void> {
  const when = `${formatLongDate(booking.date)}, ${slotLabel(booking.slot)}`;
  const rows: [string, string][] = [
    ["Booking ref", booking.id.slice(0, 8).toUpperCase()],
    ["Requested", esc(when)],
    ["Refunded", `${formatGBP(booking.amount_pence)}`],
  ];
  const results = await Promise.all([
    resend().emails.send(
      {
        from: env.emailFrom(),
        to: booking.customer_email,
        replyTo: BUSINESS.contactEmail,
        subject: "Your booking slot was no longer available",
        html: layout(
          "Sorry, that slot was taken",
          rows,
          "Your payment completed after your 10-minute slot hold expired, and another customer booked the slot in the meantime. We've refunded you in full. Please book another date, or reply and we'll help you find one.",
        ),
      },
      { idempotencyKey: `conflict-customer-${booking.id}` },
    ),
    resend().emails.send(
      {
        from: env.emailFrom(),
        to: env.ownerEmail(),
        replyTo: booking.customer_email,
        subject: `Refunded late payment for ${when}`,
        html: layout("Late payment refunded", [...rows, ["Customer", esc(`${booking.customer_name} <${booking.customer_email}>`)]], "A payment arrived after its slot hold expired and the slot had been rebooked, so it was refunded automatically."),
      },
      { idempotencyKey: `conflict-owner-${booking.id}` },
    ),
  ]);
  for (const r of results) if (r.error) throw new Error(`Resend: ${r.error.message}`);
}
