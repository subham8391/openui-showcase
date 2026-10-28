// @vitest-environment jsdom
import { act } from "react";
import { beforeAll, describe, expect, it } from "vitest";
import { installDom, mount, runFrames } from "../../engine/test/testDom";
import { activeTickCount } from "../shared/spring/ticker";
import { Sparkline } from "./Sparkline";
import { nearestIndex, sparkLayout } from "./sparklineGeometry";
import type { SparklineProps } from "./types";

beforeAll(() => installDom());

function key(el: Element, k: string) {
  act(() => {
    el.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true }));
  });
}

describe("sparkline layout", () => {
  it("splits diverging bars at the zero line", () => {
    const { ys, base, barWidth, xs } = sparkLayout([30, -10, 20], 300, 40, "diverging");
    expect(base).toBeGreaterThan(0);
    expect(base).toBeLessThan(40);
    expect(ys[0]).toBeLessThan(base); // positive: above zero
    expect(ys[1]).toBeGreaterThan(base); // negative: below zero
    expect(barWidth).toBe(98); // 100px a bar, less the 2px gap
    expect(xs).toEqual([50, 150, 250]);
  });

  it("grows count bars from the bottom edge", () => {
    expect(sparkLayout([5, 10], 100, 36, "bars").base).toBe(36);
  });

  it("hit-tests the nearest point", () => {
    expect(nearestIndex([10, 50, 90], 64)).toBe(1);
    expect(nearestIndex([10, 50, 90], -20)).toBe(0);
    expect(nearestIndex([10, 50, 90], 999)).toBe(2);
  });
});

describe("Sparkline", () => {
  it("colours diverging bars by sign, with a zero line", () => {
    const view = mount(Sparkline, { values: [30, -10, 20], variant: "diverging" as const });
    runFrames();
    const bars = [...view.container.querySelectorAll(".kit-sparkline-bar")];
    expect(bars.map((b) => b.classList.contains("kit-sparkline-bar--down"))).toEqual([
      false,
      true,
      false,
    ]);
    expect(bars[2]!.classList).toContain("kit-sparkline-bar--latest");
    const zero = Number(view.container.querySelector(".kit-sparkline-zero")!.getAttribute("y1"));
    // The negative bar starts at zero and hangs below it.
    expect(Number(bars[1]!.getAttribute("y"))).toBeCloseTo(zero);
    expect(
      Number(bars[0]!.getAttribute("y")) + Number(bars[0]!.getAttribute("height")),
    ).toBeCloseTo(zero);
    view.unmount();
  });

  it("moves its index with the arrow keys, reports it, and settles", () => {
    const seen: (number | null)[] = [];
    const view = mount(Sparkline, {
      values: [1, 3, 2, 4],
      label: "Orders",
      labels: ["Mon", "Tue", "Wed", "Thu"],
      formatValue: (v: number) => `${v} orders`,
      onHover: (i: number | null) => seen.push(i),
    });
    runFrames();
    const frame = view.container.querySelector<HTMLElement>(".kit-sparkline-frame")!;
    const live = view.container.querySelector("[aria-live='polite']")!;
    expect(frame.getAttribute("role")).toBe("img");
    expect(frame.getAttribute("aria-label")).toContain("Orders: 4 points from Mon to Thu");

    act(() => frame.focus());
    key(frame, "ArrowRight");
    key(frame, "ArrowRight");
    expect(live.textContent).toBe("Tue: 3 orders");
    key(frame, "ArrowLeft");
    expect(live.textContent).toBe("Mon: 1 orders");
    key(frame, "ArrowLeft"); // stays on the first point
    key(frame, "End");
    expect(live.textContent).toBe("Thu: 4 orders");
    key(frame, "Escape");
    expect(live.textContent).toBe("");
    expect(seen).toEqual([0, 1, 0, 3, null]);
    // The crosshair's glide stops: no animation loop is left running.
    expect(runFrames(2000)).toBeLessThan(2000);
    expect(activeTickCount()).toBe(0);
    view.unmount();
  });

  it("follows a parent's index without reading it out", () => {
    const props: SparklineProps = { values: [1, 3, 2], hoveredIndex: 1, variant: "bars" };
    const view = mount(Sparkline, props);
    runFrames();
    const bars = [...view.container.querySelectorAll(".kit-sparkline-bar")];
    expect(bars[1]!.classList).toContain("kit-sparkline-bar--active");
    expect(view.container.querySelector(".kit-sparkline-bars--hovering")).not.toBeNull();
    expect(view.container.querySelector("[aria-live]")!.textContent).toBe("");
    view.rerender({ ...props, hoveredIndex: null });
    expect(view.container.querySelector(".kit-sparkline-bars--hovering")).toBeNull();
    view.unmount();
  });

  it("stays a quiet, unfocusable mark without a label or handler", () => {
    const view = mount(Sparkline, { values: [1, 2, 3] });
    const frame = view.container.querySelector<HTMLElement>(".kit-sparkline-frame")!;
    expect(frame.getAttribute("aria-hidden")).toBe("true");
    expect(frame.hasAttribute("tabindex")).toBe(false);
    expect(view.container.querySelector("[aria-live]")).toBeNull();
    view.unmount();
  });
});
