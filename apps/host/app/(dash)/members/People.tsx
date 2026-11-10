"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Tabs } from "@/components/ds";
import { listBans, signedUrls } from "@/lib/api";
import { useHost } from "@/lib/host";
import { useLoad } from "@/lib/hooks";
import MembersTab from "./MembersTab";
import RequestsTab from "./RequestsTab";
import BannedTab from "./BannedTab";

export default function People({ page }: { page: "members" | "requests" }) {
  const { host } = useHost();
  if (host.kind !== "squad") return null;
  return <Inner page={page} />;
}

function Inner({ page }: { page: "members" | "requests" }) {
  const { host, counts } = useHost();
  const router = useRouter();
  const sp = useSearchParams();
  const tab = page === "requests" ? "requests" : sp.get("tab") === "banned" ? "banned" : "members";
  const bans = useLoad(async () => {
    const list = await listBans(host.id);
    const urls = await signedUrls("avatars", list.map(b => b.avatar_path));
    return { list, urls, now: Date.now() };
  }, `bans:${host.key}`);

  return (
    <div>
      <Tabs
        value={tab}
        onChange={v => router.push(v === "requests" ? "/requests" : v === "banned" ? "/members?tab=banned" : "/members")}
        style={{ marginBottom: 14 }}
        tabs={[
          { value: "members", label: "Members", count: host.members },
          { value: "requests", label: "Join requests", count: counts.requests },
          { value: "banned", label: "Banned", count: bans.status === "ready" ? bans.data.list.length : undefined },
        ]}
      />
      {tab === "requests" ? <RequestsTab /> : tab === "banned" ? <BannedTab bans={bans} /> : <MembersTab />}
    </div>
  );
}
