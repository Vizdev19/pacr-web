import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PlanPage } from "@/components/pages/static/Plan";
import { PLAN_ORDER, PLANS, type PlanSlug } from "@/lib/content";

type Props = { params: Promise<{ distance: string }> };

const planFor = (d: string) => (PLAN_ORDER as string[]).includes(d) ? PLANS[d as PlanSlug] : null;

export const dynamicParams = false;
export function generateStaticParams() {
  return PLAN_ORDER.map(distance => ({ distance }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const plan = planFor((await params).distance);
  if (!plan) return {};
  return {
    title: plan.title,
    description: plan.description,
    alternates: { canonical: `/plans/${plan.slug}` },
    openGraph: { title: `${plan.name} training plan · pacr`, description: plan.description, url: `https://pacr.life/plans/${plan.slug}`, images: ["https://pacr.life/og-image.png?v=3"] },
  };
}

export default async function Page({ params }: Props) {
  const plan = planFor((await params).distance);
  if (!plan) notFound();
  return <PlanPage plan={plan} />;
}
