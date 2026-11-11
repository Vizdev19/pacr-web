// /p/<ref>/photo: a public photo post's picture, proxied (api/post.mjs part=photo).
import { notFoundText, proxyImage } from "@/lib/event";
import { loadPost } from "@/lib/post";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ ref: string }> }) {
  const { ref } = await params;
  const r = await loadPost(ref);
  if (!r.ok) return notFoundText("No photo");
  return proxyImage("post-images", r.post?.image_path);
}
