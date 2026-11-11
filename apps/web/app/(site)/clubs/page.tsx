import { redirect } from "next/navigation";
import { cookieCity } from "@/lib/data";

export const dynamic = "force-dynamic";

/** /clubs → the visitor's city. */
export default async function Page({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  redirect(`/clubs/${await cookieCity()}${q ? `?q=${encodeURIComponent(q)}` : ""}`);
}
