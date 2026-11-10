"use client";

import { useState } from "react";
import { Avatar, Button, DataTable, EmptyState, GlassCard } from "@/components/ds";
import { unbanMember, type Ban } from "@/lib/api";
import { day } from "@/lib/format";
import { useHost } from "@/lib/host";
import type { useLoad } from "@/lib/hooks";
import { LoadError, RowsSkeleton } from "@/components/shell/kit";

type Data = { list: Ban[]; urls: Map<string, string>; now: number };

export default function BannedTab({ bans }: { bans: ReturnType<typeof useLoad<Data>> }) {
  const { host, notify, notifyError } = useHost();
  const [busy, setBusy] = useState<string | null>(null);

  if (bans.status === "loading") return <RowsSkeleton rows={4} />;
  if (bans.status === "error") return <LoadError what="the banned list" error={bans.error} onRetry={bans.reload} />;
  const { list, urls } = bans.data;
  if (!list.length) return <EmptyState icon="ban" title="Nobody is banned" message="People you ban from the members list show up here, and you can lift a ban any time." />;

  const unban = async (b: Ban) => {
    setBusy(b.user_id);
    try {
      await unbanMember(host.id, b.user_id);
      notify("success", "Unbanned", `${b.display_name ?? "They"} can ask to join again.`);
      bans.set(d => ({ ...d, list: d.list.filter(x => x.user_id !== b.user_id) }));
    } catch (e) {
      notifyError("Couldn’t unban", e);
    } finally {
      setBusy(null);
    }
  };

  return (
    <GlassCard flush>
      <DataTable
        rows={list}
        rowKey="user_id"
        columns={[
          { key: "name", header: "Runner", render: b => (
            <span style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <Avatar name={b.display_name ?? "Runner"} src={(b.avatar_path && urls.get(b.avatar_path)) || undefined} size={28} />{b.display_name ?? "Runner"}
            </span>
          ) },
          { key: "when", header: "Banned", render: b => day(b.created_at, new Date(bans.data.now)) },
          { key: "x", header: "", align: "right", render: b => <Button size="sm" variant="secondary" loading={busy === b.user_id} onClick={() => unban(b)}>Unban</Button> },
        ]}
      />
    </GlassCard>
  );
}
