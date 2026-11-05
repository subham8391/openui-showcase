import { kitDashboards } from "@/examples/dashboard-kits/kits/cloud";
import { cloudError } from "@/shared/server/openui";
import { json, visitorOf } from "@/shared/server/visitor";

export const runtime = "nodejs";

// Runs a dashboard's queries for its owner: a kit tool on its sample data, or
// a script OpenUI generated, run in OpenUI's interpreter, calling the tools.
export async function POST(request: Request, { params }: { params: Promise<{ kit: string }> }) {
  const { kit } = await params;
  const visitor = visitorOf(request);
  const dashboards = kitDashboards(kit);
  if (!dashboards) return json(visitor, { error: { code: "unavailable" } }, { status: 404 });
  try {
    const result = await dashboards.interpreter.execute(
      await request.json(),
      { userId: visitor.id },
      { signal: request.signal },
    );
    return json(visitor, { result });
  } catch (error) {
    const { status, body } = cloudError(error, "This data couldn't be loaded.");
    return json(visitor, body, { status });
  }
}
