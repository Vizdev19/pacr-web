import { Suspense } from "react";
import { SquadMissing } from "@/components/pages/squad/SquadMissing";

// No public squad by that slug (and no invite): "We can't find that squad",
// unless the signed-in runner is a member of a hidden squad by that name, in
// which case their own session can read it (SquadMissing).
export default function NotFound() {
  return <Suspense fallback={null}><SquadMissing /></Suspense>;
}
