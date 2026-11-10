import type { Metadata } from "next";
import { Manrope, Outfit } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const outfit = Outfit({ subsets: ["latin"], weight: ["500", "600", "700"], variable: "--font-outfit" });
const manrope = Manrope({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-manrope" });

export const metadata: Metadata = {
  title: "Host — PACR",
  robots: { index: false, follow: false },
  icons: { icon: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${outfit.variable} ${manrope.variable}`}>
      <body>
        <header className="site-head">
          {/* Plain <a>: "/" is the static site, outside this app's basePath,
              which <Link> would add. */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a className="brand" href="/" aria-label="PACR home">
            <span className="brand-dot" aria-hidden />
            PACR <span className="brand-sub">Host</span>
          </a>
          <nav className="host-nav" aria-label="Host">
            {/* Events still live on the original /host page (host.html). */}
            <a href="/host">Events</a>
            <Link href="/squads" className="on">Squads</Link>
          </nav>
        </header>
        {children}
      </body>
    </html>
  );
}
