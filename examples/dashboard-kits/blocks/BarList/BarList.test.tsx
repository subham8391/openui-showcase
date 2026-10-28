// @vitest-environment jsdom
import { act, createElement } from "react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { installDom, mount } from "../../engine/test/testDom";
import { DrillProvider } from "../Drill";
import { BarList, type BarListProps } from "./BarList";

beforeAll(() => installDom());

const items = [
  { name: "France", key: "fr", value: 12400, change: 8 },
  { name: "Spain", key: "es", value: 9100 },
  { name: "Other", value: 3000 },
];

/** The list inside a page that can generate (a DrillProvider). */
function Asking({ onAsk, ...list }: BarListProps & { onAsk: (prompt: string) => void }) {
  return createElement(DrillProvider, { onAsk, children: createElement(BarList, list) });
}

const rowButton = (container: HTMLElement, name: string) =>
  [...container.querySelectorAll<HTMLButtonElement>("button.kit-barlist__row")].find((b) =>
    b.textContent?.includes(name),
  );
const clickAt = (el: Element, detail: number) =>
  act(() => {
    el.dispatchEvent(new MouseEvent("click", { bubbles: true, clientX: 40, clientY: 20, detail }));
  });
const menu = () => document.querySelector(".kit-drill");
const heading = () => menu()!.querySelector(".kit-drill__head")!.textContent;
const questions = () => [...document.querySelectorAll(".kit-drill__ask")].map((b) => b.textContent);

describe("BarList dig-in", () => {
  it("offers a clicked row by its own name, with its change", () => {
    const onAsk = vi.fn();
    const view = mount(Asking, { items, format: "currency", onAsk });
    clickAt(rowButton(view.container, "France")!, 1);
    expect(heading()).toBe("France · $12.4K");
    expect(questions()).toEqual(["Why was France $12.4K?", "Break down France"]);
    act(() => {
      menu()!.querySelector("button")!.click();
    });
    expect(onAsk.mock.calls[0]![0]).toMatch(/^Why was France \$12\.4K \(\+8\.0%\)\? /);
    view.unmount();
  });

  it("opens from Enter or Space on a row, and gives focus back on Escape", () => {
    const view = mount(Asking, { items, format: "currency", onAsk: vi.fn() });
    const row = rowButton(view.container, "Spain")!;
    act(() => row.focus());
    // A keyboard press on a button is a click with no pointer detail.
    clickAt(row, 0);
    expect(questions()[1]).toBe("Break down Spain");
    expect(document.activeElement?.closest(".kit-drill")).not.toBeNull();
    act(() => {
      menu()!.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });
    expect(document.activeElement).toBe(row);
    view.unmount();
  });

  it("keeps a filtering row's click as the filter, and asks about rows with no filter key", () => {
    const onSelect = vi.fn();
    const view = mount(Asking, { items, format: "currency", onSelect, onAsk: vi.fn() });
    clickAt(rowButton(view.container, "France")!, 1);
    expect(onSelect).toHaveBeenCalledWith("fr");
    expect(menu()).toBeNull();
    clickAt(rowButton(view.container, "Other")!, 1);
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(heading()).toBe("Other · $3,000");
    view.unmount();
  });

  it("offers nothing outside a provider: plain rows stay plain", () => {
    const view = mount(BarList, { items, format: "currency" });
    expect(view.container.querySelector("button")).toBeNull();
    clickAt(view.container.querySelector(".kit-barlist__row")!, 1);
    expect(menu()).toBeNull();
    view.unmount();
  });
});
