import "@openuidev/react-ui/components.css";
import "@openuidev/thesys/styles.css";
import type { Metadata } from "next";
import { Inter } from "next/font/google";

// The kit styles override the base styles above, so they load after them.
import "@/examples/dashboard-kits/theme/index.scss";
import "./globals.css";

// OpenUI's typeface. The ThemeProvider's font tokens point at this variable
// (see kit-workspace.tsx), since next/font serves Inter under its own name.
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  title: { default: "OpenUI showcase", template: "%s | OpenUI showcase" },
  description: "Examples built with OpenUI, starting with dashboard kits.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body>{children}</body>
    </html>
  );
}
