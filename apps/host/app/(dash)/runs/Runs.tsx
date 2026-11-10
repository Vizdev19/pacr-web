"use client";

import { useSearchParams } from "next/navigation";
import { EmptyState } from "@/components/ds";
import { useHost } from "@/lib/host";
import { decodeRef } from "@/lib/refs";
import RunDetail from "./RunDetail";
import RunsList from "./RunsList";

export default function Runs() {
  const { host } = useHost();
  const params = useSearchParams();
  const ref = params.get("run");
  if (host.kind !== "squad") {
    return <EmptyState variant="locked" title="Runs are for squads" message="Switch to a squad you lead to schedule runs." />;
  }
  if (ref) return <RunDetail id={decodeRef(ref)} initialTab={params.get("tab")} />;
  return <RunsList startNew={params.get("new") === "1"} />;
}
