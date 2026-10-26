// Render smoke test for every kit: each gallery dashboard renders in a DOM
// (jsdom) with the real kit library over the thesys dashboard library, every
// Query() resolving against the sample data in-process, and the run fails on
// a component error, a Renderer error (onError), a failed tool call, a React
// error log, or NaN / "[object Object]" in the markup. No network, no model.
import { JSDOM, VirtualConsole } from "jsdom";
import { format } from "node:util";

// ── A browser-like global environment, installed before React or any kit
// module loads (they are imported dynamically below). jsdom has no layout, so
// every element reports one fixed size, and ResizeObserver reports it too:
// charts then draw at a real width instead of their empty state.
const WIDTH = 960;
const HEIGHT = 320;
const domErrors: string[] = [];
const virtualConsole = new VirtualConsole();
virtualConsole.on("jsdomError", (error) => {
  // CSS jsdom can't parse and APIs it doesn't implement aren't kit bugs.
  if (/Could not parse CSS|Not implemented/.test(error.message)) return;
  domErrors.push(error.message);
});
const { window } = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "http://localhost/",
  pretendToBeVisual: true,
  virtualConsole,
});

class ResizeObserverStub {
  constructor(private callback: ResizeObserverCallback) {}
  observe(target: Element) {
    // Like a browser: the first observation arrives with the next frame.
    const entry = { target, contentRect: { width: WIDTH, height: HEIGHT } };
    window.requestAnimationFrame(() =>
      this.callback([entry as unknown as ResizeObserverEntry], this as never),
    );
  }
  unobserve() {}
  disconnect() {}
}
class IntersectionObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}
Object.assign(window, {
  ResizeObserver: ResizeObserverStub,
  IntersectionObserver: IntersectionObserverStub,
  // Reduced motion: springs and morphs land on their final frame at once.
  matchMedia: (query: string) => ({
    matches: query.includes("prefers-reduced-motion"),
    media: query,
    onchange: null,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    dispatchEvent: () => false,
  }),
});
for (const [prop, value] of [
  ["clientWidth", WIDTH],
  ["clientHeight", HEIGHT],
  ["offsetWidth", WIDTH],
  ["offsetHeight", HEIGHT],
] as const) {
  Object.defineProperty(window.HTMLElement.prototype, prop, {
    configurable: true,
    get: () => value,
  });
}
window.Element.prototype.getBoundingClientRect = function () {
  const rect = { x: 0, y: 0, top: 0, left: 0, right: WIDTH, bottom: HEIGHT };
  return { ...rect, width: WIDTH, height: HEIGHT, toJSON: () => rect } as DOMRect;
};

// SVG geometry jsdom lacks: a path is read as the polyline through the
// coordinate pairs of its `d`, which is close enough for crosshairs and
// draw-in animations to find finite points on it.
function pathPoints(el: Element): { x: number; y: number }[] {
  const n = (el.getAttribute("d") ?? "").match(/-?\d*\.?\d+(?:e-?\d+)?/gi)?.map(Number) ?? [];
  const points = [];
  for (let i = 0; i + 1 < n.length; i += 2) points.push({ x: n[i]!, y: n[i + 1]! });
  return points;
}
Object.assign(window.SVGElement.prototype, {
  getTotalLength(this: Element) {
    const p = pathPoints(this);
    let total = 0;
    for (let i = 1; i < p.length; i++)
      total += Math.hypot(p[i]!.x - p[i - 1]!.x, p[i]!.y - p[i - 1]!.y);
    return total;
  },
  getPointAtLength(this: Element, length: number) {
    const p = pathPoints(this);
    if (!p.length) return { x: 0, y: 0 };
    let left = Math.max(0, length);
    for (let i = 1; i < p.length; i++) {
      const seg = Math.hypot(p[i]!.x - p[i - 1]!.x, p[i]!.y - p[i - 1]!.y);
      if (seg >= left && seg > 0) {
        const t = left / seg;
        return {
          x: p[i - 1]!.x + (p[i]!.x - p[i - 1]!.x) * t,
          y: p[i - 1]!.y + (p[i]!.y - p[i - 1]!.y) * t,
        };
      }
      left -= seg;
    }
    return p.at(-1)!;
  },
  getBBox: () => ({ x: 0, y: 0, width: 48, height: 14 }),
  getComputedTextLength(this: Element) {
    return (this.textContent ?? "").length * 7;
  },
});

// Expose the window's globals (document, HTMLElement, requestAnimationFrame…)
// without replacing Node's own (fetch, URL, performance…), except the event
// classes, which must be jsdom's to dispatch on jsdom nodes.
for (const key of Object.getOwnPropertyNames(window)) {
  if (key in globalThis) continue;
  Object.defineProperty(globalThis, key, {
    configurable: true,
    get: () => (window as unknown as Record<string, unknown>)[key],
  });
}
for (const key of ["Event", "CustomEvent", "EventTarget", "navigator"]) {
  Object.defineProperty(globalThis, key, { configurable: true, value: (window as never)[key] });
}

// React's own error logs (bad props, NaN attributes, key warnings) count too.
const consoleErrors: string[] = [];
const originalError = console.error;
console.error = (...args: unknown[]) => {
  if (consoleErrors.length < 20) consoleErrors.push(format(...args));
};
process.on("unhandledRejection", (reason) => {
  consoleErrors.push(`unhandled rejection: ${(reason as Error)?.message ?? reason}`);
});

