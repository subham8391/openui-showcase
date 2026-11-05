// Who is asking. The showcase has no sign-in, so each browser is an anonymous
// visitor: a random id in a signed, HTTP-only cookie the page can't read or
// forge. Dashboards belong to that id, so each visitor sees only their own.
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import "server-only";

const COOKIE = "showcase_visitor";
const YEAR = 60 * 60 * 24 * 365;

/** The signing secret: VISITOR_SECRET, else one derived from the API key (never the key itself). */
function secret(): Buffer {
  const seed = process.env.VISITOR_SECRET ?? process.env.THESYS_API_KEY ?? "local-showcase";
  return createHmac("sha256", seed).update("showcase-visitor-v1").digest();
}

function sign(id: string): string {
  return createHmac("sha256", secret()).update(id).digest("base64url");
}

/** The id inside a signed cookie value, or null when it was tampered with. */
function verify(value: string): string | null {
  const dot = value.lastIndexOf(".");
  if (dot <= 0) return null;
  const id = value.slice(0, dot);
  const given = Buffer.from(value.slice(dot + 1));
  const expected = Buffer.from(sign(id));
  return given.length === expected.length && timingSafeEqual(given, expected) ? id : null;
}

function readCookie(request: Request, name: string): string | undefined {
  for (const part of request.headers.get("cookie")?.split(";") ?? []) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return undefined;
}

export interface Visitor {
  /** The visitor's id, the `userId` OpenUI Cloud keeps their dashboards under. */
  id: string;
  /** A Set-Cookie header to send back when the visitor is new. */
  setCookie?: string;
}

/** The request's visitor, or a new one (with the cookie to set) on their first request. */
export function visitorOf(request: Request): Visitor {
  const value = readCookie(request, COOKIE);
  const known = value ? verify(value) : null;
  if (known) return { id: known };
  const id = `v_${randomUUID()}`;
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return {
    id,
    setCookie: `${COOKIE}=${encodeURIComponent(`${id}.${sign(id)}`)}; Path=/; Max-Age=${YEAR}; HttpOnly; SameSite=Lax${secure}`,
  };
}

/** A JSON response that also sets the visitor's cookie when they are new. */
export function json(visitor: Visitor, body: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  headers.set("Cache-Control", "private, no-store");
  if (visitor.setCookie) headers.append("Set-Cookie", visitor.setCookie);
  return Response.json(body, { ...init, headers });
}
