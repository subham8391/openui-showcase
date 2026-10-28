// @vitest-environment jsdom
import { act, createElement } from "react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { DrillProvider } from "../../blocks/Drill";
import { installDom, mount } from "../../engine/test/testDom";
import { ColumnChart } from "./ColumnChart";
import type { ColumnChartProps } from "./types";

beforeAll(() => installDom());

const labels = ["Mon", "Tue", "Wed", "Thu"];
const series = [
  { name: "Orders", values: [4, 6, 3, 5] },
  { name: "Returns", values: [1, 2, 1, 2] },
];

function press(el: Element, key: string) {
  act(() => {
    el.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
  });
}

/** The bars of one band (column index), across every series. */
function band(container: HTMLElement, j: number): SVGPathElement[] {
  return [...container.querySelectorAll<SVGPathElement>(".kit-column-chart-series")].map(
    (g) => g.querySelectorAll<SVGPathElement>(".kit-column-chart-col")[j]!,
  );
}

const opacity = (el: Element) => Number((el as SVGElement).style.opacity || 1);

describe.each([false, true])("ColumnChart band hover (stacked: %s)", (stacked) => {
  it("dims every other band while one is hovered, and clears on leave", () => {
    const view = mount(ColumnChart, { labels, series, stacked, isAnimationActive: false });
    const frame = view.container.querySelector<HTMLElement>(".kit-column-chart-frame")!;
    const cols = () => [...view.container.querySelectorAll(".kit-column-chart-col")];
    expect(cols().some((c) => c.classList.contains("kit-column-chart-col--dimmed"))).toBe(false);

    act(() => frame.focus());
    press(frame, "ArrowRight");
    press(frame, "ArrowRight");
    // Band 1 is hovered: its bars stay full, the other three bands step back.
    for (const bar of band(view.container, 1)) {
      expect(bar.classList).toContain("kit-column-chart-col--active");
      expect(bar.classList).not.toContain("kit-column-chart-col--dimmed");
      expect(opacity(bar)).toBe(1);
    }
    for (const j of [0, 2, 3]) {
      for (const bar of band(view.container, j)) {
        expect(bar.classList).toContain("kit-column-chart-col--dimmed");
        expect(opacity(bar)).toBeCloseTo(0.35);
      }
    }
    // The tooltip still reads the hovered column.
    expect(document.querySelector(".kit-tooltip__title")?.textContent).toBe("Tue");

    press(frame, "Escape");
    expect(cols().some((c) => c.classList.contains("kit-column-chart-col--dimmed"))).toBe(false);
    expect(cols().every((c) => opacity(c) === 1)).toBe(true);
    view.unmount();
  });

  it("clears the dimming when the pointer leaves", () => {
    const view = mount(ColumnChart, { labels, series, stacked, isAnimationActive: false });
    const frame = view.container.querySelector<HTMLElement>(".kit-column-chart-frame")!;
    act(() => {
      frame.dispatchEvent(
        new MouseEvent("pointermove", { clientX: 400, clientY: 100, bubbles: true }),
      );
    });
    expect(view.container.querySelectorAll(".kit-column-chart-col--dimmed").length).toBe(6);
    act(() => {
      frame.dispatchEvent(new MouseEvent("pointerout", { bubbles: true, relatedTarget: null }));
    });
    expect(view.container.querySelectorAll(".kit-column-chart-col--dimmed").length).toBe(0);
    view.unmount();
  });

  it("combines a pinned series with a hovered band without hiding the hovered bar", () => {
    const view = mount(ColumnChart, { labels, series, stacked, isAnimationActive: false });
    const frame = view.container.querySelector<HTMLElement>(".kit-column-chart-frame")!;
    const pin = [...view.container.querySelectorAll("button")].find((b) =>
      b.textContent?.includes("Orders"),
    )!;
    act(() => pin.click());
    act(() => frame.focus());
    press(frame, "ArrowRight");

    const [orders, returns] = band(view.container, 0);
    // The pinned series' bar in the hovered band is fully drawn.
    expect(opacity(orders!)).toBe(1);
    // The other series keeps its legend fade, not a fade on top of it.
    expect(opacity(returns!)).toBeCloseTo(0.16);
    for (const j of [1, 2, 3]) {
      const [o, r] = band(view.container, j);
      expect(opacity(o!)).toBeCloseTo(0.35);
      // Floors at the series fade instead of multiplying (0.16 × 0.35).
      expect(opacity(r!)).toBeCloseTo(0.16);
    }
    view.unmount();
  });
});

