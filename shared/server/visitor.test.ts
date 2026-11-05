import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { json, visitorOf } = await import("./visitor");

/** A request carrying the cookie a response set. */
function requestWith(setCookie?: string): Request {
  const cookie = setCookie?.split(";")[0];
  return new Request("http://localhost/x", cookie ? { headers: { cookie } } : {});
}

describe("visitorOf", () => {
  it("gives a new visitor an id and an HTTP-only cookie", () => {
    const visitor = visitorOf(requestWith());
    expect(visitor.id).toMatch(/^v_[0-9a-f-]{36}$/);
    expect(visitor.setCookie).toMatch(
      /^showcase_visitor=.+; Path=\/; Max-Age=\d+; HttpOnly; SameSite=Lax/,
    );
  });

  it("knows a returning visitor by their cookie, and sets nothing new", () => {
    const first = visitorOf(requestWith());
    const again = visitorOf(requestWith(first.setCookie));
    expect(again).toEqual({ id: first.id });
  });

  it("treats a forged or altered cookie as a new visitor", () => {
    const first = visitorOf(requestWith());
    const forged = first.setCookie!.replace(first.id, "v_someone-else");
    const visitor = visitorOf(requestWith(forged));
    expect(visitor.id).not.toBe("v_someone-else");
    expect(visitor.id).not.toBe(first.id);
    expect(visitor.setCookie).toBeDefined();
    expect(visitorOf(requestWith("showcase_visitor=no-signature")).setCookie).toBeDefined();
  });
});

describe("json", () => {
  it("never caches, and sets the cookie only for a new visitor", () => {
    const fresh = visitorOf(requestWith());
    const res = json(fresh, { ok: true }, { status: 201 });
    expect(res.status).toBe(201);
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect(res.headers.get("set-cookie")).toContain("showcase_visitor=");
    expect(json({ id: fresh.id }, {}).headers.get("set-cookie")).toBeNull();
  });
});
