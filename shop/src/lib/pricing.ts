import { PRICING, CUSTOM_UPLOAD, BOOKING } from "@/config";

export type Rate = { setup: number; perM2: number }; // £

export type RatedPrice = {
  setupPence: number;
  areaPence: number; // area × rate per m²
  pricePence: number; // total inc. VAT
};

export type Quote = {
  areaM2: number;
  standard: RatedPrice & Rate;
  newCustomer: (RatedPrice & Rate) | null; // null when there's no new-customer offer
  overMaxArea: boolean;
};

export function areaM2(widthCm: number, heightCm: number): number {
  return (widthCm * heightCm) / 10000;
}

function rated(area: number, rate: Rate): RatedPrice & Rate {
  const setupPence = Math.round(rate.setup * 100);
  const areaPence = Math.round(area * rate.perM2 * 100);
  return { ...rate, setupPence, areaPence, pricePence: setupPence + areaPence };
}

/**
 * Price of any print at a given size: setup fee + area × rate per m², to the
 * penny. Runs on both client (live preview) and server (Stripe session
 * creation); the server value is the only one ever charged.
 */
export function quote(widthCm: number, heightCm: number): Quote {
  const area = areaM2(widthCm, heightCm);
  const nc = PRICING.NEW_CUSTOMER;
  return {
    areaM2: area,
    standard: rated(area, { setup: PRICING.SETUP, perM2: PRICING.PER_M2 }),
    newCustomer: nc ? rated(area, { setup: nc.SETUP, perM2: nc.PER_M2 }) : null,
    overMaxArea: area > BOOKING.MAX_AREA_M2_PER_SLOT,
  };
}

/** Discount in pence a first-time customer gets at this size (0 if there's no offer). */
export function newCustomerDiscount(q: Quote): number {
  return q.newCustomer ? Math.max(0, q.standard.pricePence - q.newCustomer.pricePence) : 0;
}

export function validDimensions(widthCm: number, heightCm: number): boolean {
  return [widthCm, heightCm].every(
    (v) => Number.isFinite(v) && v >= CUSTOM_UPLOAD.MIN_CM && v <= CUSTOM_UPLOAD.MAX_CM,
  );
}

/** Effective print resolution when an image of the given pixels is stretched to the given size. */
export function effectiveDpi(pxW: number, pxH: number, widthCm: number, heightCm: number): number {
  const dpiW = pxW / (widthCm / 2.54);
  const dpiH = pxH / (heightCm / 2.54);
  return Math.min(dpiW, dpiH);
}

export type DpiVerdict = "ok" | "warn" | "block";

export function dpiVerdict(dpi: number): DpiVerdict {
  if (dpi < CUSTOM_UPLOAD.BLOCK_DPI) return "block";
  if (dpi < CUSTOM_UPLOAD.WARN_DPI) return "warn";
  return "ok";
}

export function formatGBP(pence: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: pence % 100 === 0 ? 0 : 2,
  }).format(pence / 100);
}

export function formatM2(m2: number): string {
  return `${Number(m2.toFixed(2))} m²`;
}

/** Lowest standard price across a product's listed sizes ("from £X"). */
export function fromPricePence(sizes: { width_cm: number; height_cm: number }[]): number {
  return Math.min(...sizes.map((s) => quote(s.width_cm, s.height_cm).standard.pricePence));
}
