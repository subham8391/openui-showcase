import { getKit } from "@/examples/dashboard-kits/kits";
import { buildSystemPrompt, toToolSpec } from "@/examples/dashboard-kits/kits/registry";
import { getKitSpec } from "@/examples/dashboard-kits/kits/server";

/**
 * The system prompt a kit sends to the model, for inspection in the Prompt
 * view. With `?question=`, the prompt that request would get, its examples
 * picked for it.
 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const kit = getKit(params.get("kit") ?? "");
  if (!kit) return Response.json({ error: "Unknown kit" }, { status: 404 });
  return Response.json({
    prompt: buildSystemPrompt(kit, getKitSpec(kit.id), {
      question: params.get("question") ?? undefined,
    }),
    tools: kit.tools.map(toToolSpec),
  });
}
