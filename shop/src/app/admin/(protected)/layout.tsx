import Link from "next/link";
import { requireAdmin } from "@/lib/admin/auth";
import { logoutAction } from "../login/actions";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const email = await requireAdmin();
  const links: [string, string][] = [
    ["Bookings", "/admin"],
    ["Products", "/admin/products"],
    ["Block-out dates", "/admin/blockouts"],
  ];
  return (
    <div>
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4 border-b border-zinc-800 pb-4">
        <nav className="flex flex-wrap gap-2">
          {links.map(([label, href]) => (
            <Link key={href} href={href} className="btn btn-small border-zinc-700">
              {label}
            </Link>
          ))}
        </nav>
        <form action={logoutAction} className="flex items-center gap-3">
          <span className="font-mono text-xs text-zinc-500">{email}</span>
          <button className="btn btn-small border-zinc-700">Sign out</button>
        </form>
      </div>
      {children}
    </div>
  );
}
