import { kitDashboards } from "@/examples/dashboard-kits/kits/cloud";
import { cloudError } from "@/shared/server/openui";
import { json, visitorOf } from "@/shared/server/visitor";

export const runtime = "nodejs";

/** Longest prompt accepted; a dashboard request is a sentence or two. */
const MAX_PROMPT_CHARS = 4_000;

/** A short title from the request, until the model names the dashboard. */
function titleFrom(prompt: string): string {
  const line = prompt.trim().split("\n")[0]!.replace(/\s+/g, " ");
  return line.length > 60 ? `${line.slice(0, 57).replace(/\s+\S*$/, "")}…` : line;
}

// Starts a dashboard for the visitor: OpenUI Cloud builds it in the
// background from the kit's library, tools and the examples closest to the
// request, and saves it under the visitor's id. Answers at once with the
// response the renderer streams it from.
export async function POST(request: Request, { params }: { params: Promise<{ kit: string }> }) {
  const { kit } = await params;
  const visitor = visitorOf(request);
  const body = (await request.json().catch(() => null)) as { prompt?: unknown } | null;
  const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";
  if (!prompt) return json(visitor, { error: { code: "invalid_input" } }, { status: 400 });
  if (prompt.length > MAX_PROMPT_CHARS) {
    return json(
      visitor,
      {
        error: {
          code: "invalid_input",
          message: `Keep the prompt to ${MAX_PROMPT_CHARS} characters or fewer.`,
        },
      },
      { status: 413 },
    );
  }
  const dashboards = kitDashboards(kit, prompt);
  if (!dashboards) return json(visitor, { error: { code: "unavailable" } }, { status: 404 });
  try {
    const response = await dashboards.create(
      { title: titleFrom(prompt), prompt },
      { userId: visitor.id },
      { signal: request.signal },
    );
    return json(visitor, { response });
  } catch (error) {
    const { status, body: err } = cloudError(
      error,
      "The dashboard service couldn't take this request right now. Try again in a minute.",
    );
    return json(visitor, err, { status });
  }
}
