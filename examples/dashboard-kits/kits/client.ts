"use client";

import type { Library } from "@openuidev/react-lang";
import { analyticsLibrary, ecommerceLibrary } from "./libraries";

export { createToolProvider } from "../engine/tool-provider";
export type { ToolCall } from "../engine/tool-provider";

export const KIT_LIBRARIES: Record<string, Library> = {
  ecommerce: ecommerceLibrary,
  analytics: analyticsLibrary,
};
