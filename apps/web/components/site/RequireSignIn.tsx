"use client";

import type { ReactNode } from "react";
import { StoreIcons } from "@/components/ds/brands";
import { EmptyState, Skeleton } from "@/components/ds/feedback";
import { signinHref, useAuth, type Auth } from "@/lib/auth";

/**
 * For pages that need a runner: a skeleton while the session loads, the kit's
 * "Sign in to see …" state when there isn't one, else the page with its auth.
 */
export function RequireSignIn({ title, body, children }: { title: string; body: string; children: (auth: Auth & { uid: string }) => ReactNode }) {
  const auth = useAuth();
  if (auth.status === "loading") return <div className="pw-container pw-page"><Skeleton lines={4} /></div>;
  if (auth.status === "signed-out" || !auth.uid) return <div className="pw-container sec">
    <EmptyState icon="lock" title={title} body={body} action="Sign in" href={signinHref()} />
    <div style={{ display: "flex", justifyContent: "center", marginTop: -20 }}><StoreIcons /></div>
  </div>;
  return <>{children({ ...auth, uid: auth.uid })}</>;
}

/** Plain-text-safe mention rendering: @Name, linked to the runner's profile by ref. */
export { MentionText } from "./MentionText";
