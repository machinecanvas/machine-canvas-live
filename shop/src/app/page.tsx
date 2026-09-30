import Link from "next/link";
import { CATEGORIES, PRICING, type Category } from "@/config";
import { listActiveProducts } from "@/lib/products";
import { formatGBP, fromPricePence } from "@/lib/pricing";

export const dynamic = "force-dynamic";

export default async function ShopPage({ searchParams }: { searchParams: Promise<{ category?: string }> }) {
  const { category: raw } = await searchParams;
  const category = CATEGORIES.includes(raw as Category) ? (raw as Category) : undefined;
  const products = await listActiveProducts(category);

  const tabs: [string, string][] = [
    ["All", "/"],
    ["Wall prints", "/?category=wall"],
    ["Floor prints", "/?category=floor"],
  ];

  return (
    <>
      <div className="mb-10 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="mono-label mb-3">Shop · Supplied &amp; installed</p>
          <h1 className="font-serif text-4xl font-black sm:text-6xl">Wall &amp; floor prints</h1>
          <p className="mt-4 max-w-xl text-zinc-400">
            Pick a design, choose your install date and pay online. We print it directly onto your wall or floor. All prices include VAT and
            installation.
          </p>
          <p className="mt-4 font-mono text-xs text-zinc-500">
            £{PRICING.SETUP} setup + £{PRICING.PER_M2} per m². Every design can be printed at any size.
          </p>
          {PRICING.NEW_CUSTOMER && (
            <p className="mt-3 inline-block border border-cyan px-3 py-2 font-mono text-xs uppercase tracking-widest text-cyan">
              First booking: £{PRICING.NEW_CUSTOMER.SETUP} setup + £{PRICING.NEW_CUSTOMER.PER_M2} per m²
            </p>
          )}
        </div>
        <Link href="/custom" className="btn btn-cyan self-start">
          Print your own image
        </Link>
      </div>

      <nav className="mb-8 flex gap-2" aria-label="Filter by category">
        {tabs.map(([label, href]) => {
          const active = (href === "/" && !category) || href.endsWith(`=${category}`);
          return (
            <Link key={href} href={href} className={`btn btn-small ${active ? "btn-cyan" : "border-zinc-700 text-zinc-300"}`}>
              {label}
            </Link>
          );
        })}
      </nav>

      {products.length === 0 ? (
        <p className="border border-zinc-800 p-10 text-center text-zinc-400">
          No designs here yet. <Link href="/custom" className="text-cyan underline">Print your own image</Link> instead.
        </p>
      ) : (
        <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((p) => (
            <li key={p.id}>
              <Link href={`/${p.slug}`} className="group block border border-zinc-800 bg-zinc-950 transition hover:border-cyan">
                <div className="aspect-[4/3] overflow-hidden bg-white">
                  {/* Prefer the room photo (the print on a wall); fall back to the design itself. */}
                  {(p.room_image_url ?? p.image_url) && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={(p.room_image_url ?? p.image_url)!}
                      alt={p.room_image_url ? `${p.title} printed on a wall` : p.title}
                      loading="lazy"
                      className={`h-full w-full transition duration-500 group-hover:scale-105 ${p.room_image_url ? "object-cover" : "object-contain"}`}
                    />
                  )}
                </div>
                <div className="p-5">
                  <p className="mono-label mb-2">{p.category} print</p>
                  <h2 className="text-xl">{p.title}</h2>
                  <div className="mt-3 flex items-baseline justify-between gap-4">
                    <p className="font-semibold">
                      {formatGBP(fromPricePence(p.size_options))} <span className="text-xs font-normal text-zinc-500">inc. VAT</span>
                    </p>
                    <p className="font-mono text-xs text-zinc-500">
                      Purchased {p.purchase_count} {p.purchase_count === 1 ? "time" : "times"}
                    </p>
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
