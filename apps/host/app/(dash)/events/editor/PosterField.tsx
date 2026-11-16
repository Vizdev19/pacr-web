"use client";

// The event's poster: 2:3, cropped here with the squad pictures' cropper, and
// uploaded when the event is saved (its file lives in the event's own folder,
// which only exists once the event does).

import { useEffect, useRef, useState } from "react";
import { Button, Icon } from "@/components/ds";
import { kMuted } from "@/components/shell/kit";
import type { FormImage } from "@/lib/eventEditor";
import { ImageCropper } from "../../settings/ImageCropper";

const MAX_BYTES = 25 * 1024 * 1024;

export function PosterField({ cover, onChange, onRefuse }: {
  cover: FormImage | null;
  onChange: (next: FormImage | null) => void;
  onRefuse: (title: string, body: string) => void;
}) {
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
    <div style={{ flex: "none", width: 150, display: "flex", flexDirection: "column", gap: 8 }}>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={e => chosen(e.target.files?.[0])} />
      <button type="button" onClick={pick} aria-label={cover ? "Change the event poster" : "Add an event poster"}
        style={{ width: 150, aspectRatio: "2 / 3", padding: 0, borderRadius: 10, border: "1px solid var(--border-default)", cursor: "pointer", overflow: "hidden",
          background: cover?.url ? `url(${cover.url}) center/cover` : "var(--surface-locked)" }}>
        {!cover?.url ? (
          <span style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6, height: "100%", ...kMuted }}>
            <Icon name="image-plus" size={20} color="var(--text-strong)" />{cover ? "Poster" : "Add a poster · 2:3"}
          </span>
        ) : null}
      </button>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <Button size="sm" variant="secondary" icon="upload" onClick={pick}>{cover ? "Change" : "Add"}</Button>
        {cover ? <Button size="sm" variant="ghost" onClick={() => onChange(null)} aria-label="Remove the poster">Remove</Button> : null}
      </div>
      <ImageCropper file={file} kind="poster" onCancel={() => setFile(null)}
        onSave={async jpeg => { onChange({ path: null, url: URL.createObjectURL(jpeg), blob: jpeg }); setFile(null); }} />
    </div>
  );
}
