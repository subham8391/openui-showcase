// OpenUI Cloud on the server: one client per app. The key is read by
// @openuidev/server from THESYS_API_KEY, here on the server only.
import { OpenUIClient } from "@openuidev/server";
import "server-only";

/**
 * OpenUI Cloud's origin: the one THESYS_BASE_URL points at (a gateway URL
 * such as https://api.dev.thesys.dev/v1/embed gives https://api.dev.thesys.dev),
 * else OpenUI Cloud itself.
 */
export function cloudBaseUrl(): string {
  const url = process.env.THESYS_BASE_URL;
  return url ? new URL(url).origin : "https://api.thesys.dev";
}

/** The model that builds and edits dashboards, as `provider/model`. */
export function dashboardModel(): string {
  return process.env.OPENUI_DASHBOARD_MODEL ?? "anthropic/claude-sonnet-5.5";
}

const clients = new Map<string, OpenUIClient>();

/**
 * The client for one app (each example or kit is its own app, so its users'
 * tokens and dashboards stay apart). Null when no key is set.
 */
export function openuiClient(appId: string): OpenUIClient | null {
  if (!process.env.THESYS_API_KEY) return null;
  let client = clients.get(appId);
  if (!client) {
    client = new OpenUIClient({ baseUrl: cloudBaseUrl(), appId });
    clients.set(appId, client);
  }
  return client;
}

/**
 * An OpenUI Cloud or data-tool failure as a status and a JSON error body with
 * its stable `code`. Locally the message says what went wrong; a deployed
 * site logs it and shows a generic one, since a service error can echo
 * request details.
 */
export function cloudError(error: unknown, fallback: string): { status: number; body: unknown } {
  const e = error as { code?: unknown; status?: unknown; message?: unknown };
  const code = typeof e?.code === "string" ? e.code : "internal_error";
  const status =
    typeof e?.status === "number" && e.status >= 400 && e.status < 600 ? e.status : 500;
  const message = typeof e?.message === "string" ? e.message : String(error);
  if (process.env.NODE_ENV === "production") {
    console.error(`OpenUI Cloud: ${code} ${status} ${message}`);
    return { status, body: { error: { code, message: fallback } } };
  }
  return { status, body: { error: { code, message } } };
}
