"use client";

// The event's poster (2:3) or its course map (16:9): cropped here with the
// squad pictures' cropper, and uploaded when the event is saved (its file lives
// in the event's own folder, which only exists once the event does).

import { useEffect, useRef, useState } from "react";
import { Button, Icon } from "@/components/ds";
import { kMuted } from "@/components/shell/kit";
import type { FormImage } from "@/lib/eventEditor";
import { ImageCropper } from "../../settings/ImageCropper";

const MAX_BYTES = 25 * 1024 * 1024;

const KIND = {
  poster: { w: 150, ratio: "2 / 3", empty: "Add a poster · 2:3", noun: "the event poster" },
  course: { w: 320, ratio: "16 / 9", empty: "Add a course map · 16:9", noun: "the course map" },
} as const;

export function PosterField({ cover, onChange, onRefuse, kind = "poster" }: {
  kind?: keyof typeof KIND;
  cover: FormImage | null;
  onChange: (next: FormImage | null) => void;
  onRefuse: (title: string, body: string) => void;
}) {
  const k = KIND[kind];
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  // A cropped poster not saved yet is shown from an object URL, let go when it is replaced or the page closes.
  const blobUrl = cover?.url?.startsWith("blob:") ? cover.url : null;
  useEffect(() => () => { if (blobUrl) URL.revokeObjectURL(blobUrl); }, [blobUrl]);

  const pick = () => { if (input.current) { input.current.value = ""; input.current.click(); } };
  const chosen = (f: File | undefined) => {
    if (!f) return;
    if (!f.type.startsWith("image/")) { onRefuse("That isn’t a picture", "Choose a JPEG, PNG or WebP."); return; }
    if (f.size > MAX_BYTES) { onRefuse("That picture is too big", "Choose one under 25 MB."); return; }
    setFile(f);
  };

  return (
    <div style={{ flex: "none", width: `min(100%, ${k.w}px)`, display: "flex", flexDirection: "column", gap: 8 }}>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={e => chosen(e.target.files?.[0])} />
      <button type="button" onClick={pick} aria-label={cover ? `Change ${k.noun}` : `Add ${k.noun}`}
        style={{ width: "100%", aspectRatio: k.ratio, padding: 0, borderRadius: 10, border: "1px solid var(--border-default)", cursor: "pointer", overflow: "hidden",
          background: cover?.url ? `url(${cover.url}) center/cover` : "var(--surface-locked)" }}>
        {!cover?.url ? (
          <span style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6, height: "100%", ...kMuted }}>
            <Icon name="image-plus" size={20} color="var(--text-strong)" />{cover ? "Picture" : k.empty}
          </span>
        ) : null}
      </button>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <Button size="sm" variant="secondary" icon="upload" onClick={pick}>{cover ? "Change" : "Add"}</Button>
        {cover ? <Button size="sm" variant="ghost" onClick={() => onChange(null)} aria-label={`Remove ${k.noun}`}>Remove</Button> : null}
      </div>
      <ImageCropper file={file} kind={kind} onCancel={() => setFile(null)}
        onSave={async jpeg => { onChange({ path: null, url: URL.createObjectURL(jpeg), blob: jpeg }); setFile(null); }} />
    </div>
  );
}
