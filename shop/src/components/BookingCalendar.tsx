"use client";

import { useEffect, useState } from "react";
import { SLOTS, type Slot } from "@/config";
import { api } from "@/lib/paths";
import type { DayAvailability } from "@/lib/types";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function monthLabel(month: string) {
  return new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${month}-01T12:00:00Z`));
}

function shiftMonth(month: string, delta: number) {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return d.toISOString().slice(0, 7);
}

export type SlotChoice = { date: string; slot: Slot } | null;

export function BookingCalendar({
  firstMonth,
  lastMonth,
  value,
  onChange,
  refreshKey = 0,
}: {
  firstMonth: string;
  lastMonth: string;
  value: SlotChoice;
  onChange: (v: SlotChoice) => void;
  refreshKey?: number;
}) {
  const [month, setMonth] = useState(firstMonth);
  const [days, setDays] = useState<DayAvailability[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(value?.date ?? null);

  useEffect(() => {
    let cancelled = false;
    setDays(null);
    setError(null);
    fetch(api(`/availability?month=${month}`))
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json().catch(() => null))?.error ?? "Could not load availability");
        return r.json() as Promise<{ days: DayAvailability[] }>;
      })
      .then((d) => !cancelled && setDays(d.days))
      .catch((e: Error) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [month, refreshKey]);

  const leadingBlanks = (new Date(`${month}-01T12:00:00Z`).getUTCDay() + 6) % 7; // Monday first
  const selectedDay = days?.find((d) => d.date === selectedDate) ?? null;

  return (
    <div className="border border-zinc-800 bg-zinc-950 p-4 sm:p-6">
      <div className="mb-4 flex items-center justify-between">
        <button
          type="button"
          className="btn btn-small"
          onClick={() => setMonth(shiftMonth(month, -1))}
          disabled={month <= firstMonth}
          aria-label="Previous month"
        >
          ←
        </button>
        <p className="font-mono text-sm uppercase tracking-widest">{monthLabel(month)}</p>
        <button
          type="button"
          className="btn btn-small"
          onClick={() => setMonth(shiftMonth(month, 1))}
          disabled={month >= lastMonth}
          aria-label="Next month"
        >
          →
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center">
        {WEEKDAYS.map((d) => (
          <div key={d} className="mono-label py-1 !tracking-normal">
            {d}
          </div>
        ))}
        {Array.from({ length: leadingBlanks }, (_, i) => (
          <div key={`b${i}`} />
        ))}
        {days === null && !error
          ? Array.from({ length: 30 }, (_, i) => <div key={`s${i}`} className="aspect-square animate-pulse bg-zinc-900" />)
          : days?.map((d) => {
              const free = Object.values(d.slots).filter((s) => s === "available").length;
              const active = selectedDate === d.date;
              return (
                <button
                  key={d.date}
                  type="button"
                  disabled={free === 0}
                  onClick={() => {
                    setSelectedDate(d.date);
                    onChange(null);
                  }}
                  className={`relative aspect-square border text-sm transition ${
                    active
                      ? "border-cyan bg-cyan text-ink"
                      : free === 0
                        ? "cursor-not-allowed border-transparent text-zinc-700 line-through"
                        : "border-zinc-700 hover:border-cyan"
                  }`}
                  aria-label={`${d.date}, ${free} slot${free === 1 ? "" : "s"} available`}
                >
                  {Number(d.date.slice(8))}
                  {free > 0 && !active && (
                    <span className="absolute bottom-1 left-1/2 flex -translate-x-1/2 gap-0.5">
                      {Array.from({ length: free }, (_, i) => (
                        <span key={i} className="h-1 w-1 rounded-full bg-cyan" />
                      ))}
                    </span>
                  )}
                </button>
              );
            })}
      </div>

      {error && <p className="mt-4 text-sm text-magenta">{error}</p>}

      {selectedDay && (
        <div className="mt-6">
          <p className="mono-label mb-3">Choose a time slot</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {(Object.keys(SLOTS) as Slot[]).map((slot) => {
              const available = selectedDay.slots[slot] === "available";
              const chosen = value?.date === selectedDay.date && value.slot === slot;
              return (
                <button
                  key={slot}
                  type="button"
                  disabled={!available}
                  onClick={() => onChange({ date: selectedDay.date, slot })}
                  className={`border p-4 text-left transition ${
                    chosen ? "border-cyan bg-cyan text-ink" : available ? "border-zinc-700 hover:border-cyan" : "border-zinc-900 text-zinc-700"
                  }`}
                >
                  <span className="block font-semibold">{SLOTS[slot].label}</span>
                  <span className="font-mono text-xs">
                    {SLOTS[slot].start}–{SLOTS[slot].end} {available ? "" : "· booked"}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
