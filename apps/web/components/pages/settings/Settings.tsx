"use client";
// /settings: the account as the web may show it. Name, handle and photo are
// edited in the app. The one privacy control is the old profile page's
// "Pull everything back" (retract_my_posts). Blocked runners can be unblocked
// here, as in the app's Blocked accounts. Connected apps show their state and
// are managed in the app. Deleting the account is never a button on the web.
import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Badge, Button, Card, Icon } from "@/components/ds/core";
import { RunnerRow } from "@/components/ds/content";
import { Skeleton } from "@/components/ds/feedback";
import { Dialog, useToast } from "@/components/ds/overlays";
import { RequireSignIn } from "@/components/site/RequireSignIn";
import { getSupabase } from "@/lib/supabase";
import { dateLong, useLoad } from "@/lib/profile";
import { block, getAccount, getBlocked, getConnections, retractMyPosts, unblock, type Blocked, type Connection } from "@/lib/settings";

export function SettingsPage() {
  return <RequireSignIn title="Sign in to see your settings" body="Your account, privacy, blocked runners and connected apps.">
    {auth => <Settings key={auth.uid} uid={auth.uid} email={auth.email} />}
  </RequireSignIn>;
}

function Settings({ uid, email }: { uid: string; email: string | null }) {
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);
  const signOut = async () => {
    setSigningOut(true);
    await getSupabase().auth.signOut();
    router.push("/"); router.refresh();
  };
  return <div className="pw-container pw-page" style={{ maxWidth: 760 }}>
    <h1 className="t-h1" style={{ marginBottom: "var(--space-8)" }}>Settings</h1>
    <Account uid={uid} email={email} />
    <Privacy />
    <BlockedList uid={uid} />
    <Connected uid={uid} />
    <section className="block" aria-label="Sign out">
      <h2>Sign out</h2>
      <Card><div className="row" style={{ justifyContent: "space-between", gap: "var(--space-4)" }}>
        <p className="t-body-s t-secondary" style={{ margin: 0, flex: 1, minWidth: 220 }}>Signs this browser out of pacr.life. The app stays signed in.</p>
        <Button variant="secondary" icon="log-out" loading={signingOut} onClick={() => void signOut()}>Sign out</Button>
      </div></Card>
    </section>
    <section className="block" aria-label="Delete your account">
      <h2>Delete your account</h2>
      <Card><div className="stack">
        <p className="t-body-s" style={{ margin: 0 }}>Deleting your account removes your runs, posts and photos everywhere. It&apos;s done in the app, not on the web: open <b>Profile</b>, tap the gear for <b>Settings</b>, then <b>Delete account</b> at the bottom.</p>
        <p className="t-body-s t-secondary" style={{ margin: 0 }}>Can&apos;t open the app any more? Help has a way to ask us.</p>
        <Button variant="ghost" size="sm" icon="circle-help" href="/support" style={{ alignSelf: "flex-start" }}>Get help</Button>
      </div></Card>
    </section>
  </div>;
}

function Account({ uid, email }: { uid: string; email: string | null }) {
  const [acc, setAcc] = useState<{ name: string | null; handle: string | null } | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let alive = true;
    getAccount(uid).then(a => { if (alive) setAcc(a); }, () => { if (alive) setFailed(true); });
    return () => { alive = false; };
  }, [uid]);
  return <section className="block" aria-label="Account">
    <h2>Account</h2>
    <Card><div className="stack" style={{ gap: "var(--space-4)" }}>
      {acc || failed ? <dl className="dl">
        <dt><Icon name="user-round" size={17} />Name</dt><dd>{acc?.name || "—"}</dd>
        <dt><Icon name="at-sign" size={17} />Handle</dt><dd>{acc?.handle ? "@" + acc.handle : <span className="t-secondary">Not set</span>}</dd>
        <dt><Icon name="mail" size={17} />Email</dt><dd style={{ overflowWrap: "anywhere" }}>{email || "—"}</dd>
      </dl> : <Skeleton lines={3} />}
      <p className="t-caption" style={{ margin: 0 }}>Your name, handle, photo and bio are edited in the app, under Profile. A handle gives you a profile link others can open.</p>
      <Button variant="secondary" size="sm" icon="smartphone" href="/download" style={{ alignSelf: "flex-start" }}>Edit in the app</Button>
    </div></Card>
  </section>;
}

