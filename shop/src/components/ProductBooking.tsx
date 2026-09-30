"use client";

import { useState } from "react";
import { BOOKING, BUSINESS, CUSTOM_UPLOAD } from "@/config";
import { formatGBP, formatM2, quote, validDimensions } from "@/lib/pricing";
import type { Product } from "@/lib/types";
import { CheckoutForm } from "@/components/CheckoutForm";

const CUSTOM = "__custom__";

export function ProductBooking({ product, firstMonth, lastMonth }: { product: Product; firstMonth: string; lastMonth: string }) {
  const base = product.size_options[0];
  const [sizeLabel, setSizeLabel] = useState(base?.label ?? CUSTOM);
  const [width, setWidth] = useState(String(base?.width_cm ?? 100));
  const [height, setHeight] = useState(String(base?.height_cm ?? 100));
  const [keepRatio, setKeepRatio] = useState(true);
  const ratio = base ? base.height_cm / base.width_cm : 1; // height per cm of width

  const isCustom = sizeLabel === CUSTOM;
  const preset = isCustom ? null : (product.size_options.find((s) => s.label === sizeLabel) ?? null);
  const w = preset ? preset.width_cm : Number(width);
  const h = preset ? preset.height_cm : Number(height);
  const dimsOk = validDimensions(w, h);
  const price = dimsOk ? quote(w, h) : null;

  function onWidth(v: string) {
    setWidth(v);
    const n = Number(v);
    if (keepRatio && Number.isFinite(n) && n > 0) setHeight(String(Math.round(n * ratio)));
  }
  function onHeight(v: string) {
    setHeight(v);
    const n = Number(v);
    if (keepRatio && Number.isFinite(n) && n > 0) setWidth(String(Math.round(n / ratio)));
  }

  let blockedReason: string | null = null;
  if (!dimsOk) blockedReason = `Enter a width and height between ${CUSTOM_UPLOAD.MIN_CM} and ${CUSTOM_UPLOAD.MAX_CM} cm.`;
  else if (price?.overMaxArea)
    blockedReason = `Prints over ${BOOKING.MAX_AREA_M2_PER_SLOT} m² need a site visit. Please contact us at ${BUSINESS.contactEmail} for a quote.`;

  const options = [
    ...product.size_options.map((s) => ({ key: s.label, label: s.label, w: s.width_cm, h: s.height_cm })),
    { key: CUSTOM, label: "Custom size", w: 0, h: 0 },
  ];

  return (
    <div className="space-y-8">
      <fieldset>
        <legend className="mb-3 text-xl">Choose a size</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {options.map((o) => {
            const q = o.key === CUSTOM ? null : quote(o.w, o.h);
            return (
              <label
                key={o.key}
                className={`cursor-pointer border p-4 transition ${o.key === sizeLabel ? "border-cyan" : "border-zinc-700 hover:border-zinc-500"}`}
              >
                <input type="radio" name="size" value={o.key} checked={o.key === sizeLabel} onChange={() => setSizeLabel(o.key)} className="sr-only" />
                <span className="block font-semibold">{o.label}</span>
                <span className="font-mono text-xs text-zinc-400">
                  {q ? `${o.w} × ${o.h} cm · ${formatGBP(q.standard.pricePence)}` : "Bigger or smaller: enter your own size"}
                </span>
              </label>
            );
          })}
        </div>

        {isCustom && (
          <div className="mt-4 space-y-3 border border-zinc-800 p-4">
            <div className="grid grid-cols-2 gap-4">
              <label>
                <span className="mono-label label">Width (cm)</span>
                <input
                  className="field"
                  inputMode="numeric"
                  type="number"
                  min={CUSTOM_UPLOAD.MIN_CM}
                  max={CUSTOM_UPLOAD.MAX_CM}
                  value={width}
                  onChange={(e) => onWidth(e.target.value)}
                />
              </label>
              <label>
                <span className="mono-label label">Height (cm)</span>
                <input
                  className="field"
                  inputMode="numeric"
                  type="number"
                  min={CUSTOM_UPLOAD.MIN_CM}
                  max={CUSTOM_UPLOAD.MAX_CM}
                  value={height}
                  onChange={(e) => onHeight(e.target.value)}
                />
              </label>
            </div>
            <label className="flex items-start gap-2 text-sm text-zinc-400">
              <input type="checkbox" checked={keepRatio} onChange={(e) => setKeepRatio(e.target.checked)} className="mt-1 accent-cyan" />
              <span>Keep the design's proportions (recommended, so it isn't stretched)</span>
            </label>
          </div>
        )}
        {price && (
          <p className="mt-3 font-mono text-xs text-zinc-500">
            {w} × {h} cm · area {formatM2(price.areaM2)} · max {BOOKING.MAX_AREA_M2_PER_SLOT} m² per booking
          </p>
        )}
      </fieldset>

      <CheckoutForm
        item={dimsOk ? { kind: "product", productId: product.id, size: preset ? { label: preset.label } : { widthCm: w, heightCm: h } } : null}
        price={price}
        blockedReason={blockedReason}
        firstMonth={firstMonth}
        lastMonth={lastMonth}
      />
    </div>
  );
}
