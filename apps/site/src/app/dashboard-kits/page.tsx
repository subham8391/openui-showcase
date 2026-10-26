import type { Metadata } from "next";
import { KitWorkspace } from "./_views/workspace";

export const metadata: Metadata = {
  title: "Dashboard kits",
  description:
    "E-commerce and product analytics kits for the OpenUI dashboard artifact: components, data tools, rules, and examples.",
};

export default function Page() {
  return <KitWorkspace />;
}
