import fs from "fs";
import path from "path";

import { describe, expect, it } from "vitest";

import {
  initWhatsNewCardStacks,
  initWhatsNewPublicBoard,
} from "./whatsNewPublicBoard";
import { WHATS_NEW_PUBLIC_COLUMN_INITIAL_LIMIT } from "../lib/whatsNew/types";

/**
 * Minimal DOM nodes for public board stack interactions — runs without jsdom.
 */
type AttrMap = Map<string, string>;

type StubNode = {
  id: string;
  className: string;
  textContent: string;
  attrs: AttrMap;
  children: StubNode[];
  style: { zIndex: string };
  listeners: Map<string, Array<() => void>>;
  classList: {
    contains: (name: string) => boolean;
    add: (name: string) => void;
    remove: (name: string) => void;
  };
  getAttribute: (name: string) => string | null;
  setAttribute: (name: string, value: string) => void;
  removeAttribute: (name: string) => void;
  hasAttribute: (name: string) => boolean;
  addEventListener: (type: string, fn: () => void) => void;
  click: () => void;
  querySelector: (selector: string) => StubNode | null;
  querySelectorAll: (selector: string) => StubNode[];
  matches: (selector: string) => boolean;
};

function createNode(initial: {
  id?: string;
  className?: string;
  textContent?: string;
  attrs?: Record<string, string>;
  children?: StubNode[];
}): StubNode {
  const attrs: AttrMap = new Map(Object.entries(initial.attrs ?? {}));
  const listeners = new Map<string, Array<() => void>>();
  let className = initial.className ?? "";
  const node: StubNode = {
    id: initial.id ?? "",
    get className() {
      return className;
    },
    set className(value: string) {
      className = value;
    },
    textContent: initial.textContent ?? "",
    attrs,
    children: initial.children ?? [],
    style: { zIndex: "" },
    listeners,
    classList: {
      contains: (name) => className.split(/\s+/).includes(name),
      add: (name) => {
        if (!className.split(/\s+/).includes(name)) {
          className = `${className} ${name}`.trim();
        }
      },
      remove: (name) => {
        className = className
          .split(/\s+/)
          .filter((part) => part && part !== name)
          .join(" ");
      },
    },
    getAttribute: (name) => attrs.get(name) ?? null,
    setAttribute: (name, value) => {
      attrs.set(name, value);
    },
    removeAttribute: (name) => {
      attrs.delete(name);
    },
    hasAttribute: (name) => attrs.has(name),
    addEventListener: (type, fn) => {
      const list = listeners.get(type) ?? [];
      list.push(fn);
      listeners.set(type, list);
    },
    click: () => {
      for (const fn of listeners.get("click") ?? []) fn();
    },
    querySelector(selector) {
      return this.querySelectorAll(selector)[0] ?? null;
    },
    querySelectorAll(selector) {
      const out: StubNode[] = [];
      const visit = (n: StubNode) => {
        if (n.matches(selector)) out.push(n);
        for (const child of n.children) visit(child);
      };
      for (const child of this.children) visit(child);
      return out;
    },
    matches(selector) {
      if (selector.startsWith("#")) return this.id === selector.slice(1);
      if (selector === "[data-wn-stack]") {
        return this.attrs.has("data-wn-stack");
      }
      if (selector === "[data-wn-stack-item]") {
        return this.attrs.has("data-wn-stack-item");
      }
      if (selector === "[data-wn-stack-toggle]") {
        return this.attrs.has("data-wn-stack-toggle");
      }
      if (selector === "[data-wn-stack-panel]") {
        return this.attrs.has("data-wn-stack-panel");
      }
      if (selector === "[data-wn-column-toggle]") {
        return this.attrs.has("data-wn-column-toggle");
      }
      return false;
    },
  };
  return node;
}

function isPanelHidden(panel: StubNode, pageCss: string): boolean {
  if (!panel.hasAttribute("hidden")) return false;
  return /\.whats-new__stack-panel\s*\[\s*hidden\s*\]\s*\{[^}]*display:\s*none\s*!important/.test(
    pageCss,
  );
}

function isCardHidden(card: StubNode, pageCss: string): boolean {
  if (!card.hasAttribute("hidden")) return false;
  return /\.whats-new__card\s*\[\s*hidden\s*\]\s*\{[^}]*display:\s*none\s*!important/.test(
    pageCss,
  );
}

