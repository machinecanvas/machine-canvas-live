// Business settings for the shop. Everything that affects price or
// availability lives here so it can be changed in one place.

export type Category = "wall" | "floor";
export type Slot = "morning" | "evening";

export const CATEGORIES: Category[] = ["wall", "floor"];

// Every print (shop designs and custom uploads) is priced the same way,
// VAT included: a setup fee plus a rate per m² of print area. Walls and
// floors are priced the same. A customer's first booking (no earlier paid
// booking with the same email or phone) gets the NEW_CUSTOMER rates instead.
export const PRICING = {
  SETUP: 197, // £ per job
  PER_M2: 97, // £ per m²
  NEW_CUSTOMER: { SETUP: 150, PER_M2: 50 }, // first booking; set to null to switch off
} as { SETUP: number; PER_M2: number; NEW_CUSTOMER: { SETUP: number; PER_M2: number } | null };

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
