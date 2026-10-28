// @vitest-environment jsdom
import { act, createElement } from "react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { DrillProvider } from "../../blocks/Drill";
import { installDom, mount, runFrames } from "../../engine/test/testDom";
import { TrendChart } from "./TrendChart";

beforeAll(() => installDom());

/** Every y coordinate in a path's `d`. */
function pathYs(d: string): number[] {
  const nums = (d.match(/-?\d+(\.\d+)?(e-?\d+)?/g) ?? []).map(Number);
  return nums.filter((_, i) => i % 2 === 1);
}

describe("TrendChart series length", () => {
  const labels = ["a", "b", "c", "d"];

  it("draws a series longer than its labels, cut to them", () => {
    const view = mount(TrendChart, {
      labels,
      // Long enough to overrun the morph buffer (labels × series + guides).
      series: [{ name: "s", values: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] }],
    });
    runFrames();
    expect(view.container.querySelector("path.kit-trend-chart-line")?.getAttribute("d")).toMatch(
      /^M/,
    );
    // A data change re-runs the morph over the same (cut) buffer.
    view.rerender({ labels, series: [{ name: "s", values: [4, 3, 2, 1, 0, 9, 8, 7, 6, 5] }] });
    runFrames();
    view.unmount();
  });

  it("breaks a shorter series where its data ends instead of diving to the top edge", () => {
    const view = mount(TrendChart, { labels, series: [{ name: "s", values: [3, 4] }] });
    runFrames();
    const d = view.container.querySelector("path.kit-trend-chart-line")!.getAttribute("d")!;
    // The plot starts 14px down; an empty slot used to sit at y = 0.
    expect(Math.min(...pathYs(d))).toBeGreaterThan(10);
    // Two points: one move and one segment, nothing toward the unfilled labels.
    expect(d.match(/[MLC]/g)?.length).toBe(2);
    view.unmount();
  });
});

