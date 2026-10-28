// @vitest-environment jsdom
import { act } from "react";
import { beforeAll, describe, expect, it } from "vitest";
import { installDom, mount } from "../../engine/test/testDom";
import { ColumnChart } from "./ColumnChart";

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
