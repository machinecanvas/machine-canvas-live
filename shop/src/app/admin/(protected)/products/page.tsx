import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { formatGBP } from "@/lib/pricing";
import type { Product } from "@/lib/types";
import { ProductRowActions } from "./ProductRowActions";

export default async function AdminProducts() {
  const { data, error } = await supabaseAdmin().from("products").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  const products = data as Product[];
  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl">Products</h1>
        <Link href="/admin/products/new" className="btn btn-cyan btn-small">
          + New product
        </Link>
      </div>
      {products.length === 0 ? (
        <p className="text-zinc-400">No products yet.</p>
      ) : (
        <ul className="space-y-3">
          {products.map((p) => (
            <li key={p.id} className="flex flex-col gap-4 border border-zinc-800 p-3 sm:flex-row sm:items-center">
              <div className="h-20 w-28 shrink-0 bg-zinc-900">
                {p.image_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.image_url} alt="" className="h-full w-full object-cover" />
                )}
              </div>
              <div className="flex-1">
                <p className="font-semibold">
                  {p.title} {!p.active && <span className="ml-2 font-mono text-xs uppercase text-zinc-500">hidden</span>}
                </p>
                <p className="text-sm text-zinc-400">
                  {p.category} · {p.size_options.length} size{p.size_options.length === 1 ? "" : "s"} · from {formatGBP(p.price_pence)} ·{" "}
                  <strong className="text-paper">{p.purchase_count}</strong> sold
                </p>
              </div>
              <ProductRowActions id={p.id} slug={p.slug} active={p.active} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