const { createRoot } = await import("react-dom/client");
const { Renderer } = await import("@openuidev/react-lang");
const { ThemeProvider } = await import("@openuidev/react-ui");
const { KITS } = await import("../src/kits/index");
const { analyticsLibrary, ecommerceLibrary } = await import("../src/kits/libraries");
const { runTool } = await import("../src/kits/server");
type Library = typeof ecommerceLibrary;
type OpenUIError = import("@openuidev/react-lang").OpenUIError;

/**
 * Set once a component throws. react-lang's per-element error boundary shows
 * the last good render and retries whenever its parent re-renders, and the
 * report re-renders the parent, so a component that keeps throwing would keep
 * the page busy forever. Every component renders nothing once this is set,
 * which ends the loop so the failure can be reported.
 */
let halted = false;
function guarded(library: Library): Library {
  const components = Object.fromEntries(
    Object.entries(library.components).map(([name, definition]) => {
      const Component = definition.component;
      const Guarded: typeof Component = (props) => (halted ? null : <Component {...props} />);
      return [name, { ...definition, component: Guarded }];
    }),
  );
  return { ...library, components };
}
const LIBRARIES: Record<string, Library> = {
  ecommerce: guarded(ecommerceLibrary),
  analytics: guarded(analyticsLibrary),
};

const SETTLE_TIMEOUT_MS = 15_000;
const tick = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Renders one dashboard; resolves once every Query settled and the markup stopped changing. */
async function renderDashboard(kitId: string, program: string) {
  const kit = KITS.find((k) => k.id === kitId)!;
  const problems: string[] = [];
  let pending = 0;
  let calls = 0;
  // Each tool runs in-process with the validation the /api/tools route
  // applies; the JSON round trip hands back what the network would.
  const toolProvider = Object.fromEntries(
    kit.tools.map((tool) => [
      tool.name,
      async (args: Record<string, unknown>) => {
        pending++;
        calls++;
        try {
          return JSON.parse(JSON.stringify(runTool(kitId, tool.name, args ?? {})));
        } catch (error) {
          problems.push(
            `${tool.name}(${JSON.stringify(args)}) failed: ${(error as Error).message.slice(0, 300)}`,
          );
          throw error;
        } finally {
          pending--;
        }
      },
    ]),
  );
  let rendererErrors: OpenUIError[] = [];
  const fail = (kind: string) => (error: unknown) => {
    halted = true;
    problems.push(`${kind}: ${(error as Error)?.message ?? error}`);
  };

  halted = false;
  consoleErrors.length = 0;
  domErrors.length = 0;
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container, {
    onUncaughtError: fail("uncaught error"),
    onCaughtError: fail("component error"),
    onRecoverableError: fail("recoverable error"),
  });
  root.render(
    <ThemeProvider mode="light">
      <div className="kit-theme" data-mode="light">
        <Renderer
          response={program}
          library={LIBRARIES[kitId]!}
          isStreaming={false}
          toolProvider={toolProvider}
          onError={(errors) => {
            rendererErrors = errors;
          }}
        />
      </div>
    </ThemeProvider>,
  );

  // Settled: no tool call in flight and the markup unchanged for five frames.
  const started = Date.now();
  let html = "";
  for (let stable = 0; stable < 5 && !halted;) {
    if (Date.now() - started > SETTLE_TIMEOUT_MS) {
      problems.push(
        `did not settle in ${SETTLE_TIMEOUT_MS / 1000} s (${pending} tool calls pending)`,
      );
      break;
    }
    await tick(16);
    const next = container.innerHTML;
    stable = pending === 0 && calls > 0 && next === html ? stable + 1 : 0;
    html = next;
  }

  problems.push(...rendererErrors.map((e) => `renderer ${e.code}: ${e.message}`));
  problems.push(...consoleErrors.map((m) => `console.error: ${m.slice(0, 300)}`));
  problems.push(...domErrors.map((m) => `jsdom: ${m.slice(0, 300)}`));
  if (!halted) {
    if ((container.textContent ?? "").trim().length < 40) problems.push("rendered almost nothing");
    // A skeleton left once every Query settled is a component its data never reached.
    const skeletons = container.querySelectorAll(".kit-skel__block, .kit-skel__plot").length;
    if (skeletons)
      problems.push(`${skeletons} skeleton block(s) still showing after every Query settled`);
    if (html.includes("[object Object]")) problems.push('markup contains "[object Object]"');
    const nan = /\bNaN\b/.exec(html);
    if (nan)
      problems.push(
        `markup contains NaN: …${html.slice(Math.max(0, nan.index - 80), nan.index + 20)}…`,
      );
  }
  const elements = container.querySelectorAll("*").length;

  root.unmount();
  container.remove();
  return { problems: [...new Set(problems)], calls, elements };
}

let failures = 0;
const startedAll = Date.now();
for (const kit of KITS) {
  console.log(`\n${kit.name} (${kit.id})`);
  for (const dashboard of kit.gallery) {
    const t0 = Date.now();
    const { problems, calls, elements } = await renderDashboard(kit.id, dashboard.program);
    if (problems.length) {
      failures += problems.length;
      for (const p of problems) console.log(`  ✗ render "${dashboard.title}": ${p}`);
    } else {
      console.log(
        `  ✓ render "${dashboard.title}": ${calls} tool calls, ${elements} elements, ${Date.now() - t0} ms`,
      );
    }
  }
}

console.error = originalError;
const seconds = ((Date.now() - startedAll) / 1000).toFixed(1);
console.log(
  failures
    ? `\n${failures} render problem(s) found`
    : `\nAll gallery dashboards render (${seconds} s)`,
);
process.exit(failures ? 1 : 0);
