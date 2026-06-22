import { describe, expect, it } from "vitest";
import {
  accordionLayoutSummary,
  ACCORDION_INTRO_ROLE,
  getAccordionLayoutParts,
  isAccordionLayoutBlock,
} from "./courseAccordionLayout";

describe("isAccordionLayoutBlock", () => {
  it("accepts accordion-only blocks", () => {
    expect(
      isAccordionLayoutBlock({
        components: [{ type: "exerciseAccordion", order: 1, sections: [] }],
      }),
    ).toBe(true);
  });

  it("accepts intro richText plus accordion", () => {
    expect(
      isAccordionLayoutBlock({
        components: [
          { type: "richText", html: "<p>Intro</p>", order: 1, layoutRole: ACCORDION_INTRO_ROLE },
          { type: "exerciseAccordion", order: 2, sections: [{ title: "A", bodyHtml: "" }] },
        ],
      }),
    ).toBe(true);
  });

  it("rejects accordion mixed with video", () => {
    expect(
      isAccordionLayoutBlock({
        components: [
          { type: "video", order: 1 },
          { type: "exerciseAccordion", order: 2, sections: [] },
        ],
      }),
    ).toBe(false);
  });
});

describe("getAccordionLayoutParts", () => {
  it("finds intro text before accordion without layoutRole", () => {
    const parts = getAccordionLayoutParts({
      components: [
        { type: "richText", html: "<p>Before</p>", order: 1 },
        { type: "exerciseAccordion", order: 2, sections: [] },
      ],
    });
    expect(parts?.introText?.html).toBe("<p>Before</p>");
  });
});

describe("accordionLayoutSummary", () => {
  it("includes intro preview when present", () => {
    const summary = accordionLayoutSummary({
      introText: { html: "<p>Needle basics</p>" },
      accordion: { sections: [{ title: "One", bodyHtml: "" }, { title: "Two", bodyHtml: "" }] },
    });
    expect(summary).toContain("Needle basics");
    expect(summary).toContain("2 sections");
  });
});