function Privacy() {
  const toast = useToast();
  const [ask, setAsk] = useState(false);
  const [busy, setBusy] = useState(false);
  const retract = async () => {
    setBusy(true);
    const n = await retractMyPosts();
    setBusy(false); setAsk(false);
    if (n === null) toast({ title: "Couldn't do that", message: "Something went wrong. Try again.", tone: "error" });
    else toast({ title: n === 0 ? "Nothing to pull back" : `${n} ${n === 1 ? "post is" : "posts are"} squad-only again`, message: n === 0 ? "Everything was already squad-only." : undefined });
  };
  return <section className="block" aria-label="Privacy">
    <h2>Privacy</h2>
    <Card><div className="stack">
      <b>Make all my posts squad-only</b>
      <p className="t-body-s t-secondary" style={{ margin: 0 }}>Every post you&apos;ve made goes back to its squads and nowhere else. Followers and everyone else lose them straight away. Who sees your new posts is set in the app, under Profile, Settings.</p>
      <Button variant="secondary" icon="lock" onClick={() => setAsk(true)} style={{ alignSelf: "flex-start" }}>Make all squad-only</Button>
    </div></Card>
    <Dialog open={ask} onClose={() => !busy && setAsk(false)} title="Make every post squad-only?"
      actions={<><Button variant="secondary" disabled={busy} onClick={() => setAsk(false)}>Cancel</Button><Button loading={busy} onClick={() => void retract()}>Make all squad-only</Button></>}>
      <p style={{ margin: 0 }}>Every post you&apos;ve written goes back to its squads and nowhere else. Followers and everyone else lose them straight away. This can&apos;t be undone: sharing a post wider again is done post by post.</p>
    </Dialog>
  </section>;
}

function BlockedList({ uid }: { uid: string }) {
  const toast = useToast();
  const { data: rows, failed, retry, update } = useLoad<Blocked[]>(getBlocked);
  const [busy, setBusy] = useState<number | null>(null);

  const doUnblock = async (i: number) => {
    const b = rows?.[i];
    if (!b) return;
    setBusy(i);
    const ok = await unblock(uid, b.id);
    setBusy(null);
    if (!ok) { toast({ title: "Couldn't unblock", message: "Something went wrong. Try again.", tone: "error" }); return; }
    update(rs => rs.filter(x => x !== b));
    toast({
      title: `Unblocked ${b.name}`, action: "Undo",
      onAction: async () => {
        if (await block(uid, b.id)) update(rs => [b, ...rs]);
        else toast({ title: "Couldn't block again", message: "Block them from their profile in the app.", tone: "error" });
      },
    });
  };

  return <section className="block" aria-label="Blocked runners">
    <h2>Blocked runners</h2>
    <Card>{failed ? <div className="row" style={{ justifyContent: "space-between" }}><span className="t-body-s t-secondary">Couldn&apos;t load your blocked list.</span><Button variant="ghost" size="sm" onClick={retry}>Try again</Button></div>
      : !rows ? <Skeleton variant="runner" />
      : !rows.length ? <p className="t-body-s t-secondary" style={{ margin: 0 }}>You haven&apos;t blocked anyone. Blocking someone hides you from each other on pacr, and they&apos;re never told.</p>
      : <div>{rows.map((b, i) => <RunnerRow key={i} name={b.name} avatar={b.avatar} sub={`Blocked ${dateLong(b.since)}`}
          action={<Button variant="secondary" size="sm" loading={busy === i} onClick={() => void doUnblock(i)}>Unblock</Button>} />)}</div>}
    </Card>
  </section>;
}

function Connected({ uid }: { uid: string }) {
  const [c, setC] = useState<{ garmin: Connection; whoop: Connection } | null>(null);
  useEffect(() => {
    let alive = true;
    getConnections(uid).then(x => { if (alive) setC(x); }, () => { if (alive) setC({ garmin: null, whoop: null }); });
    return () => { alive = false; };
  }, [uid]);
  const state = (x: Connection | undefined) => !c ? <span className="t-caption">Checking</span>
    : !x ? <span className="t-caption">Couldn&apos;t check</span>
    : x.needsReauth ? <Badge tone="warning" size="sm">Reconnect in the app</Badge>
    : x.connected ? <Badge tone="success" size="sm" icon="check">Connected</Badge>
    : <Badge size="sm">Not connected</Badge>;
  const rows: [string, string, string, ReactNode][] = [
    ["apple", "Apple Health", "Lives on your iPhone. Turn it on in the app.", <Badge key="a" size="sm" icon="smartphone">Phone only</Badge>],
    ["smartphone", "Health Connect", "Lives on your Android phone. Turn it on in the app.", <Badge key="h" size="sm" icon="smartphone">Phone only</Badge>],
    ["watch", "Garmin", c?.garmin?.connected && c.garmin.since ? `Connected ${dateLong(c.garmin.since)}.` : "Runs from your Garmin come into pacr.", state(c?.garmin)],
    ["activity", "WHOOP", c?.whoop?.connected && c.whoop.since ? `Connected ${dateLong(c.whoop.since)}.` : "Runs and recovery from WHOOP come into pacr.", state(c?.whoop)],
  ];
  return <section className="block" aria-label="Connected apps">
    <h2>Connected apps</h2>
    <Card><div className="stack" style={{ gap: "var(--space-4)" }}>
      {rows.map(([icon, name, sub, badge]) => <div key={name} className="row" style={{ flexWrap: "nowrap", gap: "var(--space-3)" }}>
        <Icon name={icon} />
        <div style={{ flex: 1, minWidth: 0 }}><b>{name}</b><div className="t-caption">{sub}</div></div>
        {badge}
      </div>)}
      <p className="t-caption" style={{ margin: 0 }}>Connect and disconnect apps in the app, under Profile.</p>
    </div></Card>
  </section>;
}
