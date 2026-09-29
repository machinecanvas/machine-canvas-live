import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { Category } from "@/config";
import type { Product } from "@/lib/types";

export async function listActiveProducts(category?: Category): Promise<Product[]> {
  let q = supabaseAdmin().from("products").select("*").eq("active", true).order("created_at", { ascending: false });
  if (category) q = q.eq("category", category);
  const { data, error } = await q;
  if (error) throw error;
  return data as Product[];
}

export async function getActiveProduct(slug: string): Promise<Product | null> {
  const { data, error } = await supabaseAdmin().from("products").select("*").eq("slug", slug).eq("active", true).maybeSingle();
  if (error) throw error;
  return data as Product | null;
}
