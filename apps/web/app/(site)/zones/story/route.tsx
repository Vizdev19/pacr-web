// /zones/story?age=&max=&d=&t=: the runner's zones as a 1080 × 1920 picture
// (9:16, an Instagram story). Same query as the page's share link, same maths
// (lib/zones.ts).
//
// Drawn in pacr's social style, "Gradient Pop" (Hari's approved templates in
// the pacr-social skill, e.g. weekly-recap-story): night canvas, a Sunset blob
// off the top corner, a lime pill tag and DM Mono metadata, an Anton headline,
// Schibsted Grotesk numbers, the heartbeat line, and the white logo bottom
// left, with pacr's Instagram handle opposite it. Like the templates, content sits between y 220 and 1640, clear of
// what Instagram draws over a story.
//
// Fonts are fetched from Google Fonts as TTF (the renderer can't read WOFF2),
// once per instance; the renderer's own face if that fails.
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { calculate, DEFAULTS, fmtPace, RACES, raceKm, type ZoneForm } from "@/lib/zones";

export const dynamic = "force-dynamic";

const W = 1080, H = 1920;
// Gradient Pop palette (pacr-social references/brand.md §2).
const NIGHT = "#0C0C2C", RAISED = "#24244F", DIVIDER = "#3A3A66", WHITE = "#FFFFFF", LIME = "#C0FF6B";
const SUNSET = "linear-gradient(135deg, #FF4FA3, #FF8A3D)";
const LIME_GRAD = "linear-gradient(135deg, #3BE08C, #C0FF6B)";
const ELECTRIC = "linear-gradient(135deg, #7B4DFF, #2F6BFF)";
// Heart-rate zone colours from the brand book (§3); Zone 3 is the brief's grey.
const ZONE_HEX = ["#7FA8FF", "#5ED3B0", "#8C949A", "#FFB13D", "#FF5A36"];
const SOFT = "rgba(255,255,255,0.72)";
// pacr's Instagram (lib/config SOCIALS) and the Instagram glyph, the same
// Simple Icons shape (CC0) the site's footer uses (components/ds/brands.tsx).
const IG_HANDLE = "@pacr.running";
const IG_PATH = "M7.0301.084c-1.2768.0602-2.1487.264-2.911.5634-.7888.3075-1.4575.72-2.1228 1.3877-.6652.6677-1.075 1.3368-1.3802 2.127-.2954.7638-.4956 1.6365-.552 2.914-.0564 1.2775-.0689 1.6882-.0626 4.947.0062 3.2586.0206 3.6671.0825 4.9473.061 1.2765.264 2.1482.5635 2.9107.308.7889.72 1.4573 1.388 2.1228.6679.6655 1.3365 1.0743 2.1285 1.38.7632.295 1.6361.4961 2.9134.552 1.2773.056 1.6884.069 4.9462.0627 3.2578-.0062 3.668-.0207 4.9478-.0814 1.28-.0607 2.147-.2652 2.9098-.5633.7889-.3086 1.4578-.72 2.1228-1.3881.665-.6682 1.0745-1.3378 1.3795-2.1284.2957-.7632.4966-1.636.552-2.9124.056-1.2809.0692-1.6898.063-4.948-.0063-3.2583-.021-3.6668-.0817-4.9465-.0607-1.2797-.264-2.1487-.5633-2.9117-.3084-.7889-.72-1.4568-1.3876-2.1228C21.2982 1.33 20.628.9208 19.8378.6165 19.074.321 18.2017.1197 16.9244.0645 15.6471.0093 15.236-.005 11.977.0014 8.718.0076 8.31.0215 7.0301.0839m.1402 21.6932c-1.17-.0509-1.8053-.2453-2.2287-.408-.5606-.216-.96-.4771-1.3819-.895-.422-.4178-.6811-.8186-.9-1.378-.1644-.4234-.3624-1.058-.4171-2.228-.0595-1.2645-.072-1.6442-.079-4.848-.007-3.2037.0053-3.583.0607-4.848.05-1.169.2456-1.805.408-2.2282.216-.5613.4762-.96.895-1.3816.4188-.4217.8184-.6814 1.3783-.9003.423-.1651 1.0575-.3614 2.227-.4171 1.2655-.06 1.6447-.072 4.848-.079 3.2033-.007 3.5835.005 4.8495.0608 1.169.0508 1.8053.2445 2.228.408.5608.216.96.4754 1.3816.895.4217.4194.6816.8176.9005 1.3787.1653.4217.3617 1.056.4169 2.2263.0602 1.2655.0739 1.645.0796 4.848.0058 3.203-.0055 3.5834-.061 4.848-.051 1.17-.245 1.8055-.408 2.2294-.216.5604-.4763.96-.8954 1.3814-.419.4215-.8181.6811-1.3783.9-.4224.1649-1.0577.3617-2.2262.4174-1.2656.0595-1.6448.072-4.8493.079-3.2045.007-3.5825-.006-4.848-.0608M16.953 5.5864A1.44 1.44 0 1 0 18.39 4.144a1.44 1.44 0 0 0-1.437 1.4424M5.8385 12.012c.0067 3.4032 2.7706 6.1557 6.173 6.1493 3.4026-.0065 6.157-2.7701 6.1506-6.1733-.0065-3.4032-2.771-6.1565-6.174-6.1498-3.403.0067-6.156 2.771-6.1496 6.1738M8 12.0077a4 4 0 1 1 4.008 3.9921A3.9996 3.9996 0 0 1 8 12.0077";

