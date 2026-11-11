import type { Metadata } from "next";
import { ActivityPage } from "@/components/pages/activity/Activity";

// One of the runner's own runs. Signed in, client side; the full log is
// owner-only (run_backups), so nothing here is rendered on the server.
export const metadata: Metadata = { title: "Run", robots: { index: false, follow: false } };

export default async function Page({ params }: { params: Promise<{ ref: string }> }) {
  const { ref } = await params;
  return <ActivityPage runRef={ref.slice(0, 64)} />;
}
