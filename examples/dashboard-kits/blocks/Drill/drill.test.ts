// @vitest-environment jsdom
import { beforeAll, describe, expect, it } from "vitest";
import { installDom } from "../../engine/test/testDom";
import { drillMetric, drillPlaceOf, drillQuestions, isWhen, type DrillTarget } from "./drill";

beforeAll(() => installDom());

const place = { dashboard: "Store overview", chart: "Orders by day" };

describe("drillQuestions", () => {
  it("asks why a day was what it was, and to break it down", () => {
    const target: DrillTarget = {
      kind: "point",
      metric: "Orders",
      label: "Oct 3",
      value: "530",
      previous: { label: "Oct 2", value: "480" },
    };
    const [why, breakdown] = drillQuestions(target, place);
    expect(why!.label).toBe("Why was Orders 530 on Oct 3?");
    expect(why!.prompt).toBe(
      "Why was Orders 530 on Oct 3 (480 on Oct 2)? It's from the “Orders by day” chart on the “Store overview” dashboard. Build a dashboard that explains what drove it.",
    );
    expect(breakdown!.label).toBe("Break down Oct 3");
    expect(breakdown!.prompt).toContain("Break down Orders for Oct 3 (530)");
    expect(breakdown!.prompt).toContain("a usual day");
  });

  it("asks what drove a range and compares it with the period before", () => {
    const [why, compare] = drillQuestions(
      {
        kind: "range",
        metric: "Sales",
        label: "Sep 13 → Sep 27",
        value: "$55K → $61K",
        change: "+10.8%",
      },
      place,
    );
    expect(why!.label).toBe("What drove Sales over Sep 13 → Sep 27?");
    expect(why!.prompt).toContain("What drove Sales from Sep 13 to Sep 27 ($55K → $61K, +10.8%)?");
    expect(compare!.label).toBe("Compare Sep 13 → Sep 27 with the period before");
  });

  it("says “at” for a grid cell and compares it with a usual slot", () => {
    const [why, breakdown] = drillQuestions({
      kind: "cell",
      metric: "Orders",
      label: "Wed 14:00",
      value: "412",
    });
    expect(why!.label).toBe("Why was Orders 412 at Wed 14:00?");
    expect(why!.prompt).toContain("It's from a chart.");
    expect(breakdown!.prompt).toContain("a usual slot");
  });

  it("asks about a part by its own name, against its comparison or the other parts", () => {
    const [why, breakdown] = drillQuestions(
      {
        kind: "part",
        metric: "Web",
        label: "Web",
        value: "+$316",
        previous: { label: "Plan", value: "+$290" },
      },
      place,
    );
    expect(why!.label).toBe("Why was Web +$316?");
    expect(why!.prompt).toMatch(/^Why was Web \+\$316 \(Plan: \+\$290\)\? It's from the “Orders/);
    expect(breakdown!.label).toBe("Break down Web");
    expect(breakdown!.prompt).toContain("Break down Web (+$316): ");
    expect(breakdown!.prompt).toContain("compares with Plan.");

    const [row, rowBreakdown] = drillQuestions({
      kind: "part",
      metric: "Revenue",
      label: "France",
      value: "$12.4K",
      change: "+8.0%",
    });
    expect(row!.label).toBe("Why was France $12.4K?");
    expect(row!.prompt).toMatch(/^Why was France \$12\.4K \(\+8\.0%\)\? /);
    expect(rowBreakdown!.prompt).toContain("compares with the other parts.");
  });

  it("names a part called for its period (a walk's total) by its card", () => {
    const [why] = drillQuestions(
      { kind: "part", metric: "This period", label: "This period", value: "$61K" },
      place,
    );
    expect(why!.label).toBe("Why was Orders by day $61K?");
  });

  it("cuts a long menu label on a word boundary, never the prompt", () => {
    const label = "Weekly active users across every workspace and plan";
    const [why] = drillQuestions({ kind: "point", metric: label, label: "Oct 3", value: "61.0K" });
    expect(why!.label.length).toBeLessThanOrEqual(64);
    expect(why!.label.endsWith("…")).toBe(true);
    expect(why!.prompt).toContain(label);
  });
});

describe("drillQuestions for a category", () => {
  it("says “for” a label that isn't a time, and names its axis in the prompt", () => {
    const [why, breakdown] = drillQuestions({
      kind: "point",
      metric: "Active users",
      label: "4",
      value: "8.2%",
      previous: { label: "3", value: "11.0%" },
      axis: "Days active in the last 7 days",
    });
    expect(why!.label).toBe("Why was Active users 8.2% for 4?");
    expect(why!.prompt).toContain(
      "Why was Active users 8.2% for 4 (Days active in the last 7 days) (11.0% for 3)?",
    );
    expect(breakdown!.prompt).toContain("compares with its neighbours");
  });

  it("knows a time when it sees one", () => {
    for (const t of ["Oct 3", "Wed", "14:00", "2026", "Q3", "Week 12", "W12", "10/3", "Today"]) {
      expect(isWhen(t), t).toBe(true);
    }
    for (const c of ["4", "Web", "Free plan", "France", "Monday-ish signups"]) {
      expect(isWhen(c), c).toBe(c === "Monday-ish signups");
    }
  });
});

describe("drillMetric", () => {
  it("names a period-only series by its card", () => {
    for (const name of ["This period", "Prior period", "Current", "Last year"]) {
      expect(drillMetric({ kind: "point", metric: name, label: "Oct 3" }, place)).toBe(
        "Orders by day",
      );
    }
  });

  it("keeps a real series name, and a period name with no card to replace it", () => {
    expect(drillMetric({ kind: "point", metric: "Web", label: "Oct 3" }, place)).toBe("Web");
    expect(drillMetric({ kind: "point", metric: "This period", label: "Oct 3" })).toBe(
      "This period",
    );
  });
});

describe("drillPlaceOf", () => {
  it("reads the card's header title and the dashboard's title", () => {
    document.body.innerHTML = `
      <div class="canvas">
        <div class="c1-dashboard-header">Store overview
Oct 1 – Oct 10</div>
        <div class="c1-shell-card">
          <div class="c1-dashboard-card-header__content">Orders by day
Placed orders, all channels</div>
          <div id="chart"></div>
        </div>
        <div class="c1-shell-card"><span class="kit-hero__label">Net sales</span><div id="hero"></div></div>
      </div>`;
    expect(drillPlaceOf(document.getElementById("chart"))).toEqual({
      dashboard: "Store overview",
      chart: "Orders by day",
    });
    expect(drillPlaceOf(document.getElementById("hero")).chart).toBe("Net sales");
    expect(drillPlaceOf(null)).toEqual({});
  });
});