type Font = { name: string; data: ArrayBuffer; weight: 400 | 500 | 700 | 800 | 900; style: "normal" };
let fontsPromise: Promise<Font[]> | null = null;
async function googleFont(family: string, name: string, weight: Font["weight"]): Promise<Font> {
  const css = await fetch(`https://fonts.googleapis.com/css2?family=${family}:wght@${weight}`, { headers: { "User-Agent": "Mozilla/4.0" } })
    .then(r => (r.ok ? r.text() : ""));
  const url = /src:\s*url\(([^)]+)\)/.exec(css)?.[1];
  if (!url) throw new Error(`no ${name} ${weight}`);
  return { name, weight, style: "normal", data: await fetch(url).then(r => r.arrayBuffer()) };
}
function storyFonts(): Promise<Font[]> {
  fontsPromise ??= Promise.all([
    googleFont("Anton", "Anton", 400),
    googleFont("Schibsted+Grotesk", "Schibsted Grotesk", 700),
    googleFont("Schibsted+Grotesk", "Schibsted Grotesk", 800),
    googleFont("Schibsted+Grotesk", "Schibsted Grotesk", 900),
    googleFont("DM+Mono", "DM Mono", 500),
  ]).catch(e => { fontsPromise = null; throw e; });
  return fontsPromise;
}

// The white logo on transparent (pacr-social assets/pacr-logo.png, 2400 × 1001).
let logoPromise: Promise<string | null> | null = null;
function logo(origin: string): Promise<string | null> {
  logoPromise ??= readFile(join(process.cwd(), "public/brand/pacr-logo-white.png"))
    .then(b => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer)
    .catch(() => fetch(new URL("/brand/pacr-logo-white.png", origin)).then(r => (r.ok ? r.arrayBuffer() : Promise.reject(new Error("no logo")))))
    .then(b => `data:image/png;base64,${Buffer.from(b).toString("base64")}`)
    .catch(() => { logoPromise = null; return null; });
  return logoPromise;
}

