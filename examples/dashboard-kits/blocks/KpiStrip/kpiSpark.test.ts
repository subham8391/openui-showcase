import { describe, expect, it } from "vitest";
import type { Kpi, Trend } from "../../engine/schemas";
import { formatLike, sparkPoints, sparkVariant, tileDay } from "./kpiSpark";

const trend = (current: number[], extra: Partial<Trend> = {}): Trend => ({
  labels: current.map((_, i) => `Oct ${i + 1}`),
  current,
  ...extra,
});
const kpi = (value: string, t: Trend | undefined, series?: number[]): Kpi => ({
  label: "Metric",
  value,
  ...(t ? { trend: t } : {}),
  ...(series ? { series } : {}),
});
const variantOf = (k: Kpi) => sparkVariant(k, sparkPoints(k)!);

describe("sparkline variant", () => {
  it("draws counts as bars", () => {
    expect(variantOf(kpi("15.8K", trend([510.4, 498.2, 530.9], { format: "number" })))).toBe(
      "bars",
    );
    // A bare series of whole numbers reads as a count too.
    expect(variantOf(kpi("12", undefined, [3, 5, 4, 2]))).toBe("bars");
  });

  it("draws a series that crosses zero as diverging bars", () => {
    expect(variantOf(kpi("+2,292", trend([120, -40, 85], { format: "number" })))).toBe("diverging");
    expect(variantOf(kpi("$12.4K", trend([1200, -300, 450], { format: "currency" })))).toBe(
      "diverging",
    );
  });

  it("keeps rates, money, ratios, and per-user figures as a line", () => {
    expect(variantOf(kpi("$1.26M", trend([41000, 42000], { format: "currency" })))).toBe("line");
    expect(variantOf(kpi("3.23%", trend([3.1, 3.3], { format: "percent" })))).toBe("line");
    expect(variantOf(kpi("3.93x", trend([3.8, 4.1], { format: "ratio" })))).toBe("line");
    // A "number" trend that isn't a bare count is a rate.
    expect(variantOf(kpi("3.4 / week", trend([3.2, 3.6], { format: "number" })))).toBe("line");
    // A bare count whose series isn't whole numbers, with no format to say so.
    expect(variantOf(kpi("124.0K", undefined, [123.4, 124.1]))).toBe("line");
  });
});

describe("tile day", () => {
  const k = kpi(
    "$1.26M",
    trend([41000, 39000, 43000], {
      format: "currency",
      previous: [40000, 39000, 0],
      partial: true,
    }),
  );
  const points = sparkPoints(k)!;

  it("shows that day's value, change, and comparison", () => {
    expect(tileDay(k, points, 0)).toEqual({
      value: "$41.0K",
      date: "Oct 1",
      change: 2.5,
      previous: "$40.0K",
    });
  });

  it("marks today's point as still in progress", () => {
    expect(tileDay(k, points, 2)!.date).toBe("Oct 3 · so far");
  });

  it("leaves the change out when the comparison has no value that day", () => {
    const noPrev = kpi("$1.26M", trend([41000, 39000], { format: "currency" }));
    expect(tileDay(noPrev, sparkPoints(noPrev)!, 1)).toEqual({ value: "$39.0K", date: "Oct 2" });
  });

  it("has nothing for a bare series with no dates", () => {
    const bare = kpi("12", undefined, [3, 5, 4]);
    expect(tileDay(bare, sparkPoints(bare)!, 1)).toBeUndefined();
  });
});

describe("formatLike", () => {
  it("prints a day the way the KPI prints its value", () => {
    expect(formatLike(35.24, "36.1%", "percent")).toBe("35.2%");
    expect(formatLike(3.104, "3.23%", "percent")).toBe("3.10%");
    expect(formatLike(3.8, "3.93x", "ratio")).toBe("3.80x");
    expect(formatLike(3.62, "3.4 / week", "number")).toBe("3.6 / week");
    expect(formatLike(527.4, "15.8K", "number")).toBe("527");
    expect(formatLike(-34, "+2,292", "number")).toBe("−34");
    expect(formatLike(76, "+2,292", "number")).toBe("+76");
    expect(formatLike(76.254, "$76.25", "currency")).toBe("$76.25");
  });
});
