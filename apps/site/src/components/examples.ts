/** Where the showcase's code lives. */
export const REPO_URL = "https://github.com/subham8391/openui-showcase";

/** One example featured on the landing page. Add an entry here when a new example gets its page. */
export type Example = {
  href: string;
  name: string;
  summary: string;
  /** Short facts shown under the summary. */
  meta: string;
  /** An SVG path in a 24x24 box, drawn as a stroke. */
  icon: string;
};

export const EXAMPLES: Example[] = [
  {
    href: "/dashboard-kits",
    name: "Dashboard kits",
    summary:
      "Domain components, data tools, rules, and worked examples a model composes into e-commerce and product analytics dashboards.",
    meta: "2 kits · gallery, generate, and prompt views",
    icon: "M4 4h7v9H4zM13 4h7v5h-7zM4 15h7v5H4zM13 11h7v9h-7z",
  },
];
