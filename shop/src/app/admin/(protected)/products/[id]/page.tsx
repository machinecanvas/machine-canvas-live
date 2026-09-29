import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { Product } from "@/lib/types";
import { ProductForm } from "../ProductForm";

export default async function EditProduct({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { data } = await supabaseAdmin().from("products").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  return (
    <>
      <h1 className="mb-6 text-3xl">Edit product</h1>
      <ProductForm product={data as Product} />
    </>
  );
}
