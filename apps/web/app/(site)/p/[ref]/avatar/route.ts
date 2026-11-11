// /p/<ref>/avatar: the post author's picture (api/post.mjs part=avatar). A
// chosen preset is a redirect to its art; a photo is proxied. get_post_card
// only gives a path for handle holders, whose pictures anon may read.
import { notFoundText, presetArt, proxyImage, redirectTo } from "@/lib/event";
import { loadPost } from "@/lib/post";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ ref: string }> }) {
  const { ref } = await params;
  const r = await loadPost(ref);
  if (!r.ok) return notFoundText("No photo");
  const art = presetArt(r.post?.author_avatar_path);
  return art ? redirectTo(art) : proxyImage("avatars", r.post?.author_avatar_path);
}