const one = (v: string | null) => v?.slice(0, 12) ?? "";

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const form: ZoneForm = q.has("t")
    ? { age: one(q.get("age")), max: one(q.get("max")), d: String(raceKm(one(q.get("d")))), t: one(q.get("t")) }
    : DEFAULTS;
  const calc = calculate(form);
  if ("errors" in calc) {
    return new Response(Object.values(calc.errors)[0] ?? "Those numbers don't work.", { status: 400, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }
  const r = calc.result;
  const [fonts, mark] = await Promise.all([storyFonts().catch(() => null), logo(req.url)]);
  const anton = fonts ? "Anton" : undefined, sans = fonts ? "Schibsted Grotesk" : undefined, mono = fonts ? "DM Mono" : undefined;
  const label = RACES.find(x => x.km === raceKm(form.d))?.label ?? "race";
  const race = /K$/.test(label) ? label : label.toLowerCase();
  const meta = `Max HR ${r.maxHr} bpm${r.maxEntered ? "" : " (est.)"} · ${form.t.trim()} ${race}`;

  const row = (z: (typeof r.zones)[number], i: number) => {
    const easy = z.n === 2, grey = z.n === 3;
    const ink = easy ? NIGHT : WHITE;
    const sub = easy ? "Most of your running" : grey ? "Avoid it on easy days" : null;
    return <div key={z.n} style={{
      display: "flex", alignItems: "center", height: 132, borderRadius: 32, overflow: "hidden", color: ink,
      ...(easy ? { backgroundImage: LIME_GRAD }
        : grey ? { backgroundColor: RAISED, backgroundImage: `repeating-linear-gradient(135deg, ${DIVIDER} 0px, ${DIVIDER} 8px, ${RAISED} 8px, ${RAISED} 22px)` }
        : { backgroundColor: RAISED }),
    }}>
      {/* The zone's colour down the left; the lime Easy row is its own colour. */}
      {easy ? null : <div style={{ display: "flex", width: 16, height: "100%", backgroundColor: ZONE_HEX[i] }} />}
      <div style={{ display: "flex", flex: 1, alignItems: "center", justifyContent: "space-between", padding: easy ? "0 36px 0 46px" : "0 36px 0 30px" }}>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontFamily: mono, fontWeight: 500, fontSize: 22, color: easy ? NIGHT : LIME }}>Zone {z.n}</div>
          <div style={{ display: "flex", fontFamily: sans, fontWeight: 900, fontSize: 40, letterSpacing: "-0.02em", lineHeight: 1.05 }}>{z.name}</div>
          {sub ? <div style={{ display: "flex", fontFamily: sans, fontWeight: 800, fontSize: 17, letterSpacing: "0.1em", textTransform: "uppercase", marginTop: 4, color: easy ? NIGHT : SOFT }}>{sub}</div> : null}
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
          <div style={{ display: "flex", alignItems: "baseline", fontFamily: sans }}>
            <span style={{ fontWeight: 900, fontSize: 64, letterSpacing: "-0.04em", lineHeight: 1 }}>{z.bpm[0]}–{z.bpm[1]}</span>
            <span style={{ fontWeight: 700, fontSize: 26, marginLeft: 8 }}>bpm</span>
          </div>
          <div style={{ display: "flex", fontFamily: sans, fontWeight: 700, fontSize: 28, marginTop: 4, color: easy ? NIGHT : SOFT }}>{z.paceText} /km</div>
        </div>
      </div>
    </div>;
  };

  // The heartbeat line (brand.md §5) carries the half marathon pace.
  const hmLine = <div style={{ display: "flex", position: "relative", height: 84, alignItems: "center" }}>
    <svg width="936" height="84" viewBox="0 0 936 84" style={{ position: "absolute", left: 0, top: 0 }}>
      <path d="M0 42 H600 L632 8 L672 76 L704 20 L728 42 H936" fill="none" stroke={LIME} strokeWidth="6" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
    <div style={{ display: "flex", backgroundImage: ELECTRIC, color: WHITE, borderRadius: 9999, padding: "14px 28px", fontFamily: sans, fontWeight: 900, fontSize: 26, letterSpacing: "0.06em", textTransform: "uppercase" }}>
      Half marathon pace {fmtPace(r.hmPace)} /km
    </div>
  </div>;

  const tree = <div style={{ display: "flex", flexDirection: "column", position: "relative", width: W, height: H, padding: "220px 72px 280px", backgroundColor: NIGHT, color: WHITE, overflow: "hidden" }}>
    <div style={{ display: "flex", position: "absolute", right: -220, top: -260, width: 520, height: 520, borderRadius: 9999, backgroundImage: SUNSET }} />

    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 16 }}>
      <div style={{ display: "flex", backgroundImage: LIME_GRAD, color: NIGHT, padding: "12px 26px", borderRadius: 9999, fontFamily: sans, fontWeight: 900, fontSize: 24, letterSpacing: "0.08em", textTransform: "uppercase" }}>My running zones</div>
      <div style={{ display: "flex", fontFamily: mono, fontWeight: 500, fontSize: 26, color: LIME }}>{meta}</div>
    </div>

    <div style={{ display: "flex", flexDirection: "column", marginTop: 34, fontFamily: anton, fontSize: 150, lineHeight: 0.9, textTransform: "uppercase" }}>
      <div style={{ display: "flex" }}>Find your</div>
      <div style={{ display: "flex" }}>real easy.</div>
    </div>

    <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 44 }}>
      {row(r.zones[0], 0)}
      {row(r.zones[1], 1)}
      {row(r.zones[2], 2)}
      {hmLine}
      {row(r.zones[3], 3)}
      {row(r.zones[4], 4)}
    </div>

    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "auto" }}>
      {mark
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={mark} alt="" width={Math.round((54 * 2400) / 1001)} height={54} />
        : <div style={{ display: "flex", fontFamily: sans, fontWeight: 900, fontSize: 48 }}>pacr</div>}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 12 }}>
        <div style={{ display: "flex", fontFamily: sans, fontWeight: 800, fontSize: 28, color: LIME }}>Find yours at pacr.life/zones</div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <svg width="34" height="34" viewBox="0 0 24 24"><path d={IG_PATH} fill={WHITE} /></svg>
          <div style={{ display: "flex", fontFamily: sans, fontWeight: 800, fontSize: 30, color: WHITE }}>{IG_HANDLE}</div>
        </div>
      </div>
    </div>
  </div>;

  const png = await new ImageResponse(tree, { width: W, height: H, ...(fonts ? { fonts } : {}) }).arrayBuffer();
  return new Response(png, {
    status: 200,
    headers: {
      "Content-Type": "image/png",
      "Content-Disposition": 'inline; filename="pacr-zones.png"',
      // The picture is a pure function of the query.
      "Cache-Control": "public, s-maxage=31536000, immutable",
    },
  });
}
