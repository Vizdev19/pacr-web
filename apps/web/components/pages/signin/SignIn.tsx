"use client";
// /signin: ui_kits/website/Account.jsx (SignInPage) wired to the real flows
// in lib/signin.ts, which are js/signin.js + js/auth.js from the static site.
//
// On load it first finishes a return from Apple or Google (?code= or
// ?error=), then checks for a session; either way a signed-in visitor goes
// straight on to ?next= (same-site paths only) or /feed and never sees the
// form. Otherwise: Apple, Google, or email and a six-digit code.
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { FEED_ON_WEB } from "@/lib/config";
import { Button, Card, Logo } from "@/components/ds/core";
import { Skeleton } from "@/components/ds/feedback";
import { CodeInput, FieldMessage, Input } from "@/components/ds/forms";
import {
  EMAIL_RE, PROVIDER_NAMES, RESEND_COOLDOWN_SEC, currentUser, finishProviderSignIn, isSigninPath,
  nextFromQuery, sendCode, startProviderSignIn, verifyCode, type Provider,
} from "@/lib/signin";

type Step = "boot" | "start" | "code" | "leaving";
type Msg = { tone: "hint" | "error" | "success"; text: string } | null;

/** Where a signed-in visitor goes: ?next= when it's a same-site path that isn't sign-in, else the feed. */
function land() {
  const next = nextFromQuery();
  window.location.replace(next && !isSigninPath(next) ? next : FEED_ON_WEB ? "/feed" : "/squads");
}

/* Apple's own logo and Google's own "G", as their sign-in rules ask (the kit's Lucide glyphs are stand-ins). */
function AppleLogo() {
  return <svg width="17" height="20" viewBox="0 0 17 20" aria-hidden="true" fill="currentColor"><path d="M14.05 10.63c-.02-2.3 1.88-3.4 1.96-3.46-1.07-1.56-2.73-1.77-3.32-1.8-1.41-.14-2.76.83-3.48.83-.72 0-1.82-.81-3-.79-1.54.02-2.96.9-3.76 2.28-1.6 2.78-.41 6.9 1.15 9.16.76 1.1 1.67 2.34 2.87 2.3 1.15-.05 1.59-.75 2.98-.75 1.39 0 1.78.75 3 .72 1.24-.02 2.03-1.12 2.78-2.23.88-1.28 1.24-2.52 1.26-2.59-.03-.01-2.41-.93-2.44-3.67zM11.77 3.88c.64-.77 1.06-1.84.95-2.91-.91.04-2.02.61-2.67 1.38-.59.68-1.1 1.77-.96 2.81 1.01.08 2.05-.52 2.68-1.28z" /></svg>;
}
function GoogleG() {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/brand/google-g.png" srcSet="/brand/google-g@2x.png 2x, /brand/google-g@3x.png 3x" width={20} height={20} alt="" />;
}

