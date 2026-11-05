import { kitDashboards } from "@/examples/dashboard-kits/kits/cloud";
import { cloudError } from "@/shared/server/openui";
import { json, visitorOf } from "@/shared/server/visitor";

export const runtime = "nodejs";

const MAX_PROMPT_CHARS = 4_000;

// Changes one of the visitor's dashboards in place: OpenUI Cloud patches only
// what the request describes, and every renderer showing it switches to the
// new version when it's ready. Only the dashboard's owner can edit it.
export async function POST(request: Request, { params }: { params: Promise<{ kit: string }> }) {
  const { kit } = await params;
  const visitor = visitorOf(request);
  const body = (await request.json().catch(() => null)) as {
    id?: unknown;
    prompt?: unknown;
  } | null;
  const id = typeof body?.id === "string" ? body.id : "";
  const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";
  if (!id || !prompt || prompt.length > MAX_PROMPT_CHARS) {
    return json(visitor, { error: { code: "invalid_input" } }, { status: 400 });
  }
  const dashboards = kitDashboards(kit, prompt);
  if (!dashboards) return json(visitor, { error: { code: "unavailable" } }, { status: 404 });
  try {
    const response = await dashboards.edit(
      { id, prompt },
      { userId: visitor.id },
      { signal: request.signal },
    );
    return json(visitor, { response });
  } catch (error) {
    const { status, body: err } = cloudError(
      error,
      "The dashboard service couldn't make this change right now. Try again in a minute.",
    );
    return json(visitor, err, { status });
  }
}
