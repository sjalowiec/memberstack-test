import { describe, expect, it, vi } from "vitest";

import {
  buildOrdersFragmentUrl,
  extractOrdersFragmentHtml,
  formatOrdersSectionHeading,
  getOrdersSectionElements,
  initMemberOrdersSection,
  isOrdersSectionExpanded,
  loadOrdersFragment,
  ORDERS_SECTION_HIDE_LABEL,
  ORDERS_SECTION_SHOW_LABEL,
  renderEmptyOrdersPlaceholder,
  setOrdersSectionExpanded,
} from "./watsonMemberOrdersSection";

type DomElement = {
  hidden: boolean;
  innerHTML: string;
  dataset: Record<string, string>;
  setAttribute: (name: string, value: string) => void;
  getAttribute: (name: string) => string | null;
  textContent: string;
  disabled: boolean;
  addEventListener: (type: string, listener: () => void | Promise<void>) => void;
  querySelector: (selector: string) => DomElement | null;
};

function createToggle(): DomElement {
  const attrs = new Map<string, string>([["aria-expanded", "false"]]);
  let clickListener: (() => void | Promise<void>) | null = null;
  return {
    hidden: false,
    innerHTML: "",
    dataset: {},
    disabled: false,
    textContent: ORDERS_SECTION_SHOW_LABEL,
    setAttribute(name, value) {
      attrs.set(name, value);
    },
    getAttribute(name) {
      return attrs.get(name) ?? null;
    },
    addEventListener(type, listener) {
      if (type === "click") {
        clickListener = listener;
      }
    },
    querySelector() {
      return null;
    },
    async click() {
      await clickListener?.();
    },
  };
}

function createPanel(): DomElement {
  return {
    hidden: true,
    innerHTML: "",
    dataset: {},
    disabled: false,
    textContent: "",
    setAttribute() {},
    getAttribute() {
      return null;
    },
    addEventListener() {},
    querySelector() {
      return null;
    },
  };
}

function createSection(toggle: DomElement, panel: DomElement): DomElement {
  return {
    hidden: false,
    innerHTML: "",
    dataset: {},
    disabled: false,
    textContent: "",
    setAttribute() {},
    getAttribute() {
      return null;
    },
    addEventListener() {},
    querySelector(selector: string) {
      if (selector === "[data-watson-orders-section-toggle]") {
        return toggle;
      }
      if (selector === "[data-watson-orders-panel]") {
        return panel;
      }
      return null;
    },
  };
}

describe("watsonMemberOrdersSection", () => {
  it("formats the collapsed section heading with order count", () => {
    expect(formatOrdersSectionHeading(27)).toBe("Orders (27)");
    expect(formatOrdersSectionHeading(0)).toBe("Orders (0)");
  });

  it("builds a fragment URL for lazy order loading", () => {
    expect(buildOrdersFragmentUrl("abc-123")).toBe("/watson/members/abc-123/orders-fragment");
  });

  it("extracts fragment HTML from a full document response", () => {
    expect(
      extractOrdersFragmentHtml("<html><body><table>orders</table></body></html>"),
    ).toContain("<table>orders</table>");
  });

  it("starts collapsed with Show orders label and hidden panel", () => {
    const toggle = createToggle();
    const panel = createPanel();
    const section = createSection(toggle, panel);

    initMemberOrdersSection(section as unknown as HTMLElement, {
      orderCount: 3,
      fragmentUrl: "/watson/members/test/orders-fragment",
    });

    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(toggle.textContent).toBe(ORDERS_SECTION_SHOW_LABEL);
    expect(panel.hidden).toBe(true);
    expect(panel.innerHTML).toBe("");
  });

  it("expands and lazy-loads orders on first Show orders click", async () => {
    const toggle = createToggle();
    const panel = createPanel();
    const section = createSection(toggle, panel);
    const initOrdersTable = vi.fn();
    const fetchHtml = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => "<html><body><table data-sortable-table></table></body></html>",
    });

    initMemberOrdersSection(section as unknown as HTMLElement, {
      orderCount: 2,
      fragmentUrl: "/watson/members/test/orders-fragment",
      fetchHtml,
      initOrdersTable,
    });

    await toggle.click();

    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(toggle.textContent).toBe(ORDERS_SECTION_HIDE_LABEL);
    expect(panel.hidden).toBe(false);
    expect(fetchHtml).toHaveBeenCalledWith("/watson/members/test/orders-fragment", {
      credentials: "same-origin",
    });
    expect(panel.innerHTML).toContain("data-sortable-table");
    expect(initOrdersTable).toHaveBeenCalledTimes(1);
  });

  it("hides orders again without refetching", async () => {
    const toggle = createToggle();
    const panel = createPanel();
    panel.dataset.ordersLoaded = "true";
    panel.innerHTML = "<table data-sortable-table></table>";
    const section = createSection(toggle, panel);
    const fetchHtml = vi.fn();

    initMemberOrdersSection(section as unknown as HTMLElement, {
      orderCount: 2,
      fragmentUrl: "/watson/members/test/orders-fragment",
      fetchHtml,
    });

    setOrdersSectionExpanded(toggle as unknown as HTMLButtonElement, panel as unknown as HTMLElement, true);
    await toggle.click();

    expect(isOrdersSectionExpanded(toggle as unknown as HTMLButtonElement)).toBe(false);
    expect(panel.hidden).toBe(true);
    expect(fetchHtml).not.toHaveBeenCalled();
  });

  it("renders the empty placeholder locally when order count is zero", async () => {
    const toggle = createToggle();
    const panel = createPanel();
    const section = createSection(toggle, panel);
    const fetchHtml = vi.fn();

    initMemberOrdersSection(section as unknown as HTMLElement, {
      orderCount: 0,
      fragmentUrl: "/watson/members/test/orders-fragment",
      fetchHtml,
    });

    await toggle.click();

    expect(panel.innerHTML).toBe(renderEmptyOrdersPlaceholder());
    expect(fetchHtml).not.toHaveBeenCalled();
  });

  it("finds section toggle and panel elements", () => {
    const toggle = createToggle();
    const panel = createPanel();
    const section = createSection(toggle, panel);

    const elements = getOrdersSectionElements(section as unknown as HTMLElement);
    expect(elements?.toggle).toBe(toggle);
    expect(elements?.panel).toBe(panel);
  });
});
