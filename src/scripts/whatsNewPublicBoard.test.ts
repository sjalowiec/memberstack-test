import fs from "fs";
import path from "path";

import { describe, expect, it } from "vitest";

import { initWhatsNewColumnToggles } from "./whatsNewPublicBoard";

/**
 * Minimal DOM nodes for the public board toggle — the suite runs without jsdom.
 * Visibility is computed from the same CSS cascade that broke in the browser:
 * `.whats-new__card { display: block }` / `.kbm-card { display: flex }` beat the
 * UA `[hidden]` rule unless `.whats-new__card[hidden] { display: none !important }`
 * is present.
 */
type AttrMap = Map<string, string>;

type StubNode = {
  id: string;
  className: string;
  textContent: string;
  attrs: AttrMap;
  children: StubNode[];
  listeners: Map<string, Array<() => void>>;
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
  const node: StubNode = {
    id: initial.id ?? "",
    className: initial.className ?? "",
    textContent: initial.textContent ?? "",
    attrs,
    children: initial.children ?? [],
    listeners,
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
      if (selector === "[data-wn-column-toggle]") {
        return this.attrs.has("data-wn-column-toggle");
      }
      if (selector === "[data-wn-extra]") {
        return this.attrs.has("data-wn-extra");
      }
      return false;
    },
  };
  return node;
}

/** Apply the public What's New card display cascade (simplified). */
function computedDisplayForCard(card: StubNode, pageCss: string): string {
  const hasHiddenAttr = card.hasAttribute("hidden");
  // Author card rules always set a visible display value.
  const authorVisibleDisplay = card.className.includes("kbm-card") ? "flex" : "block";

  const hasHiddenOverride = /\.whats-new__card\s*\[\s*hidden\s*\]\s*\{[^}]*display:\s*none\s*!important/.test(
    pageCss,
  );

  if (hasHiddenAttr && hasHiddenOverride && card.className.includes("whats-new__card")) {
    return "none";
  }
  // Without the override, author display wins over UA [hidden] — the reported bug.
  if (hasHiddenAttr && !hasHiddenOverride) {
    return authorVisibleDisplay;
  }
  return authorVisibleDisplay;
}

function isCardVisible(card: StubNode, pageCss: string): boolean {
  return computedDisplayForCard(card, pageCss) !== "none";
}

function buildColumnDom(totalCards: number, initialVisible: number) {
  const cards: StubNode[] = [];
  for (let i = 0; i < totalCards; i += 1) {
    const extra = i >= initialVisible;
    cards.push(
      createNode({
        className: "whats-new__card kbm-card",
        textContent: `Card ${i + 1}`,
        attrs: {
          ...(extra ? { "data-wn-extra": "", hidden: "" } : {}),
        },
      }),
    );
  }

  const list = createNode({
    id: "whats-new-cards-just_added",
    className: "whats-new__cards",
    children: cards,
  });

  const button = createNode({
    className: "whats-new__toggle",
    textContent: "Show more",
    attrs: {
      "data-wn-column-toggle": "",
      "aria-expanded": "false",
      "aria-controls": "whats-new-cards-just_added",
      type: "button",
    },
  });

  const root = createNode({
    children: [list, button],
  });

  return { root, list, button, cards };
}

describe("whatsNewPublicBoard column toggle visibility", () => {
  const publicPage = fs.readFileSync(path.resolve("src/pages/whats-new.astro"), "utf8");
  const styleMatch = publicPage.match(/<style>([\s\S]*?)<\/style>/);
  const pageCss = styleMatch?.[1] ?? "";

  it("keeps an !important hidden override so card display rules cannot reveal extras", () => {
    // The bug: .whats-new__card { display: block } and .kbm-card { display: flex }
    // override the UA [hidden] stylesheet when specificity/source order wins.
    expect(pageCss).toMatch(/\.whats-new__card\s*\{[^}]*display:\s*block/);
    expect(pageCss).toMatch(
      /\.whats-new__card\s*\[\s*hidden\s*\]\s*\{[^}]*display:\s*none\s*!important/,
    );
  });

  it("shows only the first 3 of 5 cards initially (actual display, not attribute alone)", () => {
    const { cards } = buildColumnDom(5, 3);

    // Attribute presence alone is not enough — compute visibility via CSS cascade.
    expect(cards.filter((c) => c.hasAttribute("hidden"))).toHaveLength(2);
    expect(cards.filter((c) => isCardVisible(c, pageCss))).toHaveLength(3);
    expect(isCardVisible(cards[0]!, pageCss)).toBe(true);
    expect(isCardVisible(cards[1]!, pageCss)).toBe(true);
    expect(isCardVisible(cards[2]!, pageCss)).toBe(true);
    expect(isCardVisible(cards[3]!, pageCss)).toBe(false);
    expect(isCardVisible(cards[4]!, pageCss)).toBe(false);

    // Without the page override, the same hidden attributes would still "show".
    const cssWithoutOverride = pageCss.replace(
      /\.whats-new__card\s*\[\s*hidden\s*\]\s*\{[^}]*\}/,
      "",
    );
    expect(cards.filter((c) => isCardVisible(c, cssWithoutOverride))).toHaveLength(5);
  });

  it("Show more reveals only that column’s remaining cards; Show less hides them again", () => {
    const { root, button, cards } = buildColumnDom(5, 3);
    initWhatsNewColumnToggles(root);

    expect(cards.filter((c) => isCardVisible(c, pageCss))).toHaveLength(3);
    expect(button.getAttribute("aria-expanded")).toBe("false");
    expect(button.textContent).toBe("Show more");

    button.click();
    expect(button.getAttribute("aria-expanded")).toBe("true");
    expect(button.textContent).toBe("Show less");
    expect(cards.every((c) => isCardVisible(c, pageCss))).toBe(true);
    expect(cards.filter((c) => c.hasAttribute("hidden"))).toHaveLength(0);

    button.click();
    expect(button.getAttribute("aria-expanded")).toBe("false");
    expect(button.textContent).toBe("Show more");
    expect(cards.filter((c) => isCardVisible(c, pageCss))).toHaveLength(3);
    expect(isCardVisible(cards[3]!, pageCss)).toBe(false);
    expect(isCardVisible(cards[4]!, pageCss)).toBe(false);
  });

  it("wires the public page to the shared toggle module", () => {
    expect(publicPage).toContain('from "../scripts/whatsNewPublicBoard"');
    expect(publicPage).toContain("initWhatsNewColumnToggles");
  });
});
