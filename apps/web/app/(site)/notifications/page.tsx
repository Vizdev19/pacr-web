import type { Metadata } from "next";
import { NotificationsPage } from "@/components/pages/notifications/NotificationsPage";

export const metadata: Metadata = { title: "Notifications", robots: { index: false } };

/** /notifications: signed in, read in the browser. */
export default function Page() {
  return <NotificationsPage />;
}
