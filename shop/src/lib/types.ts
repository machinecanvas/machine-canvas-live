import type { Category, Slot } from "@/config";

export type SizeOption = { label: string; width_cm: number; height_cm: number; price_pence: number };

export type Product = {
  id: string;
  title: string;
  slug: string;
  description: string;
  category: Category;
  image_url: string | null;
  original_image_path: string | null;
  price_pence: number;
  size_options: SizeOption[];
  active: boolean;
  purchase_count: number;
  created_at: string;
};

export type BookingStatus = "held" | "paid" | "cancelled" | "expired";

export type Booking = {
  id: string;
  product_id: string | null;
  size_label: string | null;
  custom_upload_path: string | null;
  width_cm: number;
  height_cm: number;
  category: Category;
  date: string;
  slot: Slot;
  status: BookingStatus;
  hold_expires_at: string | null;
  stripe_session_id: string | null;
  stripe_payment_intent_id: string | null;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  install_address: string;
  amount_pence: number;
  calendar_event_id: string | null;
  emails_sent_at: string | null;
  refunded_at: string | null;
  created_at: string;
};

export type Blockout = { id: string; date: string; slot: Slot | null; reason: string };

export type SlotState = "available" | "unavailable";
export type DayAvailability = { date: string; bookable: boolean; slots: Record<Slot, SlotState> };
