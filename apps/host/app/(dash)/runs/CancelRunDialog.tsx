"use client";

import { useState } from "react";
import { Button, Dialog } from "@/components/ds";
import * as api from "@/lib/api";
import { useHost } from "@/lib/host";

/** The confirm every "Cancel run" goes through (runs page and calendar). */
export function CancelRunDialog({ run, onClose, onCancelled }: {
  run: { id: string; title: string; repeat_weekly: boolean } | null;
  onClose: () => void;
  onCancelled: () => void;
}) {
  const { notify, notifyError } = useHost();
  const [busy, setBusy] = useState(false);
  if (!run) return null;
  const go = async () => {
    setBusy(true);
    try {
      await api.cancelRun(run.id);
      notify("success", "Run cancelled", `${run.title}: everyone going has been told.`);
      onCancelled();
    } catch (e) {
      notifyError("Couldn’t cancel the run", e);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open onClose={busy ? undefined : onClose} icon="ban" tone="danger" title={`Cancel ${run.title}?`}
      description={`Everyone going gets a push that it’s off.${run.repeat_weekly ? " It repeats every week, so it stops repeating too." : ""} This can’t be undone.`}
      footer={<>
        <Button variant="ghost" onClick={onClose} disabled={busy}>Keep run</Button>
        <Button variant="danger" loading={busy} onClick={go}>Cancel run</Button>
      </>} />
  );
}
