"use client";
// "Open in pacr" for the share pages (/e, /p, /u), as the old api/*.mjs pages
// did it: pacr://<path> on iPhone (iOS opens these links in the app before the
// page loads when pacr is installed), an intent:// with a Play Store fallback
// on Android (a bare pacr:// link does nothing there), and /download on a
// computer.
import { useSyncExternalStore } from "react";
import { OpenInAppBar } from "@/components/ds/actions";
import { Button } from "@/components/ds/core";
import { openInAppHref } from "@/lib/event";

const noop = () => () => {};

/** The link for this device; "/download" on the server and on computers. */
export function useOpenInAppHref(path: string): string {
  const ua = useSyncExternalStore(noop, () => navigator.userAgent, () => "");
  return openInAppHref(path, ua);
}

export function OpenInAppCard({ path, sub }: { path: string; sub: string }) {
  const href = useOpenInAppHref(path);
  return <OpenInAppBar card fixed={false} title="Open in pacr" sub={sub} href={href} action="Open" />;
}

export function OpenInAppButton({ path, label = "Open in pacr", variant = "primary", block = false }: { path: string; label?: string; variant?: "primary" | "secondary"; block?: boolean }) {
  const href = useOpenInAppHref(path);
  return <Button href={href} variant={variant} block={block} icon="smartphone">{label}</Button>;
}
