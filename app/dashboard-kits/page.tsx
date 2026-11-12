import { KitWorkspace } from "@/examples/dashboard-kits/views/workspace";
import { cloudAvailable, cloudBaseUrl } from "@/shared/server/openui";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dashboard kits",
  description:
    "E-commerce and product analytics kits for the OpenUI dashboard artifact: components, data tools, rules, and examples.",
};

// Read the environment per request, so adding or removing the key takes
// effect without a rebuild.
export const dynamic = "force-dynamic";

export default function Page() {
  // The browser reads and streams the visitor's dashboards from OpenUI Cloud
  // directly, with their frontend token; it needs the origin (not a secret).
  // Without a key, Generate and dig-in are paused.
  return <KitWorkspace cloudUrl={cloudBaseUrl()} canGenerate={cloudAvailable()} />;
}
