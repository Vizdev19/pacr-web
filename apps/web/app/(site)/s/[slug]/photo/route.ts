// /s/<slug>/photo: a public squad's tile, proxied (squad.mjs's ?photo=1).
import { pictureResponse } from "@/lib/squad";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  return pictureResponse((await params).slug, "avatar_path");
}
