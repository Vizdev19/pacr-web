import type { Metadata } from "next";
import { ProfilePage } from "@/components/pages/profile/Profile";

// Signed in, client side: the session lives in the browser (pacr.web.auth),
// so the server only hands over the ref from the link.
export const metadata: Metadata = { title: "Profile", robots: { index: false, follow: false } };

type Props = { searchParams: Promise<{ r?: string | string[] }> };

export default async function Page({ searchParams }: Props) {
  const { r } = await searchParams;
  const ref = typeof r === "string" && r ? r.slice(0, 64) : null;
  return <ProfilePage r={ref} />;
}
