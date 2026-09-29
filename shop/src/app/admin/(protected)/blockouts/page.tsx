import { supabaseAdmin } from "@/lib/supabase/admin";
import { formatLongDate, todayLocal } from "@/lib/dates";
import { SLOTS, type Slot } from "@/config";
import type { Blockout } from "@/lib/types";
import { addBlockout, deleteBlockout } from "../actions";

export default async function BlockoutsPage() {
  const { data, error } = await supabaseAdmin().from("blockouts").select("*").gte("date", todayLocal()).order("date");
  if (error) throw error;
  const blockouts = data as Blockout[];

  return (
    <>
      <h1 className="mb-2 text-3xl">Block-out dates</h1>
      <p className="mb-6 text-zinc-400">Holidays or days you can't work. Customers won't be able to book these. Existing bookings aren't affected.</p>
      <form action={addBlockout} className="mb-8 grid gap-3 border border-zinc-800 p-4 sm:grid-cols-[auto_auto_1fr_auto] sm:items-end">
        <label>
          <span className="mono-label label">Date</span>
          <input type="date" name="date" required min={todayLocal()} className="field" />
        </label>
        <label>
          <span className="mono-label label">Slot</span>
          <select name="slot" className="field">
            <option value="all">Whole day</option>
            {(Object.keys(SLOTS) as Slot[]).map((s) => (
              <option key={s} value={s}>
                {SLOTS[s].label} only
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="mono-label label">Reason (optional)</span>
          <input name="reason" maxLength={200} className="field" />
        </label>
        <button className="btn btn-cyan btn-small h-[46px]">Block</button>
      </form>
      {blockouts.length === 0 ? (
        <p className="text-zinc-400">No upcoming block-outs.</p>
      ) : (
        <ul className="divide-y divide-zinc-800 border border-zinc-800">
          {blockouts.map((b) => (
            <li key={b.id} className="flex items-center justify-between gap-4 p-3">
              <span>
                <strong>{formatLongDate(b.date)}</strong> · {b.slot ? SLOTS[b.slot].label : "Whole day"}
                {b.reason && <span className="text-zinc-400"> · {b.reason}</span>}
              </span>
              <form action={deleteBlockout.bind(null, b.id)}>
                <button className="font-mono text-xs text-magenta">Remove</button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
