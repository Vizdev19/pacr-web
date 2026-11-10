"use client";

// Crop a picture to the squad's photo or cover, like the app's AvatarEditor:
// a fixed frame (a rounded square for the photo, 5:2 for the cover), drag to
// choose what shows, zoom with the slider or the wheel, turn it a quarter at a
// time. The picture always covers the frame. Saved as JPEG at 0.85 and the
// app's sizes (512 × 512, 1500 × 600).

import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type WheelEvent } from "react";
import { Button, Dialog, Icon, IconButton } from "@/components/ds";
import { kMuted } from "@/components/shell/kit";
import { SQUAD_IMAGE, type SquadImage } from "@/lib/api";

// The app's SquadTile corner: 18 on a 56 tile.
const TILE_CORNER = 18 / 56;
const MAX_ZOOM = 4;

type View = { zoom: number; x: number; y: number; turns: number };

/** The picture's size once turned: a quarter turn swaps width and height. */
const turned = (img: HTMLImageElement, turns: number) =>
  turns % 2 ? { w: img.naturalHeight, h: img.naturalWidth } : { w: img.naturalWidth, h: img.naturalHeight };

export function ImageCropper({ file, kind, onCancel, onSave }: {
  /** The chosen file; the dialog is open while there is one. */
  file: File | null;
  kind: SquadImage;
  onCancel: () => void;
  /** Gets the cropped JPEG; resolve when saved, throw to stay open. */
  onSave: (jpeg: Blob) => Promise<void>;
}) {
  const spec = SQUAD_IMAGE[kind];
  const [img, setImg] = useState<{ file: File; el: HTMLImageElement; url: string } | null>(null);
  const [failed, setFailed] = useState<File | null>(null);
  const [view, setView] = useState<View>({ zoom: 1, x: 0, y: 0, turns: 0 });
  const [saving, setSaving] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [frameW, setFrameW] = useState(0);
  const frameRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: number; sx: number; sy: number; x: number; y: number } | null>(null);

  // Decode the chosen file. State is set from the load callbacks only.
  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    const el = new Image();
    el.onload = () => { setImg({ file, el, url }); setView({ zoom: 1, x: 0, y: 0, turns: 0 }); };
    el.onerror = () => { setFailed(file); URL.revokeObjectURL(url); };
    el.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // The frame fills the dialog's width; measured after layout and on resize.
  useEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setFrameW(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, [img]);

  const ready = img && img.file === file ? img : null;
  const fw = frameW, fh = frameW / spec.aspect;

  /** Scale at zoom 1: the picture just covers the frame. */
  const baseScale = useCallback((turns: number) => {
    if (!ready || !fw) return 1;
    const { w, h } = turned(ready.el, turns);
    return Math.max(fw / w, fh / h);
  }, [ready, fw, fh]);

  /** Keep the frame covered: x, y are the picture's centre offset from the frame's centre. */
  const clamp = useCallback((v: View): View => {
    if (!ready || !fw) return v;
    const zoom = Math.min(MAX_ZOOM, Math.max(1, v.zoom));
    const s = baseScale(v.turns) * zoom;
    const { w, h } = turned(ready.el, v.turns);
    const mx = Math.max(0, (w * s - fw) / 2), my = Math.max(0, (h * s - fh) / 2);
    return { ...v, zoom, x: Math.min(mx, Math.max(-mx, v.x)), y: Math.min(my, Math.max(-my, v.y)) };
  }, [ready, fw, fh, baseScale]);

  const v = clamp(view);
  const scale = baseScale(v.turns) * v.zoom;
  const update = (next: Partial<View>) => setView(cur => clamp({ ...clamp(cur), ...next }));

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { id: e.pointerId, sx: e.clientX, sy: e.clientY, x: v.x, y: v.y };
    setDragging(true);
  }
  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    update({ x: d.x + e.clientX - d.sx, y: d.y + e.clientY - d.sy });
  }
  const onPointerUp = () => { drag.current = null; setDragging(false); };
  function onWheel(e: WheelEvent<HTMLDivElement>) {
    update({ zoom: v.zoom * (e.deltaY < 0 ? 1.08 : 1 / 1.08) });
  }
  function onKey(e: KeyboardEvent<HTMLDivElement>) {
    const step = e.shiftKey ? 40 : 10;
    const moves: Record<string, Partial<View>> = {
      ArrowLeft: { x: v.x + step }, ArrowRight: { x: v.x - step }, ArrowUp: { y: v.y + step }, ArrowDown: { y: v.y - step },
      "+": { zoom: v.zoom * 1.1 }, "=": { zoom: v.zoom * 1.1 }, "-": { zoom: v.zoom / 1.1 },
    };
    if (moves[e.key]) { e.preventDefault(); update(moves[e.key]); }
  }

  async function save() {
    if (!ready || !fw) return;
    const { width: ow, height: oh } = spec.out;
    const canvas = document.createElement("canvas");
    canvas.width = ow;
    canvas.height = oh;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    // Draw the frame's view at the output size: same transform, scaled by ow / fw.
    const k = ow / fw;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, ow, oh);
    ctx.imageSmoothingQuality = "high";
    ctx.translate(ow / 2 + v.x * k, oh / 2 + v.y * k);
    ctx.rotate((v.turns * Math.PI) / 2);
    const s = scale * k;
    ctx.drawImage(ready.el, (-ready.el.naturalWidth * s) / 2, (-ready.el.naturalHeight * s) / 2, ready.el.naturalWidth * s, ready.el.naturalHeight * s);
    const jpeg = await new Promise<Blob | null>(res => canvas.toBlob(res, "image/jpeg", 0.85));
    if (!jpeg) return;
    setSaving(true);
    try {
      await onSave(jpeg);
    } catch {
      /* the page shows the error; the dialog stays open to try again */
    } finally {
      setSaving(false);
    }
  }

  const title = kind === "photo" ? "Squad photo" : "Cover photo";
  const corner = kind === "photo" ? fw * TILE_CORNER : Math.min(fw, fh) * (24 / 140);
  const bad = failed && failed === file;
  return (
    <Dialog open={!!file} onClose={saving ? undefined : onCancel} icon={kind === "photo" ? "image" : "image-plus"} title={title}
      description={kind === "photo" ? "Shown on the squad’s page, in search and next to its runs." : "The wide picture across the top of the squad’s page."}
      width={kind === "photo" ? 460 : 640}
      footer={
        <>
          <Button variant="ghost" onClick={onCancel} disabled={saving}>Cancel</Button>
          <Button icon="check" onClick={save} loading={saving} disabled={!ready || !fw || !!bad}>Save {kind === "photo" ? "photo" : "cover"}</Button>
        </>
      }>
      {bad ? (
        <div style={{ ...kMuted, padding: "24px 0" }}>Couldn’t open that picture. Try a JPEG or PNG.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div ref={frameRef} role="application" aria-label="Crop area: drag or use the arrow keys to move the picture, + and − to zoom" tabIndex={0}
            onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp} onWheel={onWheel} onKeyDown={onKey}
            style={{ position: "relative", width: "100%", aspectRatio: String(spec.aspect), overflow: "hidden", borderRadius: 12, background: "var(--surface-locked)",
              cursor: ready ? (dragging ? "grabbing" : "grab") : "default", touchAction: "none", userSelect: "none", outline: "none" }}>
            {ready && fw ? (
              // eslint-disable-next-line @next/next/no-img-element -- a local blob being cropped, not a page image
              <img src={ready.url} alt="" draggable={false}
                style={{ position: "absolute", left: "50%", top: "50%", width: ready.el.naturalWidth * scale, height: ready.el.naturalHeight * scale, maxWidth: "none",
                  transform: `translate(-50%, -50%) translate(${v.x}px, ${v.y}px) rotate(${v.turns * 90}deg)`, pointerEvents: "none" }} />
            ) : (
              <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", ...kMuted }}>Opening the picture…</div>
            )}
            {kind === "photo" && fw ? (
              // The tile's shape, washed outside it, as in the app's guide.
              <svg width={fw} height={fh} style={{ position: "absolute", inset: 0, pointerEvents: "none" }} aria-hidden>
                <path fillRule="evenodd" fill="rgba(20,20,20,.38)"
                  d={`M0 0H${fw}V${fh}H0Z M${corner} 0H${fw - corner}A${corner} ${corner} 0 0 1 ${fw} ${corner}V${fh - corner}A${corner} ${corner} 0 0 1 ${fw - corner} ${fh}H${corner}A${corner} ${corner} 0 0 1 0 ${fh - corner}V${corner}A${corner} ${corner} 0 0 1 ${corner} 0Z`} />
              </svg>
            ) : null}
            <div style={{ position: "absolute", inset: 0, borderRadius: corner, boxShadow: "inset 0 0 0 1.5px rgba(255,255,255,.9)", pointerEvents: "none" }} />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Icon name="minus" size={15} color="var(--text-muted)" />
            <input type="range" min={1} max={MAX_ZOOM} step={0.01} value={v.zoom} aria-label="Zoom" disabled={!ready}
              onChange={e => update({ zoom: Number(e.target.value) })} style={{ flex: 1, accentColor: "var(--ink-900)" }} />
            <Icon name="plus" size={15} color="var(--text-muted)" />
            <IconButton icon="rotate-cw" label="Turn a quarter" variant="secondary" size="sm" disabled={!ready}
              onClick={() => update({ turns: (v.turns + 1) % 4, x: 0, y: 0, zoom: 1 })} />
          </div>
          <div style={kMuted}>Drag to choose what shows. Saved at {spec.out.width} × {spec.out.height}.</div>
        </div>
      )}
    </Dialog>
  );
}
