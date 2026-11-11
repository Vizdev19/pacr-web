import type { Metadata } from "next";
import { Download } from "@/components/pages/static/Download";

// /social and /downloads land here with ?via=… (next.config.ts redirects), as
// they did on the static site; the page itself is the same for every visitor.
export const metadata: Metadata = {
  title: "Download the app",
  description: "India's own running app. Get pacr free on the App Store or Google Play, and find pacr running on Instagram, X and LinkedIn.",
  alternates: { canonical: "/download" },
  openGraph: { title: "Get pacr", description: "India's own running app. Free on iPhone and Android.", url: "https://pacr.life/download", images: ["https://pacr.life/og-image.png?v=3"] },
};

export default function Page() {
  return <Download />;
}
