// /e/<ref>/poster: the event's 2:3 poster, proxied (api/event.mjs part=poster).
// get_event as anon decides whether there is one to show; the storage path
// starts with the event's uuid, so it never reaches the page.
import { loadEvent, notFoundText, proxyImage } from "@/lib/event";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ ref: string }> }) {
  const { ref } = await params;
  const r = await loadEvent(ref);
  if (!r.ok) return notFoundText("No poster");
  return proxyImage("event-covers", r.event?.cover_path, "No poster");
}
