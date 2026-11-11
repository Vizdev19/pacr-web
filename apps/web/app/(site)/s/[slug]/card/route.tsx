// /s/<slug>/card: the squad's 1200 × 630 link preview (squad.mjs's cardImage),
// in the web design's look. Previews show a 1.91:1 picture: a 5:2 cover used
// as og:image loses its sides and a square photo its top and bottom, so the
// card is drawn instead. With a cover: the cover whole across the top
// (1200 × 480 is exactly 5:2, nothing over it), the tile, name and the pacr
// wordmark in the white band below. With only a photo: the photo large beside
// the name. A squad with neither has no card; the page then uses the site's
// own og-image.
//
// Lexend from Google Fonts (TTF: the renderer can't read WOFF2), fetched once
// per instance; the renderer's own face if that fails.
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { anonClient, cleanSlug, fetchClub, initialsOf, notFoundText, pictureBytes, plural } from "@/lib/squad";

export const dynamic = "force-dynamic";

const W = 1200, H = 630;
// The design system's ink, muted text and lime (design-system/tokens/colors.css).
const INK = "#111111", MUTED = "#5E5E5E", LIME = "#E4F46A", WHITE = "#FFFFFF";

type Font = { name: string; data: ArrayBuffer; weight: 500 | 700; style: "normal" };
let fontsPromise: Promise<Font[]> | null = null;
async function googleFont(weight: 500 | 700): Promise<Font> {
  const css = await fetch(`https://fonts.googleapis.com/css2?family=Lexend:wght@${weight}`, { headers: { "User-Agent": "Mozilla/4.0" } })
    .then(r => (r.ok ? r.text() : ""));
  const url = /src:\s*url\(([^)]+)\)/.exec(css)?.[1];
  if (!url) throw new Error(`no Lexend ${weight}`);
  return { name: "Lexend", weight, style: "normal", data: await fetch(url).then(r => r.arrayBuffer()) };
}
function cardFonts(): Promise<Font[]> {
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

const dataUri = (f: { bytes: ArrayBuffer; type: string }) => `data:${f.type};base64,${Buffer.from(f.bytes).toString("base64")}`;

export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const slug = cleanSlug((await params).slug);
  if (!slug) return notFoundText("No card");
  try {
    const club = await fetchClub(anonClient(), slug);
    if (!club || !(club.cover_path || club.avatar_path)) return notFoundText("No card");
    const [cover, tile, fonts, mark] = await Promise.all([
      pictureBytes(club.cover_path).catch(() => null),
      pictureBytes(club.avatar_path).catch(() => null),
      cardFonts().catch(() => null),
      wordmark(req.url),
    ]);
    if (!cover && !tile) return notFoundText("No card");

    const name = club.name || "A squad";
    const meta = [plural(Number(club.member_count) || 0, "member"), club.location?.trim()].filter(Boolean).join(" · ");
    const font = fonts ? "Lexend" : undefined;

    const tileBox = (size: number, radius: number, ring = 0) => (
      <div style={{ display: "flex", width: size, height: size, borderRadius: radius, overflow: "hidden", flexShrink: 0, alignItems: "center", justifyContent: "center", background: tile ? WHITE : LIME, ...(ring ? { border: `${ring}px solid ${WHITE}` } : {}) }}>
        {tile
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={dataUri(tile)} alt="" width={size - 2 * ring} height={size - 2 * ring} style={{ objectFit: "cover" }} />
          : <div style={{ display: "flex", fontFamily: font, fontWeight: 700, fontSize: Math.round(size * 0.36), color: INK }}>{initialsOf(name)}</div>}
      </div>
    );
    const logo = (h: number) => mark
      // 1200 × 514 artwork.
      // eslint-disable-next-line @next/next/no-img-element
      ? <img src={mark} alt="" width={Math.round((h * 1200) / 514)} height={h} />
      : <div style={{ display: "flex", fontFamily: font, fontWeight: 700, fontSize: h * 0.8, color: INK }}>pacr</div>;
    const nameLine = (size: number, lines: number) => (
      <div style={{
        display: "flex", fontFamily: font, fontWeight: 700, fontSize: size, lineHeight: 1.08, color: INK, letterSpacing: "-0.02em",
        overflow: "hidden", maxHeight: Math.ceil(size * 1.08 * lines) + 2,
        ...(lines === 1 ? { whiteSpace: "nowrap", textOverflow: "ellipsis" } : { lineClamp: lines }),
      }}>{name}</div>
    );
    const metaLine = <div style={{ display: "flex", fontFamily: font, fontWeight: 500, fontSize: 26, color: MUTED, marginTop: 10, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{meta}</div>;

    const tree = cover
      ? <div style={{ display: "flex", flexDirection: "column", width: W, height: H, background: WHITE }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={dataUri(cover)} alt="" width={W} height={480} style={{ objectFit: "cover" }} />
        <div style={{ display: "flex", height: 8, background: LIME }} />
        <div style={{ display: "flex", flex: 1, alignItems: "center", gap: 28, padding: "0 48px" }}>
          {tileBox(104, 30)}
          <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0 }}>{nameLine(44, 1)}{metaLine}</div>
          {logo(44)}
        </div>
      </div>
      : <div style={{ display: "flex", width: W, height: H, alignItems: "center", gap: 64, padding: "0 80px", background: WHITE }}>
        {tileBox(380, 96)}
        <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0, gap: 8 }}>
          <div style={{ display: "flex" }}>
            <div style={{ display: "flex", padding: "8px 20px", borderRadius: 999, background: LIME, fontFamily: font, fontWeight: 700, fontSize: 22, color: INK }}>A squad on pacr</div>
          </div>
          <div style={{ display: "flex", marginTop: 14 }}>{nameLine(72, 3)}</div>
          {metaLine}
          <div style={{ display: "flex", marginTop: 40 }}>{logo(52)}</div>
        </div>
      </div>;

    const png = await new ImageResponse(tree, { width: W, height: H, ...(fonts ? { fonts } : {}) }).arrayBuffer();
    // The page links this with ?v= of what's drawn on it, so a change is a new address.
    return new Response(png, { status: 200, headers: { "Content-Type": "image/png", "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800" } });
  } catch (e) {
    console.error("[squad card]", e);
    return notFoundText("No card");
  }
}
