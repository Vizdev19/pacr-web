// /u/<handle>/photo: the runner's picture (api/profile.mjs photo=1). A chosen
// preset is a redirect to its art; a photo is proxied, since its storage path
// starts with the runner's uuid.
import { notFoundText, presetArt, proxyImage, redirectTo } from "@/lib/event";
import { cleanHandle, loadProfile } from "@/lib/profilecard";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ handle: string }> }) {
  const handle = cleanHandle((await params).handle);
  if (!handle) return notFoundText("No photo");
  const r = await loadProfile(handle);
  const path = r.ok ? r.runner?.avatar_path : null;
  if (!path) return notFoundText("No photo");
  const art = presetArt(path);
  return art ? redirectTo(art) : proxyImage("avatars", path);
}
