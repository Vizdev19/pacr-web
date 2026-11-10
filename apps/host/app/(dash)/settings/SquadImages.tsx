"use client";

// The squad's cover and photo at the top of Settings, editable as in the app's
// Manage screen: tap either to pick a picture, crop it, save; Remove clears it.
// Owners and organisers only (the club-avatars storage policies).

import { useRef, useState } from "react";
import { Avatar, Button, Dialog, Icon } from "@/components/ds";
import { removeSquadImage, signedUrls, uploadSquadImage, type SquadImage } from "@/lib/api";
import { useHost } from "@/lib/host";
import { ImageCropper } from "./ImageCropper";

export type Images = { photoPath: string | null; coverPath: string | null; photo?: string; cover?: string };

const MAX_BYTES = 25 * 1024 * 1024;
const TILE_CORNER = 18 / 56;
const LABEL: Record<SquadImage, string> = { photo: "Squad photo", cover: "Cover photo" };

export function SquadImages({ circleId, name, images, onChange }: {
  circleId: string; name: string; images: Images; onChange: (next: Images) => void;
}) {
  const { notify, notifyError, refreshHosts } = useHost();
  const input = useRef<HTMLInputElement>(null);
  const [kind, setKind] = useState<SquadImage>("photo");
  const [file, setFile] = useState<File | null>(null);
  const [confirm, setConfirm] = useState<SquadImage | null>(null);
  const [removing, setRemoving] = useState(false);

  const pathOf = (k: SquadImage) => (k === "photo" ? images.photoPath : images.coverPath);
  function pick(k: SquadImage) {
    setKind(k);
    if (input.current) { input.current.value = ""; input.current.click(); }
  }
  function chosen(f: File | undefined) {
    if (!f) return;
    if (!f.type.startsWith("image/")) { notify("warning", "That isn’t a picture", "Choose a JPEG, PNG or WebP."); return; }
    if (f.size > MAX_BYTES) { notify("warning", "That picture is too big", "Choose one under 25 MB."); return; }
    setFile(f);
  }

  async function save(jpeg: Blob) {
    try {
      const path = await uploadSquadImage(circleId, kind, jpeg, pathOf(kind));
      const url = (await signedUrls("club-avatars", [path])).get(path);
      onChange(kind === "photo" ? { ...images, photoPath: path, photo: url } : { ...images, coverPath: path, cover: url });
      setFile(null);
      notify("success", kind === "photo" ? "Photo updated" : "Cover updated", "Members see it next time they open the squad.");
      if (kind === "photo") refreshHosts();
    } catch (e) {
      notifyError(kind === "photo" ? "Couldn’t save the photo" : "Couldn’t save the cover", e);
      throw e;
    }
  }

  async function remove(k: SquadImage) {
    setRemoving(true);
    try {
      await removeSquadImage(circleId, k, pathOf(k));
      onChange(k === "photo" ? { ...images, photoPath: null, photo: undefined } : { ...images, coverPath: null, cover: undefined });
      setConfirm(null);
      notify("success", k === "photo" ? "Photo removed" : "Cover removed", k === "photo" ? "The squad shows its initials instead." : "The squad’s page shows the plain header.");
      if (k === "photo") refreshHosts();
    } catch (e) {
      notifyError(k === "photo" ? "Couldn’t remove the photo" : "Couldn’t remove the cover", e);
    } finally {
      setRemoving(false);
    }
  }

  const tileR = 72 * TILE_CORNER;
  return (
    <>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" hidden onChange={e => chosen(e.target.files?.[0])} />
      <div style={{ position: "relative", marginBottom: 34 }}>
        <button type="button" onClick={() => pick("cover")} aria-label={images.coverPath ? "Change cover photo" : "Add a cover photo"}
          style={{ display: "block", width: "100%", aspectRatio: "5 / 2", padding: 0, borderRadius: 12, border: "1px solid var(--border-default)", cursor: "pointer", overflow: "hidden",
            background: images.cover ? `url(${images.cover}) center/cover` : "var(--surface-locked)" }}>
          {!images.coverPath ? (
            <span style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6, height: "100%", font: "var(--type-caption)", color: "var(--text-muted)" }}>
              <Icon name="image-plus" size={20} color="var(--text-strong)" />Add a cover photo · 5:2
            </span>
          ) : null}
        </button>
        <div style={{ position: "absolute", right: 10, top: 10, display: "flex", gap: 6 }}>
          <Button size="sm" variant="secondary" icon="upload" onClick={() => pick("cover")}>{images.coverPath ? "Change cover" : "Add cover"}</Button>
          {images.coverPath ? <Button size="sm" variant="secondary" icon="trash-2" onClick={() => setConfirm("cover")} aria-label="Remove cover photo">Remove</Button> : null}
        </div>
        <button type="button" onClick={() => pick("photo")} aria-label={images.photoPath ? "Change squad photo" : "Add a squad photo"}
          style={{ position: "absolute", left: 18, bottom: -26, width: 78, height: 78, padding: 3, borderRadius: tileR + 3, background: "#fff", border: 0, boxShadow: "var(--shadow-sm)", cursor: "pointer" }}>
          <Avatar name={name} src={images.photo} size={72} style={{ borderRadius: tileR }} />
          <span style={{ position: "absolute", right: -4, bottom: -4, width: 26, height: 26, borderRadius: "50%", background: "var(--ink-900)", color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 0 2px #fff" }}>
            <Icon name="image-plus" size={13} strokeWidth={2} />
          </span>
        </button>
        {images.photoPath ? (
          <div style={{ position: "absolute", left: 108, bottom: -28 }}>
            <Button size="sm" variant="ghost" onClick={() => setConfirm("photo")}>Remove photo</Button>
          </div>
        ) : null}
      </div>

      <ImageCropper file={file} kind={kind} onCancel={() => setFile(null)} onSave={save} />

      <Dialog open={!!confirm} onClose={removing ? undefined : () => setConfirm(null)} icon="trash-2" tone="danger"
        title={`Remove the ${confirm === "photo" ? "squad photo" : "cover photo"}?`}
        description={confirm === "photo" ? "The squad shows its initials until you add another." : "The squad’s page shows the plain header until you add another."}
        footer={<>
          <Button variant="ghost" onClick={() => setConfirm(null)} disabled={removing}>Keep it</Button>
          <Button variant="danger" loading={removing} onClick={() => confirm && remove(confirm)}>Remove {confirm ? LABEL[confirm].toLowerCase() : ""}</Button>
        </>} />
    </>
  );
}