describe("TrendChart range selection", () => {
  const labels = ["Mon", "Tue", "Wed", "Thu", "Fri"];
  const props = {
    labels,
    format: "currency" as const,
    series: [
      {
        name: "This period",
        values: [100, 120, Number.NaN, 150, 200],
        emphasis: "primary" as const,
      },
      { name: "Last period", values: [90, 100, 110, 120, 130], emphasis: "muted" as const },
    ],
  };

  const frameOf = (container: HTMLElement) =>
    container.querySelector<HTMLDivElement>(".kit-trend-chart-frame")!;
  const readoutOf = (container: HTMLElement) =>
    container.querySelector(".kit-trend-chart-readout")!;
  const liveOf = (container: HTMLElement) => container.querySelector("[aria-live]")!;

  // The test DOM lays nothing out, so d3's pointer reads clientX as the plot x
  // (the chart is 800px wide: 0 is left of the first point, 800 right of the last).
  function pointer(el: Element, type: string, clientX: number, pointerType = "mouse") {
    act(() => {
      el.dispatchEvent(
        new PointerEvent(type, {
          clientX,
          clientY: 100,
          button: 0,
          pointerId: 1,
          pointerType,
          bubbles: true,
          cancelable: true,
        }),
      );
    });
  }
  function key(el: Element, k: string, shiftKey = false) {
    act(() => {
      el.dispatchEvent(new KeyboardEvent("keydown", { key: k, shiftKey, bubbles: true }));
    });
  }

  it("drags out a range, reads it at the top of the plot, and a click clears it", () => {
    const view = mount(TrendChart, props);
    runFrames();
    const frame = frameOf(view.container);
    expect(readoutOf(view.container).classList).toContain("kit-trend-chart-readout--empty");

    pointer(frame, "pointerdown", 0);
    pointer(frame, "pointermove", 400);
    pointer(frame, "pointermove", 800);
    expect(frame.classList).toContain("kit-trend-chart-frame--selecting");
    pointer(frame, "pointerup", 800);
    runFrames();

    const text = "Mon → Fri: $100 → $200 · +100.0% · $570 total";
    expect(readoutOf(view.container).textContent).toBe(text);
    // Announced from outside the role="img" frame.
    expect(liveOf(view.container).textContent).toBe(text);
    expect(frame.contains(liveOf(view.container))).toBe(false);
    expect(
      view.container.querySelector(".kit-trend-chart-selection")!.getAttribute("style"),
    ).toMatch(/opacity: 1/);

    // A reversed drag reads the same way round.
    pointer(frame, "pointerdown", 800);
    pointer(frame, "pointermove", 0);
    pointer(frame, "pointerup", 0);
    expect(readoutOf(view.container).textContent).toBe(text);

    // A click without a drag clears it.
    pointer(frame, "pointerdown", 400);
    pointer(frame, "pointerup", 401);
    expect(liveOf(view.container).textContent).toBe("");
    expect(readoutOf(view.container).classList).toContain("kit-trend-chart-readout--empty");
    view.unmount();
  });

  it("never starts a selection from touch, so a swipe stays a scroll", () => {
    const view = mount(TrendChart, props);
    const frame = frameOf(view.container);
    pointer(frame, "pointerdown", 0, "touch");
    pointer(frame, "pointermove", 800, "touch");
    pointer(frame, "pointerup", 800, "touch");
    expect(liveOf(view.container).textContent).toBe("");
    view.unmount();
  });

  it("clears on a press outside the chart", () => {
    const view = mount(TrendChart, props);
    const frame = frameOf(view.container);
    pointer(frame, "pointerdown", 0);
    pointer(frame, "pointermove", 800);
    pointer(frame, "pointerup", 800);
    expect(liveOf(view.container).textContent).not.toBe("");
    pointer(document.body, "pointerdown", 10);
    expect(liveOf(view.container).textContent).toBe("");
    view.unmount();
  });

  it("extends with Shift+arrows from the current point and clears on Escape", () => {
    const view = mount(TrendChart, props);
    const frame = frameOf(view.container);
    key(frame, "ArrowRight"); // hover Mon
    key(frame, "ArrowRight", true);
    expect(liveOf(view.container).textContent).toBe("Mon → Tue: $100 → $120 · +20.0% · $220 total");
    key(frame, "ArrowRight", true); // Wed is a gap: the readout still ends on Tue
    expect(liveOf(view.container).textContent).toBe("Mon → Tue: $100 → $120 · +20.0% · $220 total");
    key(frame, "ArrowRight", true);
    expect(liveOf(view.container).textContent).toBe("Mon → Thu: $100 → $150 · +50.0% · $370 total");
    // Back to where it started: a single point reads just its value.
    key(frame, "ArrowLeft", true);
    key(frame, "ArrowLeft", true);
    key(frame, "ArrowLeft", true);
    expect(liveOf(view.container).textContent).toBe("Mon: $100");
    key(frame, "Escape");
    expect(liveOf(view.container).textContent).toBe("");
    view.unmount();
  });

  it("reads a rate in points with no total, and marks an in-progress last day", () => {
    const view = mount(TrendChart, {
      labels,
      format: "percent" as const,
      partial: true,
      series: [{ name: "Conversion", values: [3.1, 3.2, 3.3, 3.4, 3.5] }],
    });
    const frame = frameOf(view.container);
    pointer(frame, "pointerdown", 0);
    pointer(frame, "pointermove", 800);
    pointer(frame, "pointerup", 800);
    expect(liveOf(view.container).textContent).toBe(
      "Mon → Fri (in progress): 3.1% → 3.5% · +0.4 pts",
    );
    view.unmount();
  });

  describe("dig-in", () => {
    /** The chart inside a page that can generate (a DrillProvider). */
    function Asking({ onAsk }: { onAsk: (prompt: string) => void }) {
      return createElement(DrillProvider, { onAsk, children: createElement(TrendChart, props) });
    }
    const menu = () => document.querySelector(".kit-drill");
    const questions = () =>
      [...document.querySelectorAll(".kit-drill__ask")].map((b) => b.textContent);
    // Escape closes the menu alone; a press outside would clear the selection too.
    const closeMenu = () =>
      act(() => {
        menu()!.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      });

    it("offers the clicked day, with the day before, and asks the picked question", () => {
      const onAsk = vi.fn();
      const view = mount(Asking, { onAsk });
      const frame = frameOf(view.container);
      // Thu, the fourth of five points.
      pointer(frame, "pointerdown", 600);
      pointer(frame, "pointerup", 600);
      expect(menu()!.querySelector(".kit-drill__head")!.textContent).toBe("Thu · This period $150");
      expect(questions()).toEqual(["Why was This period $150 on Thu?", "Break down Thu"]);
      act(() => {
        menu()!.querySelector("button")!.click();
      });
      // Wed has no value, so there is no day before to quote.
      expect(onAsk.mock.calls[0]![0]).toMatch(/^Why was This period \$150 on Thu\? /);
      view.unmount();
    });

    it("offers a range from a click inside it, from its readout, and from Enter", () => {
      const view = mount(Asking, { onAsk: vi.fn() });
      const frame = frameOf(view.container);
      pointer(frame, "pointerdown", 0);
      pointer(frame, "pointermove", 800);
      pointer(frame, "pointerup", 800);
      // Selecting doesn't open anything by itself.
      expect(menu()).toBeNull();

      pointer(frame, "pointerdown", 400);
      pointer(frame, "pointerup", 400);
      expect(questions()[0]).toBe("What drove This period over Mon → Fri?");
      // The selection stays.
      expect(readoutOf(view.container).classList).not.toContain("kit-trend-chart-readout--empty");
      closeMenu();

      act(() => {
        readoutOf(view.container).querySelector("button")!.click();
      });
      expect(questions()[1]).toBe("Compare Mon → Fri with the period before");
      closeMenu();

      key(frame, "Enter");
      expect(questions()[0]).toBe("What drove This period over Mon → Fri?");
      view.unmount();
    });

    it("offers a tapped day on touch, but not a swipe", () => {
      const view = mount(Asking, { onAsk: vi.fn() });
      const frame = frameOf(view.container);
      pointer(frame, "pointerdown", 600, "touch");
      pointer(frame, "pointerup", 640, "touch");
      expect(menu()).toBeNull();
      pointer(frame, "pointerdown", 600, "touch");
      pointer(frame, "pointerup", 603, "touch");
      expect(questions()[1]).toBe("Break down Thu");
      view.unmount();
    });

    it("offers nothing outside a provider: a click only clears, and no hint or button shows", () => {
      const view = mount(TrendChart, props);
      const frame = frameOf(view.container);
      pointer(frame, "pointerdown", 0);
      pointer(frame, "pointermove", 800);
      pointer(frame, "pointerup", 800);
      expect(readoutOf(view.container).querySelector("button")).toBeNull();
      pointer(frame, "pointerdown", 400);
      pointer(frame, "pointerup", 400);
      expect(menu()).toBeNull();
      view.unmount();
    });
  });
});