function buildStackDom(
  totalCards: number,
  listId = "whats-new-cards-just_added",
  options: { initialVisible?: number } = {},
) {
  const initialVisible = options.initialVisible ?? totalCards;
  const items: StubNode[] = [];
  for (let i = 0; i < totalCards; i += 1) {
    const expanded = i === 0;
    const extraHidden = i >= initialVisible;
    const panel = createNode({
      id: `${listId}-panel-${i}`,
      className: "whats-new__stack-panel",
      attrs: {
        "data-wn-stack-panel": "",
        ...(expanded ? {} : { hidden: "" }),
      },
      children: [
        createNode({
          className: "whats-new__cta",
          textContent: `CTA ${i + 1}`,
          attrs: { href: `/go/${i}` },
        }),
      ],
    });
    const toggle = createNode({
      id: `${listId}-toggle-${i}`,
      className: "whats-new__stack-toggle",
      textContent: `Title ${i + 1}`,
      attrs: {
        "data-wn-stack-toggle": "",
        type: "button",
        "aria-expanded": expanded ? "true" : "false",
        "aria-controls": `${listId}-panel-${i}`,
      },
    });
    items.push(
      createNode({
        className: `whats-new__card kbm-card${expanded ? " whats-new__card--expanded" : ""}`,
        attrs: {
          "data-wn-stack-item": "",
          ...(extraHidden ? { hidden: "" } : {}),
        },
        children: [toggle, panel],
      }),
    );
  }

  const stack = createNode({
    id: listId,
    className: "whats-new__cards whats-new__cards--stack",
    attrs: { "data-wn-stack": "" },
    children: items,
  });

  const moreButton =
    totalCards > WHATS_NEW_PUBLIC_COLUMN_INITIAL_LIMIT
      ? createNode({
          className: "kbm-btn kbm-btn-outline whats-new__column-more",
          textContent: "Show More",
          attrs: {
            type: "button",
            "data-wn-column-toggle": "",
            "aria-controls": listId,
            "aria-expanded": "false",
          },
        })
      : null;

  const column = createNode({
    className: "whats-new__column whats-new__column--stack",
    children: moreButton ? [stack, moreButton] : [stack],
  });

  return { column, stack, items, moreButton };
}

