// @vitest-environment jsdom
import { act, createElement, useRef } from "react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { installDom, mount } from "../../engine/test/testDom";
import type { DrillTarget } from "./drill";
import { DrillProvider, useDrill } from "./DrillProvider";

beforeAll(() => installDom());

const target: DrillTarget = { kind: "point", metric: "Orders", label: "Oct 3", value: "530" };

/** A stand-in chart: a focusable frame that offers its point on click. */
function Chart() {
  const drill = useDrill();
  const frame = useRef<HTMLDivElement>(null);
  return createElement(
    "div",
    {
      ref: frame,
      tabIndex: 0,
      className: "chart",
      "data-drill": drill ? "on" : "off",
      onClick: () => drill?.offer(target, { x: 40, y: 40 }, frame.current!),
    },
    "chart",
  );
}

function Page({ onAsk, disabled }: { onAsk: (p: string) => void; disabled?: boolean }) {
  return createElement(
    "div",
    { className: "kit-theme", "data-mode": "light" },
    createElement(DrillProvider, { onAsk, disabled, children: createElement(Chart) }),
  );
}

const menu = () => document.querySelector<HTMLElement>(".kit-drill");
const click = (el: Element) =>
  act(() => {
    el.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });

describe("DrillProvider", () => {
  it("opens the menu on a chart's offer and asks the picked question", () => {
    const onAsk = vi.fn();
    const view = mount(Page, { onAsk });
    expect(menu()).toBeNull();
    click(view.container.querySelector(".chart")!);

    const panel = menu()!;
    expect(panel.closest(".kit-layer")).not.toBeNull();
    expect(view.container.contains(panel)).toBe(false);
    expect(panel.querySelector(".kit-drill__head")!.textContent).toBe("Oct 3 · Orders 530");
    const buttons = [...panel.querySelectorAll("button")];
    expect(buttons.map((b) => b.textContent)).toEqual([
      "Why was Orders 530 on Oct 3?",
      "Break down Oct 3",
    ]);
    // The first question takes focus, so Enter asks it.
    expect(document.activeElement).toBe(buttons[0]);

    click(buttons[1]!);
    expect(onAsk).toHaveBeenCalledTimes(1);
    expect(onAsk.mock.calls[0]![0]).toContain("Break down Orders for Oct 3 (530)");
    expect(menu()).toBeNull();
    view.unmount();
  });

  it("closes on Escape, giving focus back to the chart, and on a press outside", () => {
    const view = mount(Page, { onAsk: vi.fn() });
    const chart = view.container.querySelector<HTMLElement>(".chart")!;
    click(chart);
    act(() => {
      menu()!.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });
    expect(menu()).toBeNull();
    expect(document.activeElement).toBe(chart);

    click(chart);
    expect(menu()).not.toBeNull();
    act(() => {
      document.body.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true }));
    });
    expect(menu()).toBeNull();
    view.unmount();
  });

  it("offers nothing while disabled, and charts outside a provider see no drill", () => {
    const view = mount(Page, { onAsk: vi.fn(), disabled: true });
    const chart = view.container.querySelector<HTMLElement>(".chart")!;
    expect(chart.dataset.drill).toBe("off");
    click(chart);
    expect(menu()).toBeNull();
    view.unmount();

    const bare = mount(Chart, {});
    expect(bare.container.querySelector<HTMLElement>(".chart")!.dataset.drill).toBe("off");
    bare.unmount();
  });
});
