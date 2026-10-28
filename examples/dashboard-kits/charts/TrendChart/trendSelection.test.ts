import { describe, expect, it } from "vitest";
import {
  changeUnit,
  extendSelection,
  isDrag,
  isSummable,
  selectionBand,
  selectionReadout,
  selectionSpan,
  snapToIndex,
  summarizeSelection,
} from "./trendSelection";

const NaN_ = Number.NaN;

describe("selection geometry", () => {
  const xs = [10, 30, 50, 70, 90];

  it("snaps a pointer x to the nearest point, clamping past either end", () => {
    expect(snapToIndex(29, xs)).toBe(1);
    expect(snapToIndex(41, xs)).toBe(2);
    expect(snapToIndex(-500, xs)).toBe(0);
    expect(snapToIndex(5000, xs)).toBe(4);
  });

  it("orders a reversed drag and clamps out-of-range indexes", () => {
    expect(selectionSpan({ anchor: 3, focus: 1 }, 5)).toEqual([1, 3]);
    expect(selectionSpan({ anchor: 1, focus: 3 }, 5)).toEqual([1, 3]);
    expect(selectionSpan({ anchor: -2, focus: 9 }, 5)).toEqual([0, 4]);
    expect(selectionSpan({ anchor: 2, focus: 2 }, 5)).toEqual([2, 2]);
  });

  it("spans the band between the two selected points, whichever way it was drawn", () => {
    expect(selectionBand([1, 3], xs)).toEqual({ x: 30, width: 40 });
    expect(selectionBand([2, 2], xs)).toEqual({ x: 50, width: 0 });
  });

  it("tells a click from a drag by the threshold", () => {
    expect(isDrag(100, 102)).toBe(false);
    expect(isDrag(100, 96)).toBe(true);
  });

  it("extends from the current point, then moves only the free end, clamped", () => {
    const first = extendSelection(null, 2, 1, 5);
    expect(first).toEqual({ anchor: 2, focus: 3 });
    expect(extendSelection(first, 3, 1, 5)).toEqual({ anchor: 2, focus: 4 });
    expect(extendSelection({ anchor: 2, focus: 4 }, 4, 1, 5)).toEqual({ anchor: 2, focus: 4 });
    // Back past the anchor: the span flips to the other side.
    expect(selectionSpan(extendSelection({ anchor: 2, focus: 2 }, 2, -1, 5), 5)).toEqual([1, 2]);
    // Nothing hovered: start at the end the arrow points away from.
    expect(extendSelection(null, null, 1, 5)).toEqual({ anchor: 0, focus: 1 });
    expect(extendSelection(null, null, -1, 5)).toEqual({ anchor: 4, focus: 3 });
  });
});

describe("readout maths", () => {
  it("uses pts for rates and % for everything else", () => {
    expect(changeUnit("percent")).toBe("pts");
    expect(changeUnit("currency")).toBe("%");
    expect(changeUnit("number")).toBe("%");
    expect(changeUnit("ratio")).toBe("%");
    expect(changeUnit("duration")).toBe("%");
  });

  it("totals only counts and currency", () => {
    expect(isSummable("number")).toBe(true);
    expect(isSummable("currency")).toBe(true);
    expect(isSummable("percent")).toBe(false);
    expect(isSummable("ratio")).toBe(false);
    expect(isSummable("duration")).toBe(false);
  });

  it("reads a currency span: change in % and a total", () => {
    const s = summarizeSelection([100, 120, 150, 200], [0, 3], "currency")!;
    expect(s.change).toBeCloseTo(100);
    expect(s.total).toBe(570);
    const r = selectionReadout([100, 120, 150, 200], ["a", "b", "c", "d"], [0, 3], "currency");
    expect(r.text).toBe("a → d: $100 → $200 · +100.0% · $570 total");
  });

  it("reads a rate span in points, with no total", () => {
    const values = [3.1, 3.2, 3.4];
    const s = summarizeSelection(values, [0, 2], "percent")!;
    expect(s.change).toBeCloseTo(0.3);
    expect(s.total).toBeUndefined();
    expect(selectionReadout(values, ["a", "b", "c"], [0, 2], "percent").text).toBe(
      "a → c: 3.1% → 3.4% · +0.3 pts",
    );
  });

  it("reads a ratio as a relative change with no total", () => {
    expect(selectionReadout([2, 3], ["a", "b"], [0, 1], "ratio").text).toBe(
      "a → b: 2.00x → 3.00x · +50.0%",
    );
  });

  it("drops the % change from a zero start", () => {
    const s = summarizeSelection([0, 5], [0, 1], "number")!;
    expect(s.change).toBeUndefined();
    expect(selectionReadout([0, 5], ["a", "b"], [0, 1], "number").text).toBe(
      "a → b: 0 → 5 · 5 total",
    );
  });

  it("skips gaps: reads from the first to the last day with data and sums only those", () => {
    const values = [NaN_, 10, NaN_, 20, NaN_];
    const s = summarizeSelection(values, [0, 4], "number")!;
    expect([s.startIndex, s.endIndex]).toEqual([1, 3]);
    expect(s.total).toBe(30);
    expect(selectionReadout(values, ["a", "b", "c", "d", "e"], [0, 4], "number").text).toBe(
      "b → d: 10 → 20 · +100.0% · 30 total",
    );
  });

  it("reads a span with no data, and one with a single day of data", () => {
    const values = [NaN_, NaN_, 7, NaN_];
    const labels = ["a", "b", "c", "d"];
    expect(summarizeSelection(values, [0, 1], "number")).toBeUndefined();
    expect(selectionReadout(values, labels, [0, 1], "number").text).toBe("a → b: no data");
    expect(selectionReadout(values, labels, [1, 3], "number").text).toBe("c: 7");
  });

  it("reads a single-point selection as just that point's value", () => {
    expect(selectionReadout([4, 5], ["a", "b"], [1, 1], "currency").text).toBe("b: $5");
  });

  it("marks an in-progress last point", () => {
    expect(
      selectionReadout([1, 2], ["a", "b"], [0, 1], "number", { index: 1, note: "in progress" })
        .text,
    ).toBe("a → b (in progress): 1 → 2 · +100.0% · 3 total");
  });
});
