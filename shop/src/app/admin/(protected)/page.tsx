import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { signedDownloadUrl } from "@/lib/uploads";
import { formatLongDate, slotLabel, todayLocal } from "@/lib/dates";
import { formatGBP } from "@/lib/pricing";
import type { Booking } from "@/lib/types";
import { CancelBookingButton } from "./CancelBookingButton";

const STATUS_STYLE: Record<string, string> = {
  paid: "text-cyan",
  held: "text-yellowk",
  cancelled: "text-magenta",
  expired: "text-zinc-600",
};

export default async function BookingsPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const view = (await searchParams).view === "past" ? "past" : "upcoming";
  const today = todayLocal();
  const db = supabaseAdmin();
  let q = db.from("bookings").select("*, products(title)").neq("status", "expired");
  q = view === "upcoming" ? q.gte("date", today).order("date").order("slot", { ascending: false }) : q.lt("date", today).order("date", { ascending: false });
  const { data, error } = await q.limit(200);
  if (error) throw error;
  const bookings = data as (Booking & { products: { title: string } | null })[];
  const links = await Promise.all(bookings.map((b) => (b.custom_upload_path ? signedDownloadUrl(b.custom_upload_path, 60 * 60) : null)));

  return (
    <>
      <div className="mb-6 flex items-center justify-between gap-4">
        <h1 className="text-3xl">Bookings</h1>
        <div className="flex gap-2">
          <Link href="/admin" className={`btn btn-small ${view === "upcoming" ? "btn-cyan" : "border-zinc-700"}`}>
            Upcoming
          </Link>
          <Link href="/admin?view=past" className={`btn btn-small ${view === "past" ? "btn-cyan" : "border-zinc-700"}`}>
            Past
          </Link>
        </div>
      </div>
      {bookings.length === 0 ? (
        <p className="text-zinc-400">No {view} bookings.</p>
      ) : (
        <ul className="space-y-3">
          {bookings.map((b, i) => (
            <li key={b.id} className="grid gap-4 border border-zinc-800 p-4 md:grid-cols-[1fr_1fr_auto]">
              <div>
                <p className={`font-mono text-xs uppercase tracking-widest ${STATUS_STYLE[b.status]}`}>
                  {b.status}
                  {b.refunded_at ? " · refunded" : ""}
                </p>
                <p className="mt-1 font-semibold">
                  {formatLongDate(b.date)} · {slotLabel(b.slot)}
                </p>
                <p className="text-sm text-zinc-400">
                  {b.products?.title ?? (b.custom_upload_path ? "Custom print" : "Deleted product")} · {b.category} · {b.size_label ? `${b.size_label}, ` : ""}
                  {Number(b.width_cm)} × {Number(b.height_cm)} cm · {formatGBP(b.amount_pence)}
                </p>
                {links[i] && (
                  <a href={links[i]!} className="mt-2 inline-block text-sm text-cyan underline">
                    Download customer file
                  </a>
                )}
              </div>
              <div className="text-sm">
                <p className="font-semibold">{b.customer_name}</p>
                <p>
                  <a href={`mailto:${b.customer_email}`} className="hover:text-cyan">
                    {b.customer_email}
                  </a>{" "}
                  ·{" "}
                  <a href={`tel:${b.customer_phone}`} className="hover:text-cyan">
                    {b.customer_phone}
                  </a>
                </p>
                <p className="whitespace-pre-line text-zinc-400">{b.install_address}</p>
                <p className="mt-1 font-mono text-xs text-zinc-600">Ref {b.id.slice(0, 8).toUpperCase()}</p>
              </div>
              <div>{(b.status === "paid" || b.status === "held") && <CancelBookingButton id={b.id} paid={b.status === "paid"} />}</div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
