// Server-safe entry: kit definitions (prompt, rules, gallery dashboards), tool
// contracts, sample-data handlers, and prompt assembly. Nothing here imports
// React, so a route handler can use it directly.

import type { KitDefinition } from "../engine/kit";
import type { ToolHandler } from "../engine/prompt";
import { analyticsHandlers } from "./analytics/data";
import { analyticsKit } from "./analytics/kit";
import { ecommerceHandlers } from "./ecommerce/data";
import { ecommerceKit } from "./ecommerce/kit";

export {
  BASE_COMPONENT_GROUPS,
  BASE_RULES,
  COMPOSITION_RULES,
  DATA_RULES,
} from "../engine/base-prompt";
export { defineTool, toToolSpec } from "../engine/kit";
export type { GalleryDashboard, KitDefinition, KitTool } from "../engine/kit";
export { buildSystemPrompt, PROMPT_BUDGET, rankGallery, runTool } from "../engine/prompt";
export type { PromptOptions, ToolHandler } from "../engine/prompt";
export * from "../engine/schemas";
export { analyticsTools } from "./analytics/tools";
export { ecommerceTools } from "./ecommerce/tools";
export { analyticsHandlers, analyticsKit, ecommerceHandlers, ecommerceKit };

/** Every kit, in display order. */
export const KITS: KitDefinition[] = [ecommerceKit, analyticsKit];

/** Sample-data tool handlers for each kit: Sundial Goods and Relay. */
export const SAMPLE_HANDLERS: Record<string, Record<string, ToolHandler>> = {
  ecommerce: ecommerceHandlers,
  analytics: analyticsHandlers,
};

export function getKit(id: string): KitDefinition | undefined {
  return KITS.find((kit) => kit.id === id);
}
