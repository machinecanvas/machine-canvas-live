// Business settings for the shop. Everything that affects price or
// availability lives here so it can be changed in one place.

export type Category = "wall" | "floor";
export type Slot = "morning" | "evening";

export const CATEGORIES: Category[] = ["wall", "floor"];

// Custom print price, matching the main site's pricing page (VAT included):
// a minimum job price that covers the first INCLUDED_M2, then a flat rate
// for every extra m². Walls and floors are priced the same.
export const PRICING = {
  MIN_JOB: { wall: 197, floor: 197 } as Record<Category, number>, // £, covers up to INCLUDED_M2
  INCLUDED_M2: 1,
  PER_EXTRA_M2: { wall: 49, floor: 49 } as Record<Category, number>, // £ per m² beyond INCLUDED_M2
  ROUND_TO_PENCE: 100, // round final price to the nearest £1 (use 50 for 50p)
};

// Discount for a customer's first booking (no earlier paid booking with the
// same email or phone). Applies to shop products and custom prints.
// Set to 0 to switch it off.
export const NEW_CUSTOMER_DISCOUNT_PCT = 50;

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
