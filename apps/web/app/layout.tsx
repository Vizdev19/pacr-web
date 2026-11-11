import type { Metadata, Viewport } from "next";
import { Geist_Mono, Lexend } from "next/font/google";
import "./globals.css";

// The design system's faces: Lexend for display and text, Geist Mono for refs
// and codes. Self-hosted by next/font instead of the Google Fonts @import in
// design-system/tokens/fonts.css.
const lexend = Lexend({ subsets: ["latin"], weight: ["300", "400", "500", "600", "700"], variable: "--font-lexend" });
const geistMono = Geist_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-geist-mono" });

export const metadata: Metadata = {
  metadataBase: new URL("https://pacr.life"),
  title: { default: "pacr: find your running squad", template: "%s · pacr" },
  description: "Find running squads, group runs and events in your city. RSVP, meet at the start line and run together.",
  icons: { icon: "/favicon.svg" },
  openGraph: { siteName: "pacr", type: "website", images: ["/og-image.png"] },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#E9E9E9" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-IN" data-theme="light" className={`${lexend.variable} ${geistMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
