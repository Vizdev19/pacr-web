import { redirect } from "next/navigation";
import { cookieCity } from "@/lib/data";

export const dynamic = "force-dynamic";

/** /runs → the visitor's city. */
export default async function Page() {
  redirect(`/runs/${await cookieCity()}`);
}
