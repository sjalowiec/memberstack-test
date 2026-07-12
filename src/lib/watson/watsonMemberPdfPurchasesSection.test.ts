import { describe, expect, it, vi } from "vitest";

import {
  formatPdfPurchasesSectionHeading,
  initMemberPdfPurchasesSection,
  PDF_PURCHASES_SECTION_HIDE_LABEL,
  PDF_PURCHASES_SECTION_SHOW_LABEL,
  renderEmptyPdfPurchasesPlaceholder,
  setPdfPurchasesSectionExpanded,
} from "./watsonMemberPdfPurchasesSection";

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
    textContent: PDF_PURCHASES_SECTION_SHOW_LABEL,
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
      if (selector === "[data-watson-pdf-purchases-section-toggle]") {
        return toggle;
      }
      if (selector === "[data-watson-pdf-purchases-panel]") {
        return panel;
      }
      return null;
    },
  };
}

describe("watsonMemberPdfPurchasesSection", () => {
  it("formats the collapsed section heading with record count", () => {
    expect(formatPdfPurchasesSectionHeading(3)).toBe("Legacy PDF Purchases (3)");
  });

  it("starts collapsed with Show PDF purchases label and hidden panel", () => {
    const toggle = createToggle();
    const panel = createPanel();
    const section = createSection(toggle, panel);

    initMemberPdfPurchasesSection(section as unknown as HTMLElement, {
      recordCount: 3,
      fragmentUrl: "/watson/members/test/pdf-purchases-fragment",
    });

    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(toggle.textContent).toBe(PDF_PURCHASES_SECTION_SHOW_LABEL);
    expect(panel.hidden).toBe(true);
  });

  it("lazy-loads PDF purchases on first expand", async () => {
    const toggle = createToggle();
    const panel = createPanel();
    const section = createSection(toggle, panel);
    const initTable = vi.fn();
    const fetchHtml = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => "<html><body><table data-sortable-table></table></body></html>",
    });

    initMemberPdfPurchasesSection(section as unknown as HTMLElement, {
      recordCount: 2,
      fragmentUrl: "/watson/members/test/pdf-purchases-fragment",
      fetchHtml,
      initTable,
    });

    await toggle.click();

    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(toggle.textContent).toBe(PDF_PURCHASES_SECTION_HIDE_LABEL);
    expect(fetchHtml).toHaveBeenCalledTimes(1);
    expect(initTable).toHaveBeenCalledTimes(1);
  });

  it("renders the empty placeholder locally when record count is zero", async () => {
    const toggle = createToggle();
    const panel = createPanel();
    const section = createSection(toggle, panel);
    const fetchHtml = vi.fn();

    initMemberPdfPurchasesSection(section as unknown as HTMLElement, {
      recordCount: 0,
      fragmentUrl: "/watson/members/test/pdf-purchases-fragment",
      fetchHtml,
    });

    await toggle.click();

    expect(panel.innerHTML).toBe(renderEmptyPdfPurchasesPlaceholder());
    expect(fetchHtml).not.toHaveBeenCalled();
  });

  it("hides PDF purchases again without refetching", async () => {
    const toggle = createToggle();
    const panel = createPanel();
    panel.dataset.pdfPurchasesLoaded = "true";
    const section = createSection(toggle, panel);

    initMemberPdfPurchasesSection(section as unknown as HTMLElement, {
      recordCount: 2,
      fragmentUrl: "/watson/members/test/pdf-purchases-fragment",
    });

    setPdfPurchasesSectionExpanded(
      toggle as unknown as HTMLButtonElement,
      panel as unknown as HTMLElement,
      true,
    );
    await toggle.click();

    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(panel.hidden).toBe(true);
  });
});
