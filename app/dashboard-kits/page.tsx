import { KitWorkspace } from "@/examples/dashboard-kits/views/workspace";
import { cloudBaseUrl } from "@/shared/server/openui";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dashboard kits",
  description:
    "E-commerce and product analytics kits for the OpenUI dashboard artifact: components, data tools, rules, and examples.",
};

export default function Page() {
  // The browser reads and streams the visitor's dashboards from OpenUI Cloud
  // directly, with their frontend token; it needs the origin (not a secret).
  return <KitWorkspace cloudUrl={cloudBaseUrl()} />;
}
