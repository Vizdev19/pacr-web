// /e/<ref>/course: the host's course map picture, proxied like the poster.
// New with this page (the old share page didn't show it); same rules and
// caching as /e/<ref>/poster.
import { loadEvent, notFoundText, proxyImage } from "@/lib/event";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ ref: string }> }) {
  const { ref } = await params;
  const r = await loadEvent(ref);
  if (!r.ok) return notFoundText("No course map");
  return proxyImage("event-covers", r.event?.course_map_path, "No course map");
}
