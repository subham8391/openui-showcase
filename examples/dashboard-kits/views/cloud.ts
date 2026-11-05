// The browser's side of OpenUI Dashboards for a kit: where its token,
// interpreter, create and edit routes live (app/dashboard-kits/api/cloud/).

import { API } from "./use-kit-renderer";

/** A kit's cloud routes. */
export function cloudRoutes(kitId: string) {
  const base = `${API}/cloud/${kitId}`;
  return {
    token: `${base}/token`,
    interpreter: { url: `${base}/interpreter` },
    create: `${base}/dashboards`,
    edit: `${base}/edit`,
  };
}

/** The dashboard id in a create or edit response: `]]>openui:content?artifact_id=…`. */
export function artifactIdOf(response: string): string | undefined {
  return /[?&]artifact_id=([^&\s]+)/.exec(response)?.[1];
}

async function post(url: string, body: unknown, signal?: AbortSignal): Promise<string> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  const data = (await res.json().catch(() => ({}))) as {
    response?: string;
    error?: { message?: string };
  };
  if (!res.ok || !data.response) {
    throw new Error(data.error?.message ?? `The dashboard service answered ${res.status}.`);
  }
  return data.response;
}

/** Starts a dashboard from a request; resolves with the response the renderer streams it from. */
export function createDashboard(kitId: string, prompt: string, signal?: AbortSignal) {
  return post(cloudRoutes(kitId).create, { prompt }, signal);
}

/** Changes a dashboard in place; the renderers showing it switch when the new version is ready. */
export function editDashboard(kitId: string, id: string, prompt: string, signal?: AbortSignal) {
  return post(cloudRoutes(kitId).edit, { id, prompt }, signal);
}
