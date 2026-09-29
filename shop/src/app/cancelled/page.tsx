import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Checkout cancelled", robots: { index: false } };

export default function CancelledPage() {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <p className="mono-label mb-3">No payment taken</p>
      <h1 className="font-serif text-4xl font-black sm:text-5xl">Checkout cancelled</h1>
      <p className="mt-6 text-zinc-400">Your slot has been released. You can pick a date again whenever you're ready.</p>
      <Link href="/" className="btn btn-cyan mt-8">
        Back to the shop
      </Link>
    </div>
  );
}
