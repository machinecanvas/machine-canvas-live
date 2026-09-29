import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getActiveProduct } from "@/lib/products";
import { calendarMonths } from "@/lib/booking-window";
import { ProductBooking } from "@/components/ProductBooking";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const product = await getActiveProduct((await params).slug);
  return product ? { title: product.title, description: product.description.slice(0, 160) } : {};
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const product = await getActiveProduct((await params).slug);
  if (!product) notFound();

  return (
    <>
      <Link href="/" className="mono-label hover:text-cyan">
        ← All prints
      </Link>
      <div className="mt-6 grid gap-10 lg:grid-cols-2">
        <div>
          <div className="border border-zinc-800 bg-zinc-900">
            {product.image_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={product.image_url} alt={product.title} className="w-full" />
            )}
          </div>
          <p className="mt-3 font-mono text-xs text-zinc-500">
            Purchased {product.purchase_count} {product.purchase_count === 1 ? "time" : "times"}
          </p>
        </div>
        <div>
          <p className="mono-label mb-3">{product.category} print · supplied &amp; installed</p>
          <h1 className="font-serif text-4xl font-black sm:text-5xl">{product.title}</h1>
          <div className="mt-6 space-y-4 whitespace-pre-line text-zinc-300">{product.description}</div>
          <div className="mt-10">
            <ProductBooking product={product} {...calendarMonths()} />
          </div>
        </div>
      </div>
    </>
  );
}
