import { kitApp } from "@/examples/dashboard-kits/kits/cloud";
import { getKit } from "@/examples/dashboard-kits/kits/registry";
import { cloudError, openuiClient } from "@/shared/server/openui";
import { json, visitorOf } from "@/shared/server/visitor";

export const runtime = "nodejs";

// The visitor's frontend token for one kit: short-lived and scoped to them,
// so the browser streams and lists only their dashboards, never seeing the key.
export async function POST(request: Request, { params }: { params: Promise<{ kit: string }> }) {
  const { kit } = await params;
  const visitor = visitorOf(request);
  const openui = getKit(kit) ? openuiClient(kitApp(kit)) : null;
  if (!openui) return json(visitor, { error: { code: "unavailable" } }, { status: 404 });
  try {
    const token = await openui.createFrontendToken(
      { userId: visitor.id },
      { signal: request.signal },
    );
    return json(visitor, token);
  } catch (error) {
    const { status, body } = cloudError(error, "Could not create a frontend token.");
    return json(visitor, body, { status });
  }
}
