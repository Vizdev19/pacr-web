// /s/<slug>/cover: a public squad's 5:2 cover, proxied (squad.mjs's ?cover=1).
import { pictureResponse } from "@/lib/squad";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  return pictureResponse((await params).slug, "cover_path");
}
