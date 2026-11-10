import { Suspense } from "react";
import { AppShell } from "@/components/shell/AppShell";
import { HostProvider } from "@/lib/host";

// Every page here is the signed-in host's own data, fetched in the browser
// with their session (lib/api.ts), so the pages themselves are static shells.
export default function DashLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <HostProvider>
      <AppShell>
        {/* Pages read ?run=, ?event= and ?q= with useSearchParams, which needs a Suspense boundary. */}
        <Suspense>{children}</Suspense>
      </AppShell>
    </HostProvider>
  );
}
