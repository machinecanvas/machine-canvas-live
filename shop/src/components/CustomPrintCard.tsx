"use client";

import Link from "next/link";
import { useState } from "react";
import { BUSINESS, CUSTOM_UPLOAD } from "@/config";
import { formatGBP, formatM2, quote, validDimensions } from "@/lib/pricing";

/** Shop grid card for printing the customer's own image, with a live price. */
export function CustomPrintCard() {
  const [width, setWidth] = useState("200");
  const [height, setHeight] = useState("150");
  const w = Number(width);
  const h = Number(height);
  const price = validDimensions(w, h) ? quote(w, h) : null;
  const href = price ? `/custom?w=${w}&h=${h}` : "/custom";

  return (
    <div className="flex h-full flex-col border border-dashed border-cyan bg-zinc-950">
      <Link href={href} className="group block">
        <div className="relative flex aspect-[4/3] flex-col items-center justify-center gap-3 overflow-hidden bg-gradient-to-br from-zinc-900 via-zinc-950 to-black p-6 text-center">
          <svg viewBox="0 0 24 24" className="h-14 w-14 text-cyan transition duration-500 group-hover:-translate-y-1" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
            <path d="M12 16V4m0 0-4 4m4-4 4 4" />
            <path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
          </svg>
          <p className="font-serif text-2xl font-black">Your image, your size</p>
          <p className="font-mono text-xs text-zinc-400">JPG, PNG or PDF · any wall or floor</p>
        </div>
      </Link>
      <div className="flex flex-1 flex-col p-5">
        <p className="mono-label mb-2">Custom print</p>
        <h2 className="text-xl">Upload your own image</h2>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <label>
            <span className="mono-label label">Width (cm)</span>
            <input className="field" inputMode="numeric" type="number" min={CUSTOM_UPLOAD.MIN_CM} max={CUSTOM_UPLOAD.MAX_CM} value={width} onChange={(e) => setWidth(e.target.value)} />
          </label>
          <label>
            <span className="mono-label label">Height (cm)</span>
            <input className="field" inputMode="numeric" type="number" min={CUSTOM_UPLOAD.MIN_CM} max={CUSTOM_UPLOAD.MAX_CM} value={height} onChange={(e) => setHeight(e.target.value)} />
          </label>
        </div>
        <div className="mt-3" aria-live="polite">
          {price ? (
            <>
              <p className="font-semibold">
                {formatGBP(price.standard.pricePence)} <span className="text-xs font-normal text-zinc-500">inc. VAT · {formatM2(price.areaM2)}</span>
              </p>
              {price.newCustomer && <p className="text-sm text-cyan">First booking: {formatGBP(price.newCustomer.pricePence)}</p>}
            </>
          ) : (
            <p className="text-sm text-yellowk">
              Enter a size between {CUSTOM_UPLOAD.MIN_CM} and {CUSTOM_UPLOAD.MAX_CM} cm.
            </p>
          )}
        </div>
        <div className="mt-auto pt-5">
          <Link href={href} className="btn btn-cyan btn-small w-full justify-center">
            Upload your image →
          </Link>
          <p className="mt-3 text-center text-xs text-zinc-400">
            Can&apos;t upload it?{" "}
            <a href={`${BUSINESS.siteUrl}/contact`} className="text-cyan underline hover:text-white">
              Contact us
            </a>{" "}
            and we&apos;ll help.
          </p>
        </div>
      </div>
    </div>
  );
}
