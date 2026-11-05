import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { kitApp, kitDashboards, kitDataTools } = await import("./cloud");
const { KITS, getKit } = await import("./registry");

afterEach(() => vi.unstubAllEnvs());

/** The longest list anywhere in a value. */
function longestList(value: unknown): number {
  if (Array.isArray(value)) return Math.max(value.length, ...value.map(longestList));
  if (value && typeof value === "object")
    return Math.max(0, ...Object.values(value).map(longestList));
  return 0;
}

describe.each(KITS.map((kit) => [kit.id, kit] as const))("%s on OpenUI Dashboards", (id, kit) => {
  it("offers every tool as a data tool, with a short example output", () => {
    const tools = kitDataTools(kit);
    expect(Object.keys(tools).sort()).toEqual(kit.tools.map((t) => t.name).sort());
    for (const [name, tool] of Object.entries(tools)) {
      expect(tool.description, name).toBeTruthy();
      expect(tool.parameters, name).toMatchObject({ type: "object" });
      // The model reads the shape; whole lists would only lengthen the prompt.
      expect(longestList(tool.output), name).toBeLessThanOrEqual(2);
    }
  });

  it("runs a tool with filters nobody picked yet", async () => {
    const [name, tool] = Object.entries(kitDataTools(kit))[0]!;
    const props = Object.keys((tool.parameters as { properties?: object }).properties ?? {});
    const unset = Object.fromEntries(props.map((p, i) => [p, i % 2 ? null : ""]));
    await expect(
      Promise.resolve(
        tool.execute(unset, { userId: "v_test" }, { signal: new AbortController().signal }),
      ),
      name,
    ).resolves.toBeDefined();
  });

  it("is its own app, and defines a dashboard OpenUI accepts once a key is set", () => {
    expect(kitApp(id)).toBe(`showcase-${id}`);
    vi.stubEnv("THESYS_API_KEY", "");
    expect(kitDashboards(id, "anything")).toBeNull();
    vi.stubEnv("THESYS_API_KEY", "test-key-not-used");
    // Builds the config block from the kit's spec and prompt options, no network.
    const dashboards = kitDashboards(id, kit.starters[0]);
    expect(dashboards).not.toBeNull();
    expect(typeof dashboards!.create).toBe("function");
    expect(typeof dashboards!.interpreter.execute).toBe("function");
  });
});

it("knows no unknown kit", () => {
  vi.stubEnv("THESYS_API_KEY", "test-key-not-used");
  expect(getKit("nope")).toBeUndefined();
  expect(kitDashboards("nope")).toBeNull();
});
