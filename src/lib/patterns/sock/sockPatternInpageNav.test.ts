import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { createEmptySockDraft, type SockDraft } from "./sockDraft";
import { createSockSizingAdapter } from "./sockSizing";
import {
  buildSockPatternFromDraft,
  renderSockPatternPairHtml,
} from "./sockPatternPage";
import {
  renderBasicSockInstructionsHtml,
  sockInstructionSectionIds,
} from "./sockInstructions";
import {
  SOCK_CUFF_TO_TOE_INPAGE_NAV_LABELS,
  SOCK_TOE_UP_INPAGE_NAV_LABELS,
  sockPatternInpageNavItems,
  sockPatternSectionAnchorId,
} from "./sockPatternInpageNav";

const adapter = createSockSizingAdapter(
  JSON.parse(readFileSync(resolve("public/data/sizing_socks.json"), "utf8")),
);

function completeDraft(overrides: Partial<SockDraft> = {}): SockDraft {
  return createEmptySockDraft({
    sizeSel: "woman_med",
    constructionDirection: "cuff-to-toe",
    footCircumference: "8.5",
    footLength: "9",
    legCircumference: "8.5",
    legLength: "4.5",
    gaugeSlots: {
      inches: { stitch: "28", row: "40" },
      cm: { stitch: "", row: "" },
    },
    availableNeedles: "200",
    ...overrides,
  });
}

function mustPattern(draft: SockDraft) {
  const result = buildSockPatternFromDraft(draft, adapter);
  expect(result.ok, result.ok ? "" : result.message).toBe(true);
  if (!result.ok) throw new Error(result.message);
  return result;
}

function sectionAnchorIds(html: string): string[] {
  return [...html.matchAll(/<section id="([^"]+)"/g)].map((match) => match[1]!);
}

const QUICK_TIP_AND_VIDEO_LABELS = [
  "New to toe-up socks?",
  "Complete Toe-Up Sock",
  "Short Row Refresher",
  "Figure 8 Bind Off",
  "Kitchener Stitch",
  "Bickford Seam",
  "Automatic Wrap",
  "Cuff Cast On Options",
  "Knitting Toe-Up Socks",
  "Knitting the Ankle",
  "Knitting the Heel",
  "Knitting the Toe",
  "Finishing the Toe",
  "Why stop the row counter?",
];

describe("Socks in-page navigation from instruction structure", () => {
  it("Toe Up navigation contains exactly the construction-order pattern sections", () => {
    const result = mustPattern(completeDraft({ constructionDirection: "toe-up" }));
    const items = sockPatternInpageNavItems(result.sock1);
    expect(items.map((item) => item.label)).toEqual([...SOCK_TOE_UP_INPAGE_NAV_LABELS]);
    expect(sockInstructionSectionIds(result.sock1)).toEqual([
      "cast-on",
      "toe",
      "foot",
      "heel",
      "ankle",
      "leg",
      "finishing",
    ]);
    expect(items.map((item) => item.ids[0])).toEqual(
      sockInstructionSectionIds(result.sock1).map((id) =>
        sockPatternSectionAnchorId(1, id),
      ),
    );
  });

  it("Cuff to Toe navigation contains exactly the construction-order pattern sections", () => {
    const result = mustPattern(completeDraft());
    const items = sockPatternInpageNavItems(result.sock1);
    expect(items.map((item) => item.label)).toEqual([...SOCK_CUFF_TO_TOE_INPAGE_NAV_LABELS]);
    expect(sockInstructionSectionIds(result.sock1)).toEqual([
      "cast-on",
      "leg",
      "ankle",
      "heel",
      "foot",
      "toe",
      "finishing",
    ]);
    expect(items.map((item) => item.ids[0])).toEqual(
      sockInstructionSectionIds(result.sock1).map((id) =>
        sockPatternSectionAnchorId(1, id),
      ),
    );
  });

  it("every navigation item targets a real generated section for both socks", () => {
    for (const constructionDirection of ["cuff-to-toe", "toe-up"] as const) {
      const result = mustPattern(completeDraft({ constructionDirection }));
      for (const doc of [result.sock1, result.sock2]) {
        const html = renderBasicSockInstructionsHtml(doc);
        const items = sockPatternInpageNavItems(doc);
        expect(items.length).toBeGreaterThan(0);
        for (const item of items) {
          const anchorId = item.ids[0]!;
          expect(html).toContain(`id="${anchorId}"`);
          const sectionId = anchorId.replace(/^sock-\d+-/, "");
          expect(html).toContain(`data-section-id="${sectionId}"`);
          expect(doc.sections.some((section) => section.id === sectionId)).toBe(true);
        }
      }
    }
  });

  it("does not allow duplicate section IDs when Sock 1 and Sock 2 are both present", () => {
    const result = mustPattern(completeDraft());
    const html = renderSockPatternPairHtml(result.sock1, result.sock2);
    const ids = sectionAnchorIds(html);
    expect(ids).toContain("sock-1-cast-on");
    expect(ids).toContain("sock-2-cast-on");
    expect(ids).toContain("sock-1-ankle");
    expect(ids).toContain("sock-2-ankle");
    expect(new Set(ids).size).toBe(ids.length);
    expect(html.match(/data-section-id="ankle"/g)?.length).toBe(2);
  });

  it("does not add Quick Tips or videos as navigation items", () => {
    const cuff = sockPatternInpageNavItems(mustPattern(completeDraft()).sock1);
    const toeUp = sockPatternInpageNavItems(
      mustPattern(completeDraft({ constructionDirection: "toe-up" })).sock1,
    );
    for (const items of [cuff, toeUp]) {
      const labels = items.map((item) => item.label);
      for (const forbidden of QUICK_TIP_AND_VIDEO_LABELS) {
        expect(labels).not.toContain(forbidden);
      }
    }
    expect(cuff.map((item) => item.label)).not.toContain("Scrap On");
    expect(toeUp.map((item) => item.label)).not.toContain("Cuff");
  });

  it("keeps instruction headings unchanged while nav uses Cuff / Sole & Instep", () => {
    const cuffHtml = renderBasicSockInstructionsHtml(mustPattern(completeDraft()).sock1);
    expect(cuffHtml).toContain("<h4>Cast-On</h4>");
    expect(cuffHtml).toContain("<h4>Foot</h4>");
    expect(cuffHtml).not.toContain("<h4>Cuff</h4>");
    expect(cuffHtml).not.toContain("<h4>Sole &amp; Instep</h4>");
    expect(sockPatternInpageNavItems(mustPattern(completeDraft()).sock1).map((item) => item.label)).toEqual(
      [...SOCK_CUFF_TO_TOE_INPAGE_NAV_LABELS],
    );
  });
});

describe("Socks pattern page reuses sweater in-page navigation", () => {
  it("mounts the shared nav shell and syncs from the generated sock document", () => {
    const patternPage = readFileSync(resolve("src/pages/patterns/socks/pattern.astro"), "utf8");
    const patternScript = readFileSync(resolve("src/scripts/socks-pattern-page.ts"), "utf8");
    expect(patternPage).toContain('data-sleeveless-pattern-inpage-nav');
    expect(patternPage).toContain('aria-label="Jump to pattern section"');
    expect(patternPage).toContain("sleeveless-pattern-inpage-nav");
    expect(patternScript).toContain("syncPatternInpageNav");
    expect(patternScript).toContain("sockPatternInpageNavItems");
    expect(patternScript).toContain("selectedSockPairTab");
  });
});
