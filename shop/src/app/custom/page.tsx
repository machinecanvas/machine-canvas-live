import type { Metadata } from "next";
import Link from "next/link";
import { calendarMonths } from "@/lib/booking-window";
import { CustomPrint } from "@/components/CustomPrint";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Print your own image" };

export default function CustomPage() {
  return (
    <>
      <Link href="/" className="mono-label hover:text-cyan">
        ← All prints
      </Link>
      <p className="mono-label mb-3 mt-6">Custom print</p>
      <h1 className="font-serif text-4xl font-black sm:text-5xl">Print your own image</h1>
      <p className="mt-4 max-w-2xl text-zinc-400">
        Upload your artwork or photo, tell us the size of the area, and get an instant price including installation and VAT.
      </p>
      <div className="mt-10">
        <CustomPrint {...calendarMonths()} />
      </div>
    </>
  );
}
