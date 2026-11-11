// /zones/story?age=&max=&d=&t=: the runner's zones as a 1080 × 1920 picture
// (9:16, an Instagram story), with the pacr wordmark. Same query as the
// page's share link, same maths (lib/zones.ts). Instagram covers about the
// top and bottom 250 px of a story with its own buttons, so nothing that
// matters is drawn there: the content is centred, about y 290 to 1630.
//
// Lexend from Google Fonts (TTF: the renderer can't read WOFF2), fetched once
// per instance; the renderer's own face if that fails. Same as /s/<slug>/card.
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { calculate, DEFAULTS, fmtPace, RACES, raceKm, type ZoneForm } from "@/lib/zones";

export const dynamic = "force-dynamic";

const W = 1080, H = 1920;
// The design system's ink, muted text, page grey, white and lime (design-system/tokens/colors.css).
const INK = "#111111", MUTED = "#5E5E5E", PAGE = "#E9E9E9", WHITE = "#FFFFFF", LIME = "#E4F46A";

type Font = { name: string; data: ArrayBuffer; weight: 500 | 700; style: "normal" };
let fontsPromise: Promise<Font[]> | null = null;
async function googleFont(weight: 500 | 700): Promise<Font> {
  const css = await fetch(`https://fonts.googleapis.com/css2?family=Lexend:wght@${weight}`, { headers: { "User-Agent": "Mozilla/4.0" } })
    .then(r => (r.ok ? r.text() : ""));
  const url = /src:\s*url\(([^)]+)\)/.exec(css)?.[1];
  if (!url) throw new Error(`no Lexend ${weight}`);
  return { name: "Lexend", weight, style: "normal", data: await fetch(url).then(r => r.arrayBuffer()) };
}
function storyFonts(): Promise<Font[]> {
  fontsPromise ??= Promise.all([googleFont(700), googleFont(500)]).catch(e => { fontsPromise = null; throw e; });
  return fontsPromise;
}

let wordmarkPromise: Promise<string | null> | null = null;
function wordmark(origin: string): Promise<string | null> {
  wordmarkPromise ??= readFile(join(process.cwd(), "public/brand/pacr-wordmark-on-light.png"))
    .then(b => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer)
    .catch(() => fetch(new URL("/brand/pacr-wordmark-on-light.png", origin)).then(r => (r.ok ? r.arrayBuffer() : Promise.reject(new Error("no wordmark")))))
    .then(b => `data:image/png;base64,${Buffer.from(b).toString("base64")}`)
    .catch(() => { wordmarkPromise = null; return null; });
  return wordmarkPromise;
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
  const [fonts, mark] = await Promise.all([storyFonts().catch(() => null), wordmark(req.url)]);
  const font = fonts ? "Lexend" : undefined;
  const label = RACES.find(x => x.km === raceKm(form.d))?.label ?? "race";
  const race = /K$/.test(label) ? label : label.toLowerCase();
  const basis = `Max heart rate ${r.maxHr} bpm${r.maxEntered ? "" : " (estimated)"} · ${form.t.trim()} ${race}`;

  const text = (size: number, weight: 500 | 700, color = INK, extra: Record<string, string | number> = {}) =>
    ({ display: "flex", fontFamily: font, fontWeight: weight, fontSize: size, color, ...extra });

  const hmLine = <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
    <div style={{ display: "flex", flex: 1, height: 6, borderRadius: 3, background: LIME }} />
    <div style={{ ...text(30, 700), padding: "12px 28px", borderRadius: 999, background: LIME }}>Half marathon pace {fmtPace(r.hmPace)} /km</div>
    <div style={{ display: "flex", flex: 1, height: 6, borderRadius: 3, background: LIME }} />
  </div>;

  const row = (z: (typeof r.zones)[number]) => {
    const easy = z.n === 2, grey = z.n === 3;
    return <div key={z.n} style={{
      display: "flex", alignItems: "center", height: 150, borderRadius: 34, overflow: "hidden",
      background: WHITE,
      ...(grey ? { backgroundImage: "repeating-linear-gradient(135deg, #DCDCDA 0px, #DCDCDA 10px, #FFFFFF 10px, #FFFFFF 22px)" } : {}),
      ...(easy ? { border: `6px solid ${LIME}` } : {}),
    }}>
      <div style={{ display: "flex", width: 18, height: "100%", background: z.hex }} />
      <div style={{ display: "flex", flex: 1, alignItems: "center", justifyContent: "space-between", padding: "0 44px 0 36px" }}>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={text(24, 700, MUTED, { letterSpacing: "0.08em" })}>ZONE {z.n}</div>
          <div style={text(44, 700, INK, { marginTop: 4 })}>{z.name}</div>
          {easy ? <div style={text(24, 500, MUTED, { marginTop: 4 })}>Most of your running</div>
            : grey ? <div style={text(24, 500, MUTED, { marginTop: 4 })}>Avoid it on easy days</div> : null}
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
            <div style={text(58, 700)}>{z.bpm[0]}–{z.bpm[1]}</div>
            <div style={text(28, 500, MUTED)}>bpm</div>
          </div>
          <div style={text(30, 500, MUTED, { marginTop: 2 })}>{z.paceText} /km</div>
        </div>
      </div>
    </div>;
  };

  const tree = <div style={{ display: "flex", flexDirection: "column", width: W, height: H, background: PAGE, padding: "250px 72px", justifyContent: "center" }}>
    {mark
      // 1200 × 514 artwork.
      // eslint-disable-next-line @next/next/no-img-element
      ? <img src={mark} alt="" width={Math.round((56 * 1200) / 514)} height={56} />
      : <div style={text(64, 700)}>pacr</div>}
    <div style={text(28, 700, MUTED, { marginTop: 40, letterSpacing: "0.1em" })}>MY RUNNING ZONES</div>
    <div style={text(88, 700, INK, { marginTop: 6, letterSpacing: "-0.02em", lineHeight: 1.05 })}>Find your real easy</div>
    <div style={text(30, 500, MUTED, { marginTop: 14 })}>{basis}</div>

    <div style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 40 }}>
      {row(r.zones[0])}
      {row(r.zones[1])}
      {row(r.zones[2])}
      {hmLine}
      {row(r.zones[3])}
      {row(r.zones[4])}
    </div>

    <div style={{ display: "flex", justifyContent: "center", marginTop: 40 }}>
      <div style={{ ...text(34, 700), padding: "22px 44px", borderRadius: 999, background: INK, color: WHITE }}>Find yours at pacr.life/zones</div>
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
