import type { Metadata } from "next";
import { Geist_Mono, Onest } from "next/font/google";
import "@/design-system/styles.css";
import "./globals.css";

// The design system's faces (tokens/fonts.css): Onest for everything, Geist
// Mono for order and ticket IDs. Self-hosted by next/font instead of the
// Google Fonts @import, so pages don't wait on a third-party stylesheet.
const onest = Onest({ subsets: ["latin"], weight: ["300", "400", "500", "600", "700"], variable: "--font-onest" });
const geistMono = Geist_Mono({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-geist-mono" });

export const metadata: Metadata = {
  title: { default: "pacr host", template: "%s · pacr host" },
  description: "The dashboard for squad owners and event hosts on pacr.",
  robots: { index: false, follow: false },
  icons: { icon: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${onest.variable} ${geistMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
