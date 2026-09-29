import type { Metadata } from "next";
import Link from "next/link";
import { BUSINESS } from "@/config";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(BUSINESS.siteUrl),
  title: { default: "Shop | Machine Canvas", template: "%s | Machine Canvas Shop" },
  description: "Buy and book a wall or floor print, printed directly onto your surface and installed on a date that suits you.",
};

// Links back to the main (static) site use absolute URLs so they work both
// behind the Netlify proxy and on the Vercel preview domain.
const NAV = [
  ["Home", "/"],
  ["Commercial", "/commercial"],
  ["Pricing", "/pricing"],
  ["Portfolio", "/portfolio"],
  ["FAQ", "/faq"],
  ["Blog", "/blog"],
  ["Contact", "/contact"],
] as const;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link href="https://api.fontshare.com/v2/css?f[]=cabinet-grotesk@800,700,500,900&display=swap" rel="stylesheet" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500;700&family=Fraunces:ital,opsz,wght@0,9..144,400..900;1,9..144,400..900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen font-sans">
        <header className="sticky top-0 z-50 border-b border-zinc-800 bg-black/85 backdrop-blur-lg">
          <div className="cmyk-bar" />
          <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 lg:px-12">
            <a href={`${BUSINESS.siteUrl}/`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/shop/logo.webp" alt="Machine Canvas" className="h-10 w-auto sm:h-12" />
            </a>
            <nav className="hidden items-center gap-7 lg:flex">
              {NAV.map(([label, href]) => (
                <a key={href} href={`${BUSINESS.siteUrl}${href}`} className="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-white/90 hover:text-cyan">
                  {label}
                </a>
              ))}
              <Link href="/" className="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-cyan">
                Shop
              </Link>
            </nav>
            <details className="relative lg:hidden">
              <summary className="cursor-pointer list-none font-mono text-xs uppercase tracking-widest">Menu</summary>
              <div className="absolute right-0 mt-4 w-56 border border-zinc-800 bg-black/95 p-4">
                <Link href="/" className="block py-2 font-mono text-sm uppercase text-cyan">
                  Shop
                </Link>
                <Link href="/custom" className="block py-2 font-mono text-sm uppercase">
                  Custom print
                </Link>
                {NAV.map(([label, href]) => (
                  <a key={href} href={`${BUSINESS.siteUrl}${href}`} className="block py-2 font-mono text-sm uppercase">
                    {label}
                  </a>
                ))}
              </div>
            </details>
          </div>
        </header>

        <main className="mx-auto max-w-7xl px-5 py-10 lg:px-12 lg:py-16">{children}</main>

        <footer className="border-t border-zinc-800">
          <div className="cmyk-bar" />
          <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-10 sm:flex-row sm:justify-between lg:px-12">
            <p className="mono-label">© {new Date().getFullYear()} Machine Canvas — Wall &amp; Floor Printing</p>
            <div className="flex flex-wrap gap-5">
              <a className="mono-label hover:text-cyan" href={`${BUSINESS.siteUrl}/terms`}>
                Terms
              </a>
              <a className="mono-label hover:text-cyan" href={`${BUSINESS.siteUrl}/privacy`}>
                Privacy
              </a>
              <a className="mono-label hover:text-cyan" href={`${BUSINESS.siteUrl}/refunds`}>
                Refunds
              </a>
              <a className="mono-label hover:text-cyan" href={`mailto:${BUSINESS.contactEmail}`}>
                {BUSINESS.contactEmail}
              </a>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
