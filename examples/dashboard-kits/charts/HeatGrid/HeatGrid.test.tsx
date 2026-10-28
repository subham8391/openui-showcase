// @vitest-environment jsdom
import { act, createElement } from "react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { DrillProvider } from "../../blocks/Drill";
import { installDom, mount } from "../../engine/test/testDom";
import { HeatGrid } from "./HeatGrid";
import type { HeatGridProps } from "./types";

beforeAll(() => installDom());

const props = {
  rows: [
    { label: "Mon", values: [1, 4, 2] },
    { label: "Tue", values: [3, 0, 5] },
  ],
  columns: ["09:00", "12:00", "15:00"],
  unit: "orders",
  isAnimationActive: false,
};

function press(el: Element, key: string) {
  act(() => {
    el.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
  });
}

describe("HeatGrid cell hover", () => {
  it("lifts the hovered cell, dims the others, and clears on leave", () => {
    const view = mount(HeatGrid, props);
    const frame = view.container.querySelector<HTMLElement>(".kit-heat-grid-frame")!;
    const cells = () => [...view.container.querySelectorAll(".kit-heat-grid-cell")];
    expect(view.container.querySelector(".kit-heat-grid-cell--dimmed")).toBeNull();
    expect(view.container.querySelector(".kit-heat-grid-lift")).toBeNull();

    act(() => frame.focus());
    press(frame, "ArrowRight"); // Mon 09:00
    press(frame, "ArrowDown"); // Tue 09:00
    press(frame, "ArrowRight"); // Tue 12:00

    const hovered = cells()[4]!;
    expect(hovered.classList).toContain("kit-heat-grid-cell--active");
    expect(hovered.classList).not.toContain("kit-heat-grid-cell--dimmed");
    const others = cells().filter((c) => c !== hovered);
    expect(others.every((c) => c.classList.contains("kit-heat-grid-cell--dimmed"))).toBe(true);
    expect(others.some((c) => c.classList.contains("kit-heat-grid-cell--active"))).toBe(false);

    // The lifted copy sits on the hovered cell's slot, so nothing else moves.
    const lift = view.container.querySelector(".kit-heat-grid-lift")!;
    expect(lift.getAttribute("x")).toBe(hovered.getAttribute("x"));
    expect(lift.getAttribute("y")).toBe(hovered.getAttribute("y"));
    expect(lift.getAttribute("fill")).toBe(hovered.getAttribute("fill"));

    // The tooltip still reads the cell.
    expect(document.querySelector(".kit-tooltip__title")?.textContent).toBe("Tue 12:00");

    press(frame, "Escape");
    expect(view.container.querySelector(".kit-heat-grid-cell--dimmed")).toBeNull();
    expect(view.container.querySelector(".kit-heat-grid-cell--active")).toBeNull();
    expect(view.container.querySelector(".kit-heat-grid-lift")).toBeNull();
    view.unmount();
  });
});

describe("HeatGrid dig-in", () => {
  /** The grid inside a page that can generate (a DrillProvider). */
  function Asking({ onAsk, ...grid }: HeatGridProps & { onAsk: (prompt: string) => void }) {
    return createElement(DrillProvider, { onAsk, children: createElement(HeatGrid, grid) });
  }
  const frameOf = (container: HTMLElement) =>
    container.querySelector<HTMLElement>(".kit-heat-grid-frame")!;
  /** Clicks inside cell k (row-major); the frame is at 0,0 in jsdom. */
  const clickCell = (container: HTMLElement, k: number) => {
    const cell = container.querySelectorAll(".kit-heat-grid-cell")[k]!;
    const clientX = Number(cell.getAttribute("x")) + 3;
    const clientY = Number(cell.getAttribute("y")) + 3;
    act(() => {
      frameOf(container).dispatchEvent(
        new MouseEvent("click", { bubbles: true, clientX, clientY, detail: 1 }),
      );
    });
  };
  const menu = () => document.querySelector(".kit-drill");
  const heading = () => menu()!.querySelector(".kit-drill__head")!.textContent;
  const questions = () =>
    [...document.querySelectorAll(".kit-drill__ask")].map((b) => b.textContent);

  it("offers the clicked cell in the grid's unit, with the slot before", () => {
    const onAsk = vi.fn();
    const view = mount(Asking, { ...props, onAsk });
    clickCell(view.container, 4); // Tue 12:00
    expect(heading()).toBe("Tue 12:00 · Orders 0");
    expect(questions()).toEqual(["Why was Orders 0 at Tue 12:00?", "Break down Tue 12:00"]);
    act(() => {
      menu()!.querySelector("button")!.click();
    });
    expect(onAsk.mock.calls[0]![0]).toMatch(/^Why was Orders 0 at Tue 12:00 \(3 at Tue 09:00\)\? /);
    view.unmount();
  });

  it("offers the active cell on Enter and hints in the tooltip", () => {
    const view = mount(Asking, { ...props, unit: undefined, onAsk: vi.fn() });
    const frame = frameOf(view.container);
    expect(frame.classList).toContain("kit-heat-grid-frame--drill");
    act(() => frame.focus());
    press(frame, "ArrowRight"); // Mon 09:00
    press(frame, "ArrowRight"); // Mon 12:00
    expect(document.querySelector(".kit-tooltip__hint")?.textContent).toBe("Click to ask why");
    press(frame, "Enter");
    // No unit: the measure reads as a plain value.
    expect(questions()[0]).toBe("Why was Value 4 at Mon 12:00?");
    view.unmount();
  });

  it("offers nothing outside a provider: no menu, no hint", () => {
    const view = mount(HeatGrid, props);
    const frame = frameOf(view.container);
    expect(frame.classList).not.toContain("kit-heat-grid-frame--drill");
    clickCell(view.container, 4);
    act(() => frame.focus());
    press(frame, "ArrowRight");
    press(frame, "Enter");
    expect(menu()).toBeNull();
    expect(document.querySelector(".kit-tooltip")).not.toBeNull();
    expect(document.querySelector(".kit-tooltip__hint")).toBeNull();
    view.unmount();
  });
});
