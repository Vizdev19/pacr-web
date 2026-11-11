import type { Metadata } from "next";
import { AppPage } from "@/components/pages/static/AppPage";

export const metadata: Metadata = {
  title: "The running app for Indian cities",
  description: "pacr tracks your runs with GPS and a voice coach, writes your 5K to marathon training plan, and finds you a running squad in your city. Free on iPhone and Android.",
  alternates: { canonical: "/app" },
  openGraph: { title: "pacr: run, train and run together", description: "GPS tracking, a voice coach, training plans, squads and group runs. Free on iPhone and Android.", url: "https://pacr.life/app", images: ["https://pacr.life/og-image.png?v=3"] },
};

export default function Page() {
  return <AppPage />;
}
