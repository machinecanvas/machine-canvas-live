"use client";

import { useState } from "react";
import { BOOKING } from "@/config";
import { areaM2, formatGBP } from "@/lib/pricing";
import type { Product } from "@/lib/types";
import { CheckoutForm } from "@/components/CheckoutForm";

export function ProductBooking({ product, firstMonth, lastMonth }: { product: Product; firstMonth: string; lastMonth: string }) {
  const [sizeLabel, setSizeLabel] = useState(product.size_options[0]?.label ?? "");
  const size = product.size_options.find((s) => s.label === sizeLabel) ?? null;
  const tooBig = size ? areaM2(size.width_cm, size.height_cm) > BOOKING.MAX_AREA_M2_PER_SLOT : false;

  return (
    <div className="space-y-8">
      {product.size_options.length > 1 && (
        <fieldset>
          <legend className="mb-3 text-xl">Choose a size</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {product.size_options.map((s) => (
              <label
                key={s.label}
                className={`cursor-pointer border p-4 transition ${s.label === sizeLabel ? "border-cyan" : "border-zinc-700 hover:border-zinc-500"}`}
              >
                <input type="radio" name="size" value={s.label} checked={s.label === sizeLabel} onChange={() => setSizeLabel(s.label)} className="sr-only" />
                <span className="block font-semibold">{s.label}</span>
                <span className="font-mono text-xs text-zinc-400">
                  {s.width_cm} × {s.height_cm} cm · {formatGBP(s.price_pence)}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      )}
      {product.size_options.length === 1 && size && (
        <p className="font-mono text-sm text-zinc-400">
          Size: {size.width_cm} × {size.height_cm} cm
        </p>
      )}
      <CheckoutForm
        item={size ? { kind: "product", productId: product.id, sizeLabel: size.label } : null}
        pricePence={size?.price_pence ?? null}
        blockedReason={tooBig ? `This size is over ${BOOKING.MAX_AREA_M2_PER_SLOT} m², so it needs a site visit. Please contact us for a quote.` : null}
        firstMonth={firstMonth}
        lastMonth={lastMonth}
      />
    </div>
  );
}
