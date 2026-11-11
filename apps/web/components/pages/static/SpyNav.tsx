"use client";
// SectionNav that lights up the section being read: the sticky bar on long
// marketing pages, or the "On this page" rail on the legal pages.
import { useEffect, useState } from "react";
import { SectionNav } from "@/components/ds/nav";

export function SpyNav({ sections, rail = false }: { sections: { id: string; label: string }[]; rail?: boolean }) {
  const [active, setActive] = useState<string | undefined>(rail ? sections[0]?.id : undefined);
  useEffect(() => {
    const els = sections.map(s => document.getElementById(s.id)).filter((e): e is HTMLElement => !!e);
    if (!els.length) return;
    // A section counts as being read once its top passes the upper third of the window.
    const pick = () => {
      const line = window.innerHeight / 3;
      let cur: string | undefined = rail ? els[0].id : undefined;
      for (const el of els) if (el.getBoundingClientRect().top <= line) cur = el.id;
      setActive(cur);
    };
    pick();
    window.addEventListener("scroll", pick, { passive: true });
    window.addEventListener("resize", pick);
    return () => { window.removeEventListener("scroll", pick); window.removeEventListener("resize", pick); };
  }, [sections, rail]);
  return <SectionNav rail={rail} sections={sections} active={active} />;
}
