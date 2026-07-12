import { describe, expect, it, vi } from "vitest";

import {
  formatSupportNotesSectionHeading,
  initMemberSupportNotesSection,
  renderEmptySupportNotesPlaceholder,
  setSupportNotesSectionExpanded,
  SUPPORT_NOTES_SECTION_HIDE_LABEL,
  SUPPORT_NOTES_SECTION_SHOW_LABEL,
} from "./watsonMemberSupportNotesSection";

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
    textContent: SUPPORT_NOTES_SECTION_SHOW_LABEL,
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
      if (selector === "[data-watson-support-notes-section-toggle]") {
        return toggle;
      }
      if (selector === "[data-watson-support-notes-panel]") {
        return panel;
      }
      return null;
    },
  };
}

describe("watsonMemberSupportNotesSection", () => {
  it("formats the collapsed section heading with note count", () => {
    expect(formatSupportNotesSectionHeading(1)).toBe("Support Notes (1)");
    expect(formatSupportNotesSectionHeading(0)).toBe("Support Notes (0)");
  });

  it("starts collapsed with Show support notes label and hidden panel", () => {
    const toggle = createToggle();
    const panel = createPanel();
    const section = createSection(toggle, panel);

    initMemberSupportNotesSection(section as unknown as HTMLElement, {
      noteCount: 1,
      fragmentUrl: "/watson/members/test/support-notes-fragment",
    });

    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(toggle.textContent).toBe(SUPPORT_NOTES_SECTION_SHOW_LABEL);
    expect(panel.hidden).toBe(true);
  });

  it("lazy-loads support notes on first expand", async () => {
    const toggle = createToggle();
    const panel = createPanel();
    const section = createSection(toggle, panel);
    const initTable = vi.fn();
    const fetchHtml = vi.fn().mockResolvedValue({
      ok: true,
      text: async () =>
        '<html><body><table data-sortable-table><td class="watson-support-notes__text">Full note text</td></table></body></html>',
    });

    initMemberSupportNotesSection(section as unknown as HTMLElement, {
      noteCount: 1,
      fragmentUrl: "/watson/members/test/support-notes-fragment",
      fetchHtml,
      initTable,
    });

    await toggle.click();

    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(toggle.textContent).toBe(SUPPORT_NOTES_SECTION_HIDE_LABEL);
    expect(fetchHtml).toHaveBeenCalledTimes(1);
    expect(initTable).toHaveBeenCalledTimes(1);
    expect(panel.innerHTML).toContain("Full note text");
  });

  it("renders the empty placeholder locally when note count is zero", async () => {
    const toggle = createToggle();
    const panel = createPanel();
    const section = createSection(toggle, panel);
    const fetchHtml = vi.fn();

    initMemberSupportNotesSection(section as unknown as HTMLElement, {
      noteCount: 0,
      fragmentUrl: "/watson/members/test/support-notes-fragment",
      fetchHtml,
    });

    await toggle.click();

    expect(panel.innerHTML).toBe(renderEmptySupportNotesPlaceholder());
    expect(fetchHtml).not.toHaveBeenCalled();
  });

  it("hides support notes again without refetching", async () => {
    const toggle = createToggle();
    const panel = createPanel();
    panel.dataset.supportNotesLoaded = "true";
    const section = createSection(toggle, panel);

    initMemberSupportNotesSection(section as unknown as HTMLElement, {
      noteCount: 1,
      fragmentUrl: "/watson/members/test/support-notes-fragment",
    });

    setSupportNotesSectionExpanded(
      toggle as unknown as HTMLButtonElement,
      panel as unknown as HTMLElement,
      true,
    );
    await toggle.click();

    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(panel.hidden).toBe(true);
  });
});
