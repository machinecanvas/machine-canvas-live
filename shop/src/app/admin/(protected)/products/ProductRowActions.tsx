"use client";

import Link from "next/link";
import { useTransition } from "react";
import { deleteProduct, toggleProduct } from "../actions";

export function ProductRowActions({ id, slug, active }: { id: string; slug: string; active: boolean }) {
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-wrap gap-2">
      <Link href={`/admin/products/${id}`} className="btn btn-small border-zinc-700">
        Edit
      </Link>
      {active && (
        <Link href={`/${slug}`} className="btn btn-small border-zinc-700" target="_blank">
          View
        </Link>
      )}
      <button className="btn btn-small border-zinc-700" disabled={pending} onClick={() => start(() => toggleProduct(id, !active))}>
        {active ? "Hide" : "Show"}
      </button>
      <button
        className="btn btn-small border-magenta text-magenta"
        disabled={pending}
        onClick={() => confirm("Delete this product? Existing bookings are kept.") && start(() => deleteProduct(id))}
      >
        Delete
      </button>
    </div>
  );
}
