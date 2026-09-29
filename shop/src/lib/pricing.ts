import { PRICING, CUSTOM_UPLOAD, BOOKING, type Category } from "@/config";

export type PriceBreakdown = {
  areaM2: number;
  material: number;
  labour: number;
  cost: number;
  net: number; // £ ex VAT, before minimum order
  exVat: number; // £ ex VAT after minimum order
  pricePence: number; // final price inc. VAT, rounded
  overMaxArea: boolean;
};

export function areaM2(widthCm: number, heightCm: number): number {
  return (widthCm / 100) * (heightCm / 100);
}

/**
 * Price for a custom print. Runs on both client (live preview) and server
 * (Stripe session creation); the server value is the only one ever charged.
 */
export function customPrice(category: Category, widthCm: number, heightCm: number): PriceBreakdown {
  const p = PRICING;
  const area = areaM2(widthCm, heightCm);
  const material = area * p.MATERIAL_PER_M2[category];
  const labour = (p.SETUP_HOURS + area * p.HOURS_PER_M2[category]) * p.HOURLY_RATE;
  const cost = material + labour + p.TRAVEL;
  const net = cost / (1 - p.MARGIN - p.CARD_PCT) + p.CARD_FIXED;
  const exVat = Math.max(net, p.MIN_ORDER[category]);
  const incVatPence = exVat * (1 + p.VAT) * 100;
  const pricePence = Math.round(incVatPence / p.ROUND_TO_PENCE) * p.ROUND_TO_PENCE;
  return {
    areaM2: area,
    material,
    labour,
    cost,
    net,
    exVat,
    pricePence,
    overMaxArea: area > BOOKING.MAX_AREA_M2_PER_SLOT,
  };
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
