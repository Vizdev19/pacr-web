"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { EmptyState, Skeleton, Toast, ToastStack, type HostOption, type ToastTone } from "@/components/ds";
import { countOpenReports, failText, myHosting, sessionMe, signedUrls, squadDetail, type Me, type Organizer } from "./api";
import { firstName, plural } from "./format";
import { useLoad } from "./hooks";
import { organizerApplyHref } from "./refs";
import { goSite, signinHref } from "./supabase";

/** What the signed-in person is in the current context. "organizer" is a brand, coach or race account. */
export type RoleKey = "owner" | "organiser" | "leader" | "organizer";
export type Host = {
  /** "squad:<id>" or "organizer:<id>": never shown. */
  key: string;
  kind: "squad" | "organizer";
  id: string;
  name: string;
  slug: string | null;
  roleKey: RoleKey;
  /** "Squad owner", "Organiser", "Run leader", "Organizer". */
  role: string;
  verified: boolean;
  status?: Organizer["status"];
  members?: number;
  isPublic?: boolean;
  avatarUrl?: string;
};

const ROLE: Record<string, { key: RoleKey; label: string }> = {
  owner: { key: "owner", label: "Squad owner" },
  organiser: { key: "organiser", label: "Organiser" },
  run_leader: { key: "leader", label: "Run leader" },
};

type Notify = (tone: ToastTone, title: string, message?: string) => void;
type Ctx = {
  me: Me & { avatarUrl?: string };
  /** "Good morning", by the clock when the dashboard loaded. */
  greeting: string;
  hosts: Host[];
  host: Host;
  setHost: (key: string) => void;
  /** Things waiting on staff in this squad; both 0 for other roles. */
  counts: { requests: number; reports: number };
  refreshCounts: () => void;
  /** A toast: past-tense title plus the specific outcome. */
  notify: Notify;
  /** A toast for a failed action, worded from the database's reason. */
  notifyError: (title: string, e: unknown) => void;
};

const HostContext = createContext<Ctx | null>(null);
export function useHost(): Ctx {
  const c = useContext(HostContext);
  if (!c) throw new Error("useHost outside HostProvider");
  return c;
}
/** Staff = owner or organiser: the roles the database lets manage members, messages and settings. */
export const isStaff = (role: RoleKey) => role === "owner" || role === "organiser";

const STORE = "pacr.host.ctx";
const remembered = () => { try { return localStorage.getItem(STORE); } catch { return null; } };

async function loadShell() {
  const me = await sessionMe();
  if (!me) { window.location.replace(signinHref()); return null; }
  const hosting = await myHosting();
  const [squadPics, myPic] = await Promise.all([
    signedUrls("club-avatars", hosting.squads.map(s => s.avatar_path)),
    signedUrls("avatars", [me.avatarPath, hosting.organizer?.avatar_path]),
  ]);
  const hosts: Host[] = hosting.squads.filter(s => ROLE[s.role]).map(s => ({
    key: `squad:${s.id}`, kind: "squad" as const, id: s.id, name: s.name, slug: s.slug, roleKey: ROLE[s.role].key,
    role: ROLE[s.role].label, verified: s.verified, members: s.members, isPublic: s.is_public,
    avatarUrl: s.avatar_path ? squadPics.get(s.avatar_path) : undefined,
  }));
  const o = hosting.organizer;
  if (o) hosts.push({
    key: `organizer:${o.id}`, kind: "organizer", id: o.id, name: o.name, slug: o.slug, roleKey: "organizer", role: "Organizer",
    verified: o.status === "approved", status: o.status, avatarUrl: o.avatar_path ? myPic.get(o.avatar_path) : undefined,
  });
  const hour = new Date().getHours();
  return {
    me: { ...me, avatarUrl: me.avatarPath ? myPic.get(me.avatarPath) : undefined },
    hosts, stored: remembered(),
    greeting: hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening",
  };
}

type ToastItem = { id: number; tone: ToastTone; title: string; message?: string };

export function HostProvider({ children }: { children: ReactNode }) {
  const shell = useLoad(loadShell, "shell");
  const [picked, setPicked] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const notify = useCallback<Notify>((tone, title, message) => {
    const id = performance.now();
    setToasts(t => [...t.slice(-2), { id, tone, title, message }]);
    window.setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 4200);
  }, []);
  const notifyError = useCallback((title: string, e: unknown) => notify("danger", title, failText(e)), [notify]);

  const data = shell.status === "ready" ? shell.data : null;
  const hosts = data?.hosts;
  const host = hosts?.find(h => h.key === picked) ?? hosts?.find(h => h.key === data?.stored) ?? hosts?.[0] ?? null;

  const counts = useLoad(async () => {
    if (!host || host.kind !== "squad" || !isStaff(host.roleKey)) return { requests: 0, reports: 0 };
    const [detail, reports] = await Promise.all([squadDetail(host.id), countOpenReports(host.id)]);
    return { requests: detail?.pending_requests ?? 0, reports };
  }, `counts:${host?.key ?? ""}`);

  const setHost = useCallback((key: string) => {
    setPicked(key);
    try { localStorage.setItem(STORE, key); } catch { /* private window: the choice lasts for this visit */ }
  }, []);

  const value = useMemo<Ctx | null>(() => (data && host ? {
    me: data.me, greeting: `${data.greeting}, ${firstName(data.me.name)}`, hosts: data.hosts, host, setHost,
    counts: counts.status === "ready" ? counts.data : { requests: 0, reports: 0 }, refreshCounts: counts.reload,
    notify, notifyError,
  } : null), [data, host, setHost, counts.status, counts.data, counts.reload, notify, notifyError]);

  if (shell.status === "error") {
    return <Centered><EmptyState variant="error" title="Couldn’t load your dashboard" message={failText(shell.error)} action={{ label: "Retry", onClick: shell.reload }} /></Centered>;
  }
  if (!data) {
    return <Centered><div style={{ width: "min(420px, 80vw)" }}><Skeleton width={120} height={22} /><Skeleton lines={4} height={14} gap={12} style={{ marginTop: 24 }} /></div></Centered>;
  }
  if (!value) {
    return (
      <Centered>
        <EmptyState icon="footprints" title="You don’t host anything on pacr yet"
          message="This dashboard is for squad owners, organisers and run leaders, and for approved organizers. Start a squad in the pacr app, or ask to host as a brand, coach or race organiser."
          action={{ label: "Ask to host events", onClick: () => goSite(organizerApplyHref) }}
          secondaryAction={{ label: "Get the pacr app", icon: "smartphone", onClick: () => goSite("/download") }} />
      </Centered>
    );
  }
  return (
    <HostContext.Provider value={value}>
      {children}
      <ToastStack>
        {toasts.map(t => <Toast key={t.id} tone={t.tone} title={t.title} message={t.message} onClose={() => setToasts(x => x.filter(y => y.id !== t.id))} />)}
      </ToastStack>
    </HostContext.Provider>
  );
}

function Centered({ children }: { children: ReactNode }) {
  return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}><div style={{ maxWidth: 520 }}>{children}</div></div>;
}

/** Hosts as the switcher lists them: "214 members" under a squad, the review status under an organizer. */
export const hostOptions = (hosts: Host[]): HostOption[] => hosts.map(h => ({
  id: h.key, name: h.name, kind: h.kind, role: h.role, verified: h.verified, src: h.avatarUrl,
  meta: h.kind === "squad" && h.members != null ? plural(h.members, "member") : undefined,
  status: h.kind === "organizer" && h.status !== "approved" ? h.status : undefined,
}));
