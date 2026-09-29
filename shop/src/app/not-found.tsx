import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-xl text-center">
      <h1 className="font-serif text-4xl font-black">Not found</h1>
      <p className="mt-4 text-zinc-400">That print isn't available any more.</p>
      <Link href="/" className="btn btn-cyan mt-8">
        Browse the shop
      </Link>
    </div>
  );
}
