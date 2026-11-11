// /zones/story?age=&max=&d=&t=: the runner's zones as a 1080 × 1920 picture
// (9:16, an Instagram story). Same query as the page's share link, same maths
// (lib/zones.ts).
//
// Drawn in pacr's social style, "Gradient Pop" (Hari's approved templates in
// the pacr-social skill, e.g. weekly-recap-story): night canvas, a Sunset blob
// off the top corner, a lime pill tag and DM Mono metadata, an Anton headline,
// Schibsted Grotesk numbers, the heartbeat line, and the white logo bottom
// left. Like the templates, content sits between y 220 and 1640, clear of
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
      <div style={{ display: "flex", fontFamily: sans, fontWeight: 800, fontSize: 28, color: LIME }}>Find yours at pacr.life/zones</div>
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
