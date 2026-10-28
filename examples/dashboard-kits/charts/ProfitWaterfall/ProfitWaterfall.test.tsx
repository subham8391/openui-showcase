// @vitest-environment jsdom
import { act, createElement } from "react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { DrillProvider } from "../../blocks/Drill";
import { installDom, mount } from "../../engine/test/testDom";
import { ProfitWaterfall } from "./ProfitWaterfall";
import type { ProfitWaterfallProps } from "./types";

beforeAll(() => installDom());

/** A variance walk, as VarianceWalk draws it: no comparison outlines. */
const walk: ProfitWaterfallProps = {
  steps: [
    { label: "Prior 30 days", value: 1000, kind: "base" },
    { label: "Web", value: 316, kind: "add" },
    { label: "Ads", value: 120, kind: "subtract" },
    { label: "This period", value: 1196, kind: "total" },
  ],
  zero: false,
  isAnimationActive: false,
};

/** A profit bridge against plan. */
const bridge: ProfitWaterfallProps = {
  steps: [
    { label: "Net sales", value: 5000, kind: "base", comparison: 4800 },
    { label: "Shipping", value: 400, kind: "subtract", comparison: 350 },
    { label: "Profit", value: 4600, kind: "total", comparison: 4450 },
  ],
  comparisonLabel: "Plan",
  isAnimationActive: false,
};

/** The chart inside a page that can generate (a DrillProvider). */
function Asking({ onAsk, ...chart }: ProfitWaterfallProps & { onAsk: (prompt: string) => void }) {
  return createElement(DrillProvider, { onAsk, children: createElement(ProfitWaterfall, chart) });
}

const frameOf = (container: HTMLElement) =>
  container.querySelector<HTMLElement>(".kit-waterfall-chart-frame")!;
const readoutOf = (container: HTMLElement) =>
  container.querySelector(".kit-waterfall-chart-readout")!;
/** Clicks the middle of step i's band, inside the plot; the frame is at 0,0 in jsdom. */
function clickStep(container: HTMLElement, i: number) {
  const bar = container.querySelectorAll(".kit-waterfall-chart-bar")[i]!;
  const clientX = Number(bar.getAttribute("x")) + Number(bar.getAttribute("width")) / 2;
  act(() => {
    frameOf(container).dispatchEvent(
      new MouseEvent("click", { bubbles: true, clientX, clientY: 120, detail: 1 }),
    );
  });
}
function press(el: Element, key: string) {
  act(() => {
    el.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
  });
}
const menu = () => document.querySelector(".kit-drill");
const heading = () => menu()!.querySelector(".kit-drill__head")!.textContent;
const questions = () => [...document.querySelectorAll(".kit-drill__ask")].map((b) => b.textContent);

describe("ProfitWaterfall dig-in", () => {
  it("offers the clicked step by its own name and asks the picked question", () => {
    const onAsk = vi.fn();
    const view = mount(Asking, { ...walk, onAsk });
    expect(readoutOf(view.container).textContent).toContain("click one to ask why");
    clickStep(view.container, 1);
    expect(heading()).toBe("Web · +$316");
    expect(questions()).toEqual(["Why was Web +$316?", "Break down Web"]);
    act(() => {
      menu()!.querySelectorAll("button")[1]!.click();
    });
    expect(onAsk.mock.calls[0]![0]).toMatch(/^Break down Web \(\+\$316\): .* the other parts\. /);
    view.unmount();
  });

  it("quotes the step's comparison, and offers the hovered step on Enter", () => {
    const onAsk = vi.fn();
    const view = mount(Asking, { ...bridge, onAsk });
    const frame = frameOf(view.container);
    expect(frame.classList).toContain("kit-waterfall-chart-frame--drill");
    act(() => frame.focus());
    press(frame, "ArrowRight");
    press(frame, "ArrowRight"); // Shipping
    press(frame, "Enter");
    expect(questions()[0]).toBe("Why was Shipping −$400?");
    expect(document.activeElement?.closest(".kit-drill")).not.toBeNull();
    act(() => {
      menu()!.querySelector("button")!.click();
    });
    expect(onAsk.mock.calls[0]![0]).toMatch(/^Why was Shipping −\$400 \(Plan: −\$350\)\? /);
    view.unmount();
  });

  it("offers nothing outside a provider: no menu, no hint, no pointer cursor", () => {
    const view = mount(ProfitWaterfall, walk);
    const frame = frameOf(view.container);
    expect(frame.classList).not.toContain("kit-waterfall-chart-frame--drill");
    expect(readoutOf(view.container).textContent).not.toContain("ask why");
    clickStep(view.container, 1);
    act(() => frame.focus());
    press(frame, "ArrowRight");
    press(frame, "Enter");
    expect(menu()).toBeNull();
    view.unmount();
  });
});
