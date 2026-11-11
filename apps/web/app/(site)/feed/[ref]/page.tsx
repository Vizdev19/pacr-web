import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PostPage } from "@/components/pages/feed/PostPage";

export const metadata: Metadata = {
  title: "Post",
  description: "A run on pacr, with its kudos and comments.",
  robots: { index: false, follow: false },
};

type Props = { params: Promise<{ ref: string }> };

/**
 * /feed/<ref>: one post, where "Comment" and notifications land. The ref is
 * checked for shape here and turned back into an id in the browser, so the
 * uuid never reaches the page's HTML.
 */
export default async function Page({ params }: Props) {
  const { ref } = await params;
  if (!/^[A-Za-z0-9_-]{22}$/.test(ref)) notFound();
  return <PostPage postRef={ref} />;
}
