import { describe, expect, it, vi } from "vitest";

import {
  formatMemberNotesSectionHeading,
  initMemberNotesSection,
  MEMBER_NOTES_SECTION_SHOW_LABEL,
  renderEmptyLegacyNotesPlaceholder,
  setMemberNotesSectionExpanded,
} from "./watsonMemberNotesSection";

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
    textContent: MEMBER_NOTES_SECTION_SHOW_LABEL,
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

function createPanel(hidden = true): DomElement {
  return {
    hidden,
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

function createSection(toggle: DomElement, panel: DomElement, legacyPanel: DomElement, watsonPanel: DomElement): DomElement {
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
      if (selector === "[data-watson-member-notes-section-toggle]") {
        return toggle;
      }
      if (selector === "[data-watson-member-notes-panel]") {
        return panel;
      }
      if (selector === "[data-watson-legacy-notes-panel]") {
        return legacyPanel;
      }
      if (selector === "[data-watson-watson-notes-panel]") {
        return watsonPanel;
      }
      return null;
    },
  };
}

describe("watsonMemberNotesSection", () => {
  it("formats heading with legacy and Watson counts", () => {
    expect(formatMemberNotesSectionHeading(1, 2)).toBe("Member Notes (1 legacy, 2 Watson)");
  });

  it("starts collapsed and loads both panels on expand", async () => {
    const toggle = createToggle();
    const panel = createPanel(true);
    const legacyPanel = createPanel(false);
    const watsonPanel = createPanel(false);
    const section = createSection(toggle, panel, legacyPanel, watsonPanel);
    const fetchHtml = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        text: async () => "<html><body><p>Legacy note</p></body></html>",
      })
      .mockResolvedValueOnce({
        ok: true,
        text: async () =>
          '<html><body><div data-watson-notes-root data-memberid="test"><form data-watson-note-add-form></form></div></body></html>',
      });

    initMemberNotesSection(section as unknown as HTMLElement, {
      legacyNoteCount: 1,
      legacyFragmentUrl: "/watson/members/test/legacy-notes-fragment",
      watsonFragmentUrl: "/watson/members/test/watson-notes-fragment",
      fetchHtml,
    });

    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    await toggle.click();
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(fetchHtml).toHaveBeenCalledTimes(2);
    expect(legacyPanel.innerHTML).toContain("Legacy note");
    expect(watsonPanel.innerHTML).toContain("data-watson-notes-root");
  });

  it("renders empty legacy placeholder without fetching when count is zero", async () => {
    const toggle = createToggle();
    const panel = createPanel(true);
    const legacyPanel = createPanel(false);
    const watsonPanel = createPanel(false);
    const section = createSection(toggle, panel, legacyPanel, watsonPanel);
    const fetchHtml = vi.fn().mockResolvedValue({
      ok: true,
      text: async () =>
        '<html><body><div data-watson-notes-root data-memberid="test"></div></body></html>',
    });

    initMemberNotesSection(section as unknown as HTMLElement, {
      legacyNoteCount: 0,
      legacyFragmentUrl: "/watson/members/test/legacy-notes-fragment",
      watsonFragmentUrl: "/watson/members/test/watson-notes-fragment",
      fetchHtml,
    });

    await toggle.click();

    expect(legacyPanel.innerHTML).toBe(renderEmptyLegacyNotesPlaceholder());
    expect(fetchHtml).toHaveBeenCalledTimes(1);
  });

  it("can collapse an expanded section", () => {
    const toggle = createToggle();
    const panel = createPanel(false);
    const legacyPanel = createPanel(false);
    const watsonPanel = createPanel(false);
    const section = createSection(toggle, panel, legacyPanel, watsonPanel);

    initMemberNotesSection(section as unknown as HTMLElement, {
      legacyNoteCount: 0,
      legacyFragmentUrl: "/legacy",
      watsonFragmentUrl: "/watson",
    });

    setMemberNotesSectionExpanded(
      toggle as unknown as HTMLButtonElement,
      panel as unknown as HTMLElement,
      true,
    );
    expect(panel.hidden).toBe(false);
  });
});