describe("ColumnChart dig-in", () => {
  /** The chart inside a page that can generate (a DrillProvider). */
  function Asking({ onAsk, ...chart }: ColumnChartProps & { onAsk: (prompt: string) => void }) {
    return createElement(DrillProvider, { onAsk, children: createElement(ColumnChart, chart) });
  }
  const frameOf = (container: HTMLElement) =>
    container.querySelector<HTMLElement>(".kit-column-chart-frame")!;
  /** The x of column j's centre: its label sits there (the frame is at 0,0 in jsdom). */
  const centerOf = (container: HTMLElement, j: number) =>
    Number(container.querySelectorAll(".kit-column-chart-x text")[j]!.getAttribute("x"));
  const click = (el: Element, clientX: number, clientY: number) =>
    act(() => {
      el.dispatchEvent(new MouseEvent("click", { bubbles: true, clientX, clientY, detail: 1 }));
    });
  const menu = () => document.querySelector(".kit-drill");
  const heading = () => menu()!.querySelector(".kit-drill__head")!.textContent;
  const questions = () =>
    [...document.querySelectorAll(".kit-drill__ask")].map((b) => b.textContent);

  it("offers the clicked bar of a group, with the column before, and asks the picked question", () => {
    const onAsk = vi.fn();
    const view = mount(Asking, { labels, series, isAnimationActive: false, onAsk });
    const frame = frameOf(view.container);
    // Right of Tue's centre: the Returns bar of the pair.
    click(frame, centerOf(view.container, 1) + 6, 200);
    expect(heading()).toBe("Tue · Returns 2");
    expect(questions()).toEqual(["Why was Returns 2 on Tue?", "Break down Tue"]);
    act(() => {
      menu()!.querySelector("button")!.click();
    });
    expect(onAsk.mock.calls[0]![0]).toMatch(/^Why was Returns 2 on Tue \(1 on Mon\)\? /);
    expect(menu()).toBeNull();

    // Left of Mon's centre: the Orders bar, with no column before it to quote.
    click(frame, centerOf(view.container, 0) - 6, 200);
    expect(heading()).toBe("Mon · Orders 4");
    view.unmount();
  });

  it("offers the segment under the pointer in a stack", () => {
    const view = mount(Asking, {
      labels,
      series,
      stacked: true,
      isAnimationActive: false,
      onAsk: vi.fn(),
    });
    const frame = frameOf(view.container);
    const x = centerOf(view.container, 1);
    // Near the baseline: Orders, at the bottom of Tue's stack.
    click(frame, x, 200);
    expect(heading()).toBe("Tue · Orders 6");
    // Near the top of the plot: Returns, stacked on top.
    click(frame, x, 20);
    expect(heading()).toBe("Tue · Returns 2");
    view.unmount();
  });

  it("offers the hovered column on Enter, hints in the tooltip, and ignores the axis labels", () => {
    const view = mount(Asking, { labels, series, isAnimationActive: false, onAsk: vi.fn() });
    const frame = frameOf(view.container);
    expect(frame.classList).toContain("kit-column-chart-frame--drill");
    act(() => frame.focus());
    press(frame, "ArrowRight");
    press(frame, "ArrowRight");
    expect(document.querySelector(".kit-tooltip__hint")?.textContent).toBe("Click to ask why");
    press(frame, "Enter");
    expect(heading()).toBe("Tue · Orders 6");
    expect(document.activeElement?.closest(".kit-drill")).not.toBeNull();

    act(() => {
      menu()!.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });
    expect(document.activeElement).toBe(frame);
    // The x labels under the plot aren't a column to ask about.
    click(frame, centerOf(view.container, 1), 236);
    expect(menu()).toBeNull();
    view.unmount();
  });

  it("offers nothing outside a provider: no menu, no hint, no pointer cursor", () => {
    const view = mount(ColumnChart, { labels, series, isAnimationActive: false });
    const frame = frameOf(view.container);
    expect(frame.classList).not.toContain("kit-column-chart-frame--drill");
    click(frame, centerOf(view.container, 1), 200);
    act(() => frame.focus());
    press(frame, "ArrowRight");
    press(frame, "Enter");
    expect(menu()).toBeNull();
    expect(document.querySelector(".kit-tooltip")).not.toBeNull();
    expect(document.querySelector(".kit-tooltip__hint")).toBeNull();
    view.unmount();
  });
});
