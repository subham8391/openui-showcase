// @vitest-environment jsdom
import { act } from "react";
import { beforeAll, describe, expect, it } from "vitest";
import { installDom, mount } from "../../engine/test/testDom";
import { HeatGrid } from "./HeatGrid";

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
