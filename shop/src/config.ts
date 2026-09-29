// Business settings for the shop. Everything that affects price or
// availability lives here so it can be changed in one place.

export type Category = "wall" | "floor";
export type Slot = "morning" | "evening";

export const CATEGORIES: Category[] = ["wall", "floor"];

// Custom print price = setup fee + rate per m² of print area.
export const PRICING = {
  SETUP: { wall: 150, floor: 150 } as Record<Category, number>, // £
  PER_M2: { wall: 50, floor: 50 } as Record<Category, number>, // £ per m²
  // true: the figures above are what the customer pays (VAT included).
  // false: they are ex VAT and 20% is added on top.
  PRICES_INCLUDE_VAT: true,
  VAT: 0.2,
  ROUND_TO_PENCE: 100, // round final price to the nearest £1 (use 50 for 50p)
};

export const SLOTS: Record<Slot, { label: string; start: string; end: string }> = {
  morning: { label: "Morning", start: "09:00", end: "13:00" },
  evening: { label: "Evening", start: "14:00", end: "18:00" },
};

export const BOOKING = {
  TIMEZONE: "Europe/London",
  NOTICE_DAYS: 2, // dates within this many days from today cannot be booked
  MAX_DAYS_AHEAD: 180,
  HOLD_MINUTES: 10,
  MAX_AREA_M2_PER_SLOT: 15,
};

export const CUSTOM_UPLOAD = {
  MAX_BYTES: 50 * 1024 * 1024,
  MIME_TYPES: ["image/jpeg", "image/png", "application/pdf"],
  WARN_DPI: 100,
  BLOCK_DPI: 50,
  MIN_CM: 20,
  MAX_CM: 2000,
};

export const BUSINESS = {
  name: "Machine Canvas",
  siteUrl: "https://machinecanvas-wallandfloorprinting.com",
  contactEmail: "info@machinecanvas-wallandfloorprinting.com",
  phone: "+44 330 043 5570",
};
