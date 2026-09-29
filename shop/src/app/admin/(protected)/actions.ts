"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import sharp from "sharp";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { PRODUCT_BUCKET } from "@/lib/uploads";
import { cancelBooking } from "@/lib/booking";
import { DATE_RE } from "@/lib/dates";

const IMAGE_EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

/** Signed URL so the admin's browser can upload an original straight to storage. */
export async function productUploadUrl(mime: string): Promise<{ path: string; token: string }> {
  await requireAdmin();
  const ext = IMAGE_EXT[mime];
  if (!ext) throw new Error("Please upload a JPG, PNG or WebP image.");
  const path = `originals/${crypto.randomUUID()}.${ext}`;
  const { data, error } = await supabaseAdmin().storage.from(PRODUCT_BUCKET).createSignedUploadUrl(path);
  if (error) throw error;
  return { path, token: data.token };
}

/** Make a web-optimised 1600px WebP from the original and return its public URL. */
async function makeThumbnail(originalPath: string): Promise<string> {
  const bucket = supabaseAdmin().storage.from(PRODUCT_BUCKET);
  const { data, error } = await bucket.download(originalPath);
  if (error) throw error;
  const webp = await sharp(Buffer.from(await data.arrayBuffer()))
    .rotate()
    .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer();
  const thumbPath = `web/${crypto.randomUUID()}.webp`;
  const { error: upErr } = await bucket.upload(thumbPath, webp, { contentType: "image/webp", cacheControl: "31536000" });
  if (upErr) throw upErr;
  return bucket.getPublicUrl(thumbPath).data.publicUrl;
}

const Size = z.object({
  label: z.string().trim().min(1).max(100),
  width_cm: z.number().positive().max(10000),
  height_cm: z.number().positive().max(10000),
  price_pence: z.number().int().positive(),
});

const ProductInput = z.object({
  id: z.uuid().optional(),
  title: z.string().trim().min(2).max(160),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(100)
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Slug can only contain lowercase letters, numbers and dashes"),
  description: z.string().max(5000),
  category: z.enum(["wall", "floor"]),
  active: z.boolean(),
  sizes: z.array(Size).min(1, "Add at least one size").max(20),
  originalPath: z.string().regex(/^originals\/[0-9a-f-]{36}\.(jpg|png|webp)$/).nullable(),
});

export type ProductInputType = z.infer<typeof ProductInput>;

export async function saveProduct(input: ProductInputType): Promise<{ error?: string }> {
  await requireAdmin();
  const parsed = ProductInput.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Please check the form." };
  const p = parsed.data;
  if (new Set(p.sizes.map((s) => s.label)).size !== p.sizes.length) return { error: "Each size needs a different label." };

  const row: Record<string, unknown> = {
    title: p.title,
    slug: p.slug,
    description: p.description,
    category: p.category,
    active: p.active,
    size_options: p.sizes,
    price_pence: Math.min(...p.sizes.map((s) => s.price_pence)),
  };
  if (p.originalPath) {
    try {
      row.image_url = await makeThumbnail(p.originalPath);
      row.original_image_path = p.originalPath;
    } catch (e) {
      console.error("thumbnail failed", e);
      return { error: "Couldn't process that image. Try a different file." };
    }
  } else if (!p.id) {
    return { error: "Please add an image." };
  }

  const db = supabaseAdmin();
  const { error } = p.id ? await db.from("products").update(row).eq("id", p.id) : await db.from("products").insert(row);
  if (error) return { error: error.code === "23505" ? "That slug is already used by another product." : error.message };

  revalidatePath("/", "layout");
  redirect("/admin/products");
}

export async function toggleProduct(id: string, active: boolean) {
  await requireAdmin();
  await supabaseAdmin().from("products").update({ active }).eq("id", id);
  revalidatePath("/", "layout");
}

export async function deleteProduct(id: string) {
  await requireAdmin();
  // Bookings keep their details; product_id is set null by the foreign key.
  const { error } = await supabaseAdmin().from("products").delete().eq("id", id);
  if (error) throw error;
  revalidatePath("/", "layout");
}

export async function cancelBookingAction(id: string): Promise<{ error?: string }> {
  await requireAdmin();
  if (!z.uuid().safeParse(id).success) return { error: "Invalid booking" };
  try {
    await cancelBooking(id);
  } catch (e) {
    console.error("cancel failed", e);
    return { error: `Cancel failed: ${(e as Error).message}` };
  }
  revalidatePath("/admin");
  return {};
}

const Blockout = z.object({
  date: z.string().regex(DATE_RE),
  slot: z.enum(["all", "morning", "evening"]),
  reason: z.string().max(200),
});

export async function addBlockout(form: FormData) {
  await requireAdmin();
  const parsed = Blockout.safeParse({ date: form.get("date"), slot: form.get("slot"), reason: form.get("reason") ?? "" });
  if (!parsed.success) return;
  const { date, slot, reason } = parsed.data;
  const { error } = await supabaseAdmin()
    .from("blockouts")
    .insert({ date, slot: slot === "all" ? null : slot, reason });
  if (error && error.code !== "23505") throw error;
  revalidatePath("/admin/blockouts");
}

export async function deleteBlockout(id: string) {
  await requireAdmin();
  await supabaseAdmin().from("blockouts").delete().eq("id", id);
  revalidatePath("/admin/blockouts");
}
