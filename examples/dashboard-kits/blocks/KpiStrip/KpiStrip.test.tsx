// @vitest-environment jsdom
import { act } from "react";
import { beforeAll, describe, expect, it } from "vitest";
import type { Kpi } from "../../engine/schemas";
import { installDom, mount, runFrames } from "../../engine/test/testDom";
import { KpiStrip } from "./KpiStrip";

beforeAll(() => installDom());

const labels = ["Oct 1", "Oct 2", "Oct 3"];
const sales: Kpi = {
  label: "Total sales",
  value: "$123.0K",
  previous: "$110.0K",
  change: 11.8,
  trend: {
    labels,
    current: [40000, 41000, 42000],
    previous: [38000, 41000, 40000],
    format: "currency",
  },
};
const orders: Kpi = {
  label: "Orders",
  value: "1,530",
  previous: "1,400",
  change: 9.3,
  // Two days only, and no comparison: it follows by date and shows no change.
  trend: { labels: labels.slice(1), current: [500, 530], format: "number" },
};

function frames() {
  act(() => {
    runFrames();
  });
}
function pointer(el: Element, type: string, clientX: number) {
  act(() => {
    el.dispatchEvent(new PointerEvent(type, { clientX, clientY: 10, pointerId: 1, bubbles: true }));
  });
  frames();
}
/** React reads a pointer leaving from `pointerout` to an element outside. */
function leave(el: Element) {
  act(() => {
    el.dispatchEvent(
      new PointerEvent("pointerout", { relatedTarget: document.body, pointerId: 1, bubbles: true }),
    );
  });
  frames();
}
function key(el: Element, k: string) {
  act(() => {
    el.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true }));
  });
  frames();
}

function setup(metrics = [sales, orders]) {
  const view = mount(KpiStrip, { metrics });
  frames();
  const tiles = [...view.container.querySelectorAll<HTMLElement>(".kit-kpi")];
  const sparks = tiles.map((t) => t.querySelector<HTMLElement>(".kit-sparkline-frame")!);
  // The value's text for assistive tech is the value itself, not the rolling digits.
  const value = (t: number) => tiles[t]!.querySelector(".kit-kpi__value .kit-sr")!.textContent;
  const date = (t: number) => tiles[t]!.querySelector(".kit-kpi__date")?.textContent ?? null;
  const meta = (t: number) => tiles[t]!.querySelector(".kit-kpi__meta")!;
  const active = (t: number) =>
    [...tiles[t]!.querySelectorAll(".kit-sparkline-bar")].findIndex((b) =>
      b.classList.contains("kit-sparkline-bar--active"),
    );
  return { view, tiles, sparks, value, date, meta, active };
}

describe("KpiStrip reads the hovered day", () => {
  it("shows that day's value, change, comparison, and date, then the latest on leave", () => {
    const { view, sparks, value, date, meta } = setup();
    expect(value(0)).toBe("$123.0K");
    expect(date(0)).toBeNull();

    // 800px wide, three points: x = 3 is the first day.
    pointer(sparks[0]!, "pointermove", 3);
    expect(value(0)).toBe("$40.0K");
    expect(date(0)).toBe("Oct 1");
    expect(meta(0).textContent).toContain("5.3%");
    expect(meta(0).textContent).toContain("vs $38.0K");
    // The live readout says it once, from the sparkline under the pointer.
    expect(sparks[0]!.parentElement!.querySelector("[aria-live]")!.textContent).toBe(
      "Oct 1: $40.0K",
    );

    leave(sparks[0]!);
    expect(value(0)).toBe("$123.0K");
    expect(date(0)).toBeNull();
    expect(meta(0).textContent).toContain("vs $110.0K");
    view.unmount();
  });

  it("moves only the hovered tile; the others keep their latest figures", () => {
    const { view, sparks, value, date, meta, active } = setup();
    // Oct 3 on the orders bars: that tile reads the day, the sales tile doesn't move.
    pointer(sparks[1]!, "pointermove", 790);
    expect(date(1)).toBe("Oct 3");
    expect(value(1)).toBe("530");
    expect(active(1)).toBe(1);
    // No comparison that day: no change shown.
    expect(meta(1).querySelector(".kit-kpi__previous")).toBeNull();
    expect(date(0)).toBeNull();
    expect(value(0)).toBe("$123.0K");
    expect(active(0)).toBe(-1);
    // Only the sparkline under the pointer speaks.
    expect(sparks[0]!.parentElement!.querySelector("[aria-live]")!.textContent).toBe("");

    // Moving to the sales line hands the reading over.
    leave(sparks[1]!);
    pointer(sparks[0]!, "pointermove", 400);
    expect(date(0)).toBe("Oct 2");
    expect(value(0)).toBe("$41.0K");
    expect(date(1)).toBeNull();
    expect(value(1)).toBe("1,530");
    view.unmount();
  });

  it("walks the days with the arrow keys from a focused sparkline", () => {
    const { view, sparks, value, date } = setup();
    const frame = sparks[0]!;
    expect(frame.tabIndex).toBe(0);
    expect(frame.getAttribute("aria-label")).toMatch(/Total sales.*Oct 1 to Oct 3.*arrow keys/);

    act(() => frame.focus());
    key(frame, "ArrowRight");
    expect(date(0)).toBe("Oct 1");
    key(frame, "ArrowRight");
    expect(date(0)).toBe("Oct 2");
    expect(date(1)).toBeNull();
    key(frame, "ArrowLeft");
    expect(value(0)).toBe("$40.0K");
    key(frame, "End");
    expect(date(0)).toBe("Oct 3");
    expect(date(1)).toBeNull();
    key(frame, "Escape");
    expect(date(0)).toBeNull();
    expect(value(0)).toBe("$123.0K");
    view.unmount();
  });

  it("keeps a tab tile selectable while its sparkline is its own focus stop", () => {
    let picked = "";
    const view = mount(KpiStrip, {
      metrics: [sales],
      onSelect: (l: string) => {
        picked = l;
      },
    });
    frames();
    const button = view.container.querySelector<HTMLButtonElement>(".kit-kpi__select")!;
    expect(button.querySelector(".kit-sparkline")).toBeNull();
    act(() => button.click());
    expect(picked).toBe("Total sales");
    view.unmount();
  });
});
