import { describe, expect, it, vi } from "vitest";

import {
  formatSavedPatternsSectionHeading,
  initMemberSavedPatternsSection,
  renderEmptySavedPatternsPlaceholder,
  SAVED_PATTERNS_SECTION_HIDE_LABEL,
  SAVED_PATTERNS_SECTION_SHOW_LABEL,
  setSavedPatternsSectionExpanded,
} from "./watsonMemberSavedPatternsSection";

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
    textContent: SAVED_PATTERNS_SECTION_SHOW_LABEL,
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
      if (selector === "[data-watson-saved-patterns-section-toggle]") {
        return toggle;
      }
      if (selector === "[data-watson-saved-patterns-panel]") {
        return panel;
      }
      return null;
    },
  };
}

describe("watsonMemberSavedPatternsSection", () => {
  it("formats the collapsed section heading with record count", () => {
    expect(formatSavedPatternsSectionHeading(12)).toBe("Saved Patterns (12)");
  });

  it("starts collapsed with Show saved patterns label and hidden panel", () => {
    const toggle = createToggle();
    const panel = createPanel();
    const section = createSection(toggle, panel);

    initMemberSavedPatternsSection(section as unknown as HTMLElement, {
      recordCount: 12,
      fragmentUrl: "/watson/members/test/saved-patterns-fragment",
    });

    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(toggle.textContent).toBe(SAVED_PATTERNS_SECTION_SHOW_LABEL);
    expect(panel.hidden).toBe(true);
  });

  it("lazy-loads saved patterns on first expand", async () => {
    const toggle = createToggle();
    const panel = createPanel();
    const section = createSection(toggle, panel);
    const initTable = vi.fn();
    const fetchHtml = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => "<html><body><table data-sortable-table></table></body></html>",
    });

    initMemberSavedPatternsSection(section as unknown as HTMLElement, {
      recordCount: 3,
      fragmentUrl: "/watson/members/test/saved-patterns-fragment",
      fetchHtml,
      initTable,
    });

    await toggle.click();

    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(toggle.textContent).toBe(SAVED_PATTERNS_SECTION_HIDE_LABEL);
    expect(fetchHtml).toHaveBeenCalledTimes(1);
    expect(initTable).toHaveBeenCalledTimes(1);
  });

  it("renders the empty placeholder locally when record count is zero", async () => {
    const toggle = createToggle();
    const panel = createPanel();
    const section = createSection(toggle, panel);
    const fetchHtml = vi.fn();

    initMemberSavedPatternsSection(section as unknown as HTMLElement, {
      recordCount: 0,
      fragmentUrl: "/watson/members/test/saved-patterns-fragment",
      fetchHtml,
    });

    await toggle.click();

    expect(panel.innerHTML).toBe(renderEmptySavedPatternsPlaceholder());
    expect(fetchHtml).not.toHaveBeenCalled();
  });

  it("hides saved patterns again without refetching", async () => {
    const toggle = createToggle();
    const panel = createPanel();
    panel.dataset.savedPatternsLoaded = "true";
    const section = createSection(toggle, panel);

    initMemberSavedPatternsSection(section as unknown as HTMLElement, {
      recordCount: 3,
      fragmentUrl: "/watson/members/test/saved-patterns-fragment",
    });

    setSavedPatternsSectionExpanded(
      toggle as unknown as HTMLButtonElement,
      panel as unknown as HTMLElement,
      true,
    );
    await toggle.click();

    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(panel.hidden).toBe(true);
  });
});
