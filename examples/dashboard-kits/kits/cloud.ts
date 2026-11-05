// The kits on OpenUI Dashboards: each kit's library, tools, rules and gallery
// examples become an OpenUI `defineDashboard`, so OpenUI Cloud builds, saves,
// edits and runs the dashboards. Server only.
import { dashboardModel, openuiClient } from "@/shared/server/openui";
import type { Dashboard, DataTool } from "@openuidev/server";
import "server-only";
import {
  BASE_RULES,
  COMPOSITION_RULES,
  DATA_RULES,
  getKit,
  rankGallery,
  toToolSpec,
  type GalleryDashboard,
  type KitDefinition,
} from "./registry";
import { getKitSpec, runTool } from "./server";

/** Each kit is its own OpenUI app, so a visitor's dashboards stay with their kit. */
export function kitApp(kitId: string): string {
  return `showcase-${kitId}`;
}

/** The most gallery dashboards a question carries as examples. */
const MAX_EXAMPLES = 3;

/**
 * A value cut down to show its shape: every list keeps its first two items.
 * The model reads a tool's example output to bind components to its fields;
 * whole lists would only make the prompt longer.
 */
function shapeOf(value: unknown): unknown {
  if (Array.isArray(value)) return value.slice(0, 2).map(shapeOf);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, shapeOf(v)]));
  }
  return value;
}

const toolCache = new Map<string, Record<string, DataTool>>();

/**
 * A kit's tools as OpenUI data tools: their description and arguments, an
 * example output from the sample data (run once with no arguments), and the
 * sample-data handler. Arguments a model wrote loosely are repaired by
 * `runTool` before validation.
 */
export function kitDataTools(kit: KitDefinition): Record<string, DataTool> {
  let tools = toolCache.get(kit.id);
  if (!tools) {
    tools = Object.fromEntries(
      kit.tools.map((tool) => {
        const spec = toToolSpec(tool);
        return [
          tool.name,
          {
            description: tool.description,
            parameters: spec.inputSchema,
            output: shapeOf(runTool(kit.id, tool.name, {})),
            execute: async (args: unknown) => runTool(kit.id, tool.name, withoutUnset(args)),
          } satisfies DataTool,
        ];
      }),
    );
    toolCache.set(kit.id, tools);
  }
  return tools;
}

/** A filter nobody picked arrives as "" or null: treat it as unset. */
function withoutUnset(args: unknown): unknown {
  if (!args || typeof args !== "object" || Array.isArray(args)) return args;
  return Object.fromEntries(
    Object.entries(args as Record<string, unknown>).filter(([, v]) => v !== "" && v != null),
  );
}

/** The gallery dashboards that best show how to answer `question`, or the kit's defaults. */
function examplesFor(kit: KitDefinition, question?: string): GalleryDashboard[] {
  const ranked = question?.trim() ? rankGallery(kit, question) : [];
  const picked = ranked.slice(0, MAX_EXAMPLES).map((r) => r.dashboard);
  return picked.length ? picked : kit.gallery.filter((d) => d.example !== false);
}

/**
 * The kit's dashboards on OpenUI Cloud. With a question, the gallery
 * dashboards closest to it are the examples (a definition is a plain object,
 * so one per request costs nothing). Null when the kit or the key is missing.
 */
export function kitDashboards(kitId: string, question?: string): Dashboard | null {
  const kit = getKit(kitId);
  const openui = openuiClient(kitApp(kitId));
  if (!kit || !openui) return null;
  return openui.defineDashboard({
    library: getKitSpec(kit.id),
    model: dashboardModel(),
    tools: kitDataTools(kit),
    promptOptions: {
      preamble: kit.preamble,
      additionalRules: [...BASE_RULES, ...DATA_RULES, ...COMPOSITION_RULES, ...kit.rules],
      examples: examplesFor(kit, question).map((d) => d.program),
    },
  });
}