export function SignIn() {
  const [step, setStep] = useState<Step>("boot");
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState("");
  const [code, setCode] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [msg, setMsg] = useState<Msg>(null);
  const [sending, setSending] = useState(false);
  const [checking, setChecking] = useState(false);
  const [provider, setProvider] = useState<Provider | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const busy = useRef(false);

  // Back from Apple/Google first (the session it makes is what currentUser looks for), then any session.
  useEffect(() => {
    let alive = true;
    (async () => {
      const back = await finishProviderSignIn();
      if (!alive) return;
      if (back?.ok) { setStep("leaving"); land(); return; }
      if (await currentUser()) { if (alive) { setStep("leaving"); land(); } return; }
      if (!alive) return;
      setStep("start");
      if (back && !back.ok && back.text) setMsg({ tone: "error", text: back.text });
    })();
    // Back from Apple's or Google's page without finishing restores this page
    // from the back-forward cache with the buttons still disabled.
    const shown = (e: PageTransitionEvent) => { if (e.persisted) { setProvider(null); setMsg(null); } };
    window.addEventListener("pageshow", shown);
    return () => { alive = false; window.removeEventListener("pageshow", shown); };
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const continueWith = async (p: Provider) => {
    setProvider(p);
    setMsg({ tone: "hint", text: `Opening ${PROVIDER_NAMES[p]}…` });
    const res = await startProviderSignIn(p, nextFromQuery());
    if (!res.ok) { setProvider(null); setMsg({ tone: "error", text: res.text }); }
  };

  const requestCode = async (address: string, resend = false) => {
    setSending(true);
    setMsg({ tone: "hint", text: resend ? "Sending a new code…" : "Sending…" });
    const res = await sendCode(address);
    setSending(false);
    if (!res.ok) { setMsg({ tone: "error", text: res.text }); return; }
    setPending(address);
    setCode("");
    setAttempt(a => a + 1);
    setStep("code");
    setMsg({ tone: "success", text: resend ? "New code sent." : "Code sent. It expires in an hour." });
    setCooldown(RESEND_COOLDOWN_SEC);
  };

  const submitEmail = (e: FormEvent) => {
    e.preventDefault();
    const address = email.trim().toLowerCase();
    if (!EMAIL_RE.test(address)) { setMsg({ tone: "error", text: "Enter a valid email address." }); return; }
    requestCode(address);
  };

  const submitCode = useCallback(async (token: string) => {
    if (busy.current) return;
    if (!/^\d{6}$/.test(token)) { setMsg({ tone: "error", text: "Enter the six digits from the email." }); return; }
    busy.current = true;
    setChecking(true);
    setMsg({ tone: "hint", text: "Checking…" });
    const res = await verifyCode(pending, token);
    busy.current = false;
    setChecking(false);
    if (!res.ok) {
      // Clear the cells and put the cursor back in the first one for another go.
      setCode("");
      setAttempt(a => a + 1);
      setMsg({ tone: "error", text: res.text });
      return;
    }
    setMsg(null);
    setStep("leaving");
    land();
  }, [pending]);

  const onCode = (v: string) => {
    const digits = v.replace(/\D/g, "").slice(0, 6);
    setCode(v);
    if (msg?.tone === "error") setMsg(null);
    // Typing or pasting six digits is the whole intent, so submit on it.
    if (digits.length === 6 && v.length === 6) submitCode(digits);
  };

  const anotherEmail = () => {
    setStep("start");
    setCode("");
    setCooldown(0);
    setMsg(null);
  };

  const message = msg ? <FieldMessage tone={msg.tone}>{msg.text}</FieldMessage> : null;
  const providersBusy = provider !== null;

  return <div className="pw-container" style={{ padding: "var(--space-12) var(--page-gutter) var(--space-20)", display: "grid", placeItems: "center" }}>
    <Card style={{ width: "min(420px, 100%)", padding: "var(--space-8) var(--space-6)" }}>
      <div className="stack" style={{ gap: "var(--space-4)" }}>
        <Logo height={30} />
        {step === "boot" || step === "leaving" ? <>
          <h1 className="t-h2">{step === "leaving" ? "Signing you in" : "Sign in to pacr"}</h1>
          <Skeleton lines={3} />
        </> : step === "start" ? <>
          <h1 className="t-h2">Sign in to pacr</h1>
          <p className="t-secondary" style={{ margin: 0 }}>Sign in the way you do in the app: with Apple, Google, or your email and a six-digit code. No password.</p>
          <Button block size="lg" variant="inverse" disabled={providersBusy} loading={provider === "apple"} onClick={() => continueWith("apple")}>
            <span className="row" style={{ flexWrap: "nowrap" }}>{provider === "apple" ? null : <AppleLogo />}Continue with Apple</span>
          </Button>
          <Button block size="lg" variant="secondary" disabled={providersBusy} loading={provider === "google"} onClick={() => continueWith("google")}>
            <span className="row" style={{ flexWrap: "nowrap" }}>{provider === "google" ? null : <GoogleG />}Continue with Google</span>
          </Button>
          <div className="row t-caption" style={{ gap: "var(--space-3)", flexWrap: "nowrap" }}>
            <span style={{ flex: 1, height: 1, background: "var(--border-subtle)" }} />or use your email<span style={{ flex: 1, height: 1, background: "var(--border-subtle)" }} />
          </div>
          <form className="stack" style={{ gap: "var(--space-4)" }} onSubmit={submitEmail} noValidate>
            <Input label="Email" type="email" name="email" autoComplete="email" inputMode="email" placeholder="you@example.com" required
              value={email} onChange={e => { setEmail(e.target.value); if (msg?.tone === "error") setMsg(null); }} />
            <Button type="submit" block size="lg" loading={sending} disabled={!email.trim() || providersBusy}>Email me a code</Button>
          </form>
          {message}
        </> : <>
          <h1 className="t-h2">Check your email</h1>
          <p className="t-secondary" style={{ margin: 0 }}>We sent a 6-digit code to <b style={{ color: "var(--text-primary)" }}>{pending}</b>.</p>
          <form className="stack" style={{ gap: "var(--space-4)" }} onSubmit={e => { e.preventDefault(); submitCode(code.replace(/\D/g, "")); }} noValidate>
            <CodeInput key={attempt} value={code} onChange={onCode} error={msg?.tone === "error"} disabled={checking} autoFocus />
            {message}
            <Button type="submit" block size="lg" loading={checking} disabled={code.replace(/\D/g, "").length !== 6}>Sign in</Button>
          </form>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <Button variant="ghost" size="sm" disabled={cooldown > 0 || sending || checking} loading={sending} onClick={() => requestCode(pending, true)}>
              {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
            </Button>
            <Button variant="ghost" size="sm" disabled={checking} onClick={anotherEmail}>Use a different email</Button>
          </div>
        </>}
        <p className="t-caption" style={{ margin: 0, textAlign: "center" }}>
          No account yet? Accounts are made in the app. <a href="/download">Get pacr</a>
        </p>
      </div>
    </Card>
  </div>;
}
