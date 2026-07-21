import { describe, expect, it, vi } from "vitest";

import {
  closeOtherCustomerAccordions,
  formatCustomerAccordionTitle,
  getCustomerAccordionElements,
  initCustomerDetailAccordions,
  openCustomerAccordionFromHash,
} from "./customerDetailAccordion";

type FakeDetails = {
  id: string;
  open: boolean;
  dataset: Record<string, string>;
  hasAttribute: (name: string) => boolean;
  addEventListener: (type: string, listener: () => void) => void;
  querySelector: (selector: string) => FakePanel | null;
  dispatchToggle: () => void;
};

type FakePanel = {
  dataset: Record<string, string>;
  innerHTML: string;
};

type FakeGroup = {
  dataset: Record<string, string>;
  querySelectorAll: (selector: string) => FakeDetails[];
  querySelector: (selector: string) => FakeDetails | null;
  addEventListener?: never;
};

function createDetails(id: string, panel: FakePanel | null = null): FakeDetails {
  let toggleListener: (() => void) | null = null;
  return {
    id,
    open: false,
    dataset: {},
    hasAttribute(name) {
      return name === "data-watson-customer-accordion";
    },
    addEventListener(type, listener) {
      if (type === "toggle") {
        toggleListener = listener;
      }
    },
    querySelector(selector) {
      if (selector.includes("data-watson-customer-pdf-panel")) {
        return panel;
      }
      return null;
    },
    dispatchToggle() {
      toggleListener?.();
    },
  };
}

function createGroup(detailsList: FakeDetails[]): FakeGroup {
  return {
    dataset: {},
    querySelectorAll(selector) {
      if (selector.includes("data-watson-customer-accordion")) {
        return detailsList;
      }
      return [];
    },
    querySelector(selector) {
      const match = selector.match(/^#(.+)$/);
      if (!match) {
        return null;
      }
      const id = match[1]!.replace(/\\/g, "");
      return detailsList.find((item) => item.id === id) ?? null;
    },
  };
}

describe("customerDetailAccordion", () => {
  it("formats titles with optional counts", () => {
    expect(formatCustomerAccordionTitle("Timeline")).toBe("Timeline");
    expect(formatCustomerAccordionTitle("Timeline", 24)).toBe("Timeline (24)");
    expect(formatCustomerAccordionTitle("Notes", null)).toBe("Notes");
  });

  it("closes other open accordions in the same group", () => {
    const first = createDetails("a");
    const second = createDetails("b");
    const third = createDetails("c");
    first.open = true;
    second.open = true;
    const group = createGroup([first, second, third]);

    closeOtherCustomerAccordions(group as unknown as HTMLElement, second as unknown as HTMLDetailsElement);

    expect(first.open).toBe(false);
    expect(second.open).toBe(true);
    expect(third.open).toBe(false);
  });

  it("keeps only one accordion open when toggled", () => {
    const first = createDetails("a");
    const second = createDetails("b");
    const group = createGroup([first, second]);
    const root = {
      querySelectorAll(selector: string) {
        if (selector.includes("data-watson-customer-accordion-group")) {
          return [group];
        }
        return [];
      },
    };

    initCustomerDetailAccordions(root as unknown as ParentNode);

    first.open = true;
    first.dispatchToggle();
    expect(first.open).toBe(true);
    expect(second.open).toBe(false);

    second.open = true;
    second.dispatchToggle();
    expect(first.open).toBe(false);
    expect(second.open).toBe(true);
  });

  it("opens the accordion matching the URL hash", () => {
    const notes = createDetails("customer-notes");
    const timeline = createDetails("customer-timeline");
    const group = createGroup([notes, timeline]);

    openCustomerAccordionFromHash(group as unknown as HTMLElement, "#customer-notes");

    expect(notes.open).toBe(true);
    expect(timeline.open).toBe(false);
  });

  it("loads PDF purchases when the PDF accordion opens", async () => {
    const panel: FakePanel = {
      dataset: {
        recordCount: "2",
        pdfPurchasesFragmentUrl: "/watson/members/abc/pdf-purchases-fragment",
      },
      innerHTML: "",
    };
    const details = createDetails("customer-pdf-purchases", panel);
    const group = createGroup([details]);
    const root = {
      querySelectorAll(selector: string) {
        if (selector.includes("data-watson-customer-accordion-group")) {
          return [group];
        }
        return [];
      },
    };

    const fetchHtml = vi.fn(async () =>
      Promise.resolve({
        ok: true,
        text: async () => "<body><div>PDF rows</div></body>",
        status: 200,
      } as Response),
    );

    initCustomerDetailAccordions(root as unknown as ParentNode, {
      fetchHtml,
      initTable: () => {},
    });

    details.open = true;
    details.dispatchToggle();

    await vi.waitFor(() => {
      expect(fetchHtml).toHaveBeenCalled();
      expect(panel.dataset.pdfPurchasesLoaded).toBe("true");
      expect(panel.innerHTML).toContain("PDF rows");
    });
  });

  it("collects accordion elements from a group", () => {
    const details = [createDetails("a"), createDetails("b")];
    const group = createGroup(details);
    expect(getCustomerAccordionElements(group as unknown as HTMLElement)).toHaveLength(2);
  });
});