describe("whatsNewPublicBoard stacked columns", () => {
  const publicPage = fs.readFileSync(path.resolve("src/pages/whats-new.astro"), "utf8");
  const styleMatch = publicPage.match(/<style>([\s\S]*?)<\/style>/);
  const pageCss = styleMatch?.[1] ?? "";

  it("keeps collapsed stack panels hidden via !important so CTAs cannot remain focusable", () => {
    expect(pageCss).toMatch(
      /\.whats-new__stack-panel\s*\[\s*hidden\s*\]\s*\{[^}]*display:\s*none\s*!important/,
    );
  });

  it("wires the public page to stacked columns and a centered Show More control", () => {
    expect(publicPage).toContain('from "../scripts/whatsNewPublicBoard"');
    expect(publicPage).toContain("initWhatsNewPublicBoard");
    expect(publicPage).toContain("splitPublicColumnCards");
    expect(publicPage).toContain("Show More");
    expect(publicPage).toContain("data-wn-column-toggle");
    expect(publicPage).toContain("whats-new__column-more");
    expect(pageCss).toMatch(
      /\.whats-new__column-more\s*\{[^}]*align-self:\s*center/,
    );
    expect(pageCss).toMatch(
      /\.whats-new__card\s*\[\s*hidden\s*\]\s*\{[^}]*display:\s*none\s*!important/,
    );
  });

  it("expands the newest card by default and collapses the others", () => {
    const { stack, items } = buildStackDom(4);
    const root = createNode({ children: [stack] });
    initWhatsNewCardStacks(root);

    const toggles = items.map((item) => item.querySelector("[data-wn-stack-toggle]")!);
    const panels = items.map((item) => item.querySelector("[data-wn-stack-panel]")!);

    expect(toggles[0]!.getAttribute("aria-expanded")).toBe("true");
    expect(panels[0]!.hasAttribute("hidden")).toBe(false);
    expect(items[0]!.classList.contains("whats-new__card--expanded")).toBe(true);

    for (let i = 1; i < items.length; i += 1) {
      expect(toggles[i]!.getAttribute("aria-expanded")).toBe("false");
      expect(isPanelHidden(panels[i]!, pageCss)).toBe(true);
      expect(items[i]!.classList.contains("whats-new__card--expanded")).toBe(false);
    }
  });

  it("opens one card at a time and brings it to the front within a column", () => {
    const { stack, items } = buildStackDom(3);
    const root = createNode({ children: [stack] });
    initWhatsNewCardStacks(root);

    const secondToggle = items[1]!.querySelector("[data-wn-stack-toggle]")!;
    secondToggle.click();

    expect(items[1]!.classList.contains("whats-new__card--expanded")).toBe(true);
    expect(items[1]!.querySelector("[data-wn-stack-toggle]")!.getAttribute("aria-expanded")).toBe(
      "true",
    );
    expect(items[1]!.querySelector("[data-wn-stack-panel]")!.hasAttribute("hidden")).toBe(false);
    expect(items[0]!.classList.contains("whats-new__card--expanded")).toBe(false);
    expect(items[0]!.querySelector("[data-wn-stack-panel]")!.hasAttribute("hidden")).toBe(true);
    expect(Number(items[1]!.style.zIndex)).toBeGreaterThan(Number(items[0]!.style.zIndex));
    expect(Number(items[1]!.style.zIndex)).toBeGreaterThan(Number(items[2]!.style.zIndex));
  });

  it("keeps each column’s expanded card independent of the others", () => {
    const colA = buildStackDom(3, "whats-new-cards-just_added");
    const colB = buildStackDom(3, "whats-new-cards-worth_exploring");
    const colC = buildStackDom(2, "whats-new-cards-in_the_pipeline");
    const root = createNode({
      children: [colA.stack, colB.stack, colC.stack],
    });

    initWhatsNewPublicBoard(root);

    // Defaults: newest open in every column.
    expect(colA.items[0]!.classList.contains("whats-new__card--expanded")).toBe(true);
    expect(colB.items[0]!.classList.contains("whats-new__card--expanded")).toBe(true);
    expect(colC.items[0]!.classList.contains("whats-new__card--expanded")).toBe(true);

    // Open a different card in column B only.
    colB.items[2]!.querySelector("[data-wn-stack-toggle]")!.click();

    expect(colB.items[2]!.classList.contains("whats-new__card--expanded")).toBe(true);
    expect(colB.items[0]!.classList.contains("whats-new__card--expanded")).toBe(false);
    // Columns A and C unchanged.
    expect(colA.items[0]!.classList.contains("whats-new__card--expanded")).toBe(true);
    expect(colA.items[1]!.classList.contains("whats-new__card--expanded")).toBe(false);
    expect(colC.items[0]!.classList.contains("whats-new__card--expanded")).toBe(true);
    expect(colC.items[1]!.classList.contains("whats-new__card--expanded")).toBe(false);

    // Open a different card in column A; B and C stay put.
    colA.items[1]!.querySelector("[data-wn-stack-toggle]")!.click();
    expect(colA.items[1]!.classList.contains("whats-new__card--expanded")).toBe(true);
    expect(colA.items[0]!.classList.contains("whats-new__card--expanded")).toBe(false);
    expect(colB.items[2]!.classList.contains("whats-new__card--expanded")).toBe(true);
    expect(colC.items[0]!.classList.contains("whats-new__card--expanded")).toBe(true);
  });

  it("initially shows only the five newest cards and omits Show More when a column has five or fewer", () => {
    const longCol = buildStackDom(12, "whats-new-cards-just_added", {
      initialVisible: WHATS_NEW_PUBLIC_COLUMN_INITIAL_LIMIT,
    });
    const shortCol = buildStackDom(5, "whats-new-cards-worth_exploring");
    const root = createNode({
      children: [longCol.column, shortCol.column],
    });

    initWhatsNewPublicBoard(root);

    for (let i = 0; i < 5; i += 1) {
      expect(longCol.items[i]!.hasAttribute("hidden")).toBe(false);
    }
    for (let i = 5; i < 12; i += 1) {
      expect(isCardHidden(longCol.items[i]!, pageCss)).toBe(true);
    }
    expect(longCol.moreButton).not.toBeNull();
    expect(longCol.moreButton!.textContent).toBe("Show More");
    expect(longCol.moreButton!.getAttribute("aria-expanded")).toBe("false");

    expect(shortCol.moreButton).toBeNull();
    for (const item of shortCol.items) {
      expect(item.hasAttribute("hidden")).toBe(false);
    }
  });

  it("reveals the next five cards per click and Show Less restores the first five", () => {
    const col = buildStackDom(12, "whats-new-cards-just_added", {
      initialVisible: WHATS_NEW_PUBLIC_COLUMN_INITIAL_LIMIT,
    });
    const root = createNode({ children: [col.column] });
    initWhatsNewPublicBoard(root);

    const button = col.moreButton!;
    expect(col.items.map((item) => item.hasAttribute("hidden"))).toEqual([
      false,
      false,
      false,
      false,
      false,
      true,
      true,
      true,
      true,
      true,
      true,
      true,
    ]);

    button.click();
    expect(col.items.filter((item) => !item.hasAttribute("hidden"))).toHaveLength(10);
    expect(button.textContent).toBe("Show More");
    expect(button.getAttribute("aria-expanded")).toBe("true");

    button.click();
    expect(col.items.every((item) => !item.hasAttribute("hidden"))).toBe(true);
    expect(button.textContent).toBe("Show Less");
    expect(button.getAttribute("aria-expanded")).toBe("true");

    button.click();
    expect(col.items.filter((item) => !item.hasAttribute("hidden"))).toHaveLength(5);
    expect(col.items.slice(0, 5).every((item) => !item.hasAttribute("hidden"))).toBe(true);
    expect(col.items.slice(5).every((item) => item.hasAttribute("hidden"))).toBe(true);
    expect(button.textContent).toBe("Show More");
    expect(button.getAttribute("aria-expanded")).toBe("false");
    // Newest-first DOM order is unchanged.
    expect(col.items[0]!.querySelector("[data-wn-stack-toggle]")!.textContent).toBe("Title 1");
    expect(col.stack.children.map((child) => child.querySelector("[data-wn-stack-toggle]")!.textContent)).toEqual(
      col.items.map((_, i) => `Title ${i + 1}`),
    );
  });

  it("expands each column independently with Show More and Show Less", () => {
    const colA = buildStackDom(12, "whats-new-cards-just_added", {
      initialVisible: WHATS_NEW_PUBLIC_COLUMN_INITIAL_LIMIT,
    });
    const colB = buildStackDom(8, "whats-new-cards-worth_exploring", {
      initialVisible: WHATS_NEW_PUBLIC_COLUMN_INITIAL_LIMIT,
    });
    const colC = buildStackDom(3, "whats-new-cards-in_the_pipeline");
    const root = createNode({
      children: [colA.column, colB.column, colC.column],
    });

    initWhatsNewPublicBoard(root);

    expect(colA.items.filter((item) => !item.hasAttribute("hidden"))).toHaveLength(5);
    expect(colB.items.filter((item) => !item.hasAttribute("hidden"))).toHaveLength(5);
    expect(colC.items.every((item) => !item.hasAttribute("hidden"))).toBe(true);
    expect(colC.moreButton).toBeNull();

    colA.moreButton!.click();
    expect(colA.items.filter((item) => !item.hasAttribute("hidden"))).toHaveLength(10);
    expect(colB.items.filter((item) => !item.hasAttribute("hidden"))).toHaveLength(5);
    expect(colC.items.every((item) => !item.hasAttribute("hidden"))).toBe(true);

    colB.moreButton!.click();
    expect(colB.items.every((item) => !item.hasAttribute("hidden"))).toBe(true);
    expect(colB.moreButton!.textContent).toBe("Show Less");
    expect(colA.moreButton!.textContent).toBe("Show More");
    expect(colA.items.filter((item) => !item.hasAttribute("hidden"))).toHaveLength(10);

    colA.moreButton!.click();
    expect(colA.moreButton!.textContent).toBe("Show Less");
    colA.moreButton!.click();
    expect(colA.items.filter((item) => !item.hasAttribute("hidden"))).toHaveLength(5);
    expect(colB.items.every((item) => !item.hasAttribute("hidden"))).toBe(true);
    expect(colC.items.every((item) => !item.hasAttribute("hidden"))).toBe(true);
  });
});
