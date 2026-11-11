import { redirect } from "next/navigation";
import { cookieCity } from "@/lib/data";

export const dynamic = "force-dynamic";

/** /events → the visitor's city. */
export default async function Page() {
  redirect(`/events/${await cookieCity()}`);
}
