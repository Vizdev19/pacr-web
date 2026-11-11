"use client";
// "Open in pacr" for the share pages (/e, /p, /u), as the old api/*.mjs pages
// did it: pacr://<path> on iPhone, an intent:// with a Play Store fallback on
// Android (a bare pacr:// link does nothing there), and /download on a
// computer.
//
// On iPhone a pacr:// link does nothing without the app: Safari says the
// address is invalid, and Instagram's and WhatsApp's browsers drop it. So a
// tap tries the app, and if this page is still showing 1.5 s later, goes to
// the App Store listing instead. When the app does open, iOS hides the page
// and pauses its timers, so a hidden page, or a timer that fires late, means
// the app took it.
import { useSyncExternalStore, type MouseEvent } from "react";
import { OpenInAppBar } from "@/components/ds/actions";
import { Button } from "@/components/ds/core";
import { APP_STORE_URL } from "@/lib/config";
import { openInAppHref } from "@/lib/event";

const noop = () => () => {};
const IPHONE = /iPhone|iPad|iPod/i;
const WAIT_MS = 1500;

/** Try pacr://…; still here after WAIT_MS, with the page in front: the App Store. */
function openAppOrStore(scheme: string): void {
  let gone = false;
  const onHidden = () => { if (document.visibilityState === "hidden") gone = true; };
  const onLeave = () => { gone = true; };
  document.addEventListener("visibilitychange", onHidden);
  window.addEventListener("pagehide", onLeave);
  const started = Date.now();
  window.setTimeout(() => {
    document.removeEventListener("visibilitychange", onHidden);
    window.removeEventListener("pagehide", onLeave);
    if (gone || document.visibilityState !== "visible" || Date.now() - started > WAIT_MS + 1000) return;
    window.location.href = APP_STORE_URL;
  }, WAIT_MS);
  window.location.href = scheme;
}

/** The link for this device ("/download" on the server and on computers) and, on iPhone, the tap with the App Store fallback. */
export function useOpenInApp(path: string): { href: string; onClick?: (e: MouseEvent) => void } {
  const ua = useSyncExternalStore(noop, () => navigator.userAgent, () => "");
  const href = openInAppHref(path, ua);
  if (!IPHONE.test(ua)) return { href };
  return { href, onClick: e => { e.preventDefault(); openAppOrStore(href); } };
}

/** The link for this device; "/download" on the server and on computers. */
export function useOpenInAppHref(path: string): string {
  return useOpenInApp(path).href;
}

export function OpenInAppCard({ path, sub }: { path: string; sub: string }) {
  const { href, onClick } = useOpenInApp(path);
  // The bar takes no click handler, so its link's tap is caught on the way down.
  return (
    <div style={{ display: "contents" }}
      onClickCapture={onClick ? e => { if ((e.target as Element).closest?.("a[href]")) onClick(e); } : undefined}>
      <OpenInAppBar card fixed={false} title="Open in pacr" sub={sub} href={href} action="Open" />
    </div>
  );
}

export function OpenInAppButton({ path, label = "Open in pacr", variant = "primary", block = false }: { path: string; label?: string; variant?: "primary" | "secondary"; block?: boolean }) {
  const { href, onClick } = useOpenInApp(path);
  return <Button href={href} onClick={onClick} variant={variant} block={block} icon="smartphone">{label}</Button>;
}
