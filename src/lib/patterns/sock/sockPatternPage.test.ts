import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { createEmptySockDraft, type SockDraft } from "./sockDraft";
import { createSockSizingAdapter } from "./sockSizing";
import {
  SOCK_FINISHED_PATTERN_MISSING_DRAFT_MESSAGE,
  buildSockPatternFromDraft,
  buildSockPatternSummaryDlHtml,
  renderSockPatternPairHtml,
} from "./sockPatternPage";
import {
  SOCK_PATTERN_HREF,
  SOCK_EDIT_PRIMARY_LABEL,
} from "./sockPatternNavigation";
import {
  BICKFORD_SEAM_GLOSSARY_ID,
  BICKFORD_SEAM_GLOSSARY_TERM,
  KITCHENER_STITCH_GLOSSARY_ID,
  KITCHENER_STITCH_GLOSSARY_TERM,
  SCRAP_AND_RAVEL_CAST_ON_GLOSSARY_ID,
  SCRAP_AND_RAVEL_CAST_ON_GLOSSARY_TERM,
  SOCK_ANKLE_VIDEO_TIP_ID,
  SOCK_ANKLE_VIDEO_TITLE,
  SOCK_ANKLE_VIDEO_VIMEO_ID,
  SOCK_CUFF_CAST_ON_VIDEO_TIP_ID,
  SOCK_CUFF_CAST_ON_VIDEO_TITLE,
  SOCK_CUFF_CAST_ON_VIDEO_VIMEO_ID,
  SOCK_HEEL_VIDEO_TIP_ID,
  SOCK_HEEL_VIDEO_VIMEO_ID,
  SOCK_TOE_FINISHING_VIDEO_TIP_ID,
  SOCK_TOE_FINISHING_VIDEO_VIMEO_ID,
  SOCK_TOE_VIDEO_TIP_ID,
  SOCK_TOE_VIDEO_VIMEO_ID,
  SOCK_WHY_STOP_ROW_COUNTER_TIP_ID,
  SOCK_SHORT_ROW_WRAP_WARNING,
  SOCK_TOE_UP_OPENING_SECTION_TITLE,
} from "./sockInstructions";
import { SOCK_PATTERN_INCOMPLETE_DRAFT_MESSAGE } from "./sockPatternFromDraft";

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

function assertStitchContinuity(doc: {
  sections: Array<{ id: string; startStitches: number; endStitches: number }>;
}): void {
  for (let i = 1; i < doc.sections.length; i++) {
    const prev = doc.sections[i - 1]!;
    const next = doc.sections[i]!;
    expect(next.startStitches, `${prev.id} → ${next.id}`).toBe(prev.endStitches);
  }
}

describe("Summary Update Pattern → Pattern route", () => {
  const summaryPage =
    readFileSync(resolve("src/pages/patterns/socks/summary/index.astro"), "utf8") +
    "\n" +
    readFileSync(resolve("src/components/patterns/SocksPatternEditWorkspace.astro"), "utf8");
  const patternPage = readFileSync(resolve("src/pages/patterns/socks/pattern.astro"), "utf8");
  const patternScript = readFileSync(resolve("src/scripts/socks-pattern-page.ts"), "utf8");

  it("wires Update Pattern to the finished Pattern page", () => {
    expect(SOCK_PATTERN_HREF).toBe("/patterns/socks/pattern/");
    expect(SOCK_EDIT_PRIMARY_LABEL).toBe("Update Pattern");
    expect(summaryPage).toContain("SOCK_PATTERN_HREF");
    expect(summaryPage).toContain('data-testid="button-edit-update"');
    expect(summaryPage).not.toContain("disabled");
    expect(summaryPage).not.toContain("SOCK_SUMMARY_PATTERN_NOT_READY_MESSAGE");
    expect(patternPage).toContain('data-testid="socks-pattern-page"');
    expect(patternPage).toContain("patternWorkspace={true}");
    expect(patternPage).toContain("SleevelessPatternMemberGate");
    expect(summaryPage).toContain("SleevelessPatternMemberGate");
    expect(patternPage).toContain("SOCK_PATTERN_BUILDER_HREF");
    expect(patternPage).toContain("SOCK_EDIT_HREF");
    expect(patternPage).toContain('data-testid="button-edit-pattern"');
    expect(patternPage).toContain('data-testid="socks-pattern-empty-cta"');
    expect(patternScript).toContain("buildSockPatternFromDraft");
    expect(patternScript).toContain("renderSockPatternPairHtml");
    expect(patternScript).toContain("initSockPairInstructionTabs");
    expect(patternScript).toContain("buildSockPatternDiagramTabsShellHtml");
    expect(patternScript).toContain("buildSockPatternDiagramSvg");
    expect(patternScript).toContain("buildSockShapingNotationDiagramSvg");
    expect(patternPage).toContain("data-sock-diagram-tabs-mount");
    expect(patternPage).toContain("pattern-diagram-tabs.css");
    expect(patternScript).toContain("ensureUrlRequestedSavedPatternHydrated");
    expect(patternScript).toContain("SOCK_EDIT_HREF");
    expect(patternScript).not.toContain("SOCK_PATTERN_BUILDER_HREF");
  });
});

describe("valid and incomplete drafts", () => {
  it("builds a Pattern document from a valid draft", () => {
    const result = mustPattern(completeDraft());
    expect(result.view.patternName).toBe("Socks");
    expect(result.view.constructionLabel).toBe("Cuff to Toe");
    expect(result.sock1.sock).toBe(1);
    expect(result.sock2.sock).toBe(2);
  });

  it("sends a missing draft back to the Builder recovery message", () => {
    const result = buildSockPatternFromDraft(null, adapter);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("missing");
    expect(result.message).toBe(SOCK_FINISHED_PATTERN_MISSING_DRAFT_MESSAGE);
  });

  it("sends an incomplete draft back to the Builder", () => {
    const result = buildSockPatternFromDraft(createEmptySockDraft(), adapter);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("incomplete");
    expect(result.message).toBe(SOCK_PATTERN_INCOMPLETE_DRAFT_MESSAGE);
  });
});

describe("Cuff-to-Toe and Toe-Up rendering", () => {
  it("renders Cuff-to-Toe Sock 1/2 with approved finishing and wrap warning", () => {
    const result = mustPattern(completeDraft());
    const html = renderSockPatternPairHtml(result.sock1, result.sock2);
    expect(html).toContain("Sock 1 — Cuff to Toe");
    expect(html).toContain("Sock 2 — Cuff to Toe");
    expect(html).toContain('data-testid="socks-pair-tabs"');
    expect(html).toContain('data-socks-pair-tab="sock-1"');
    expect(html).toContain('data-socks-pair-tab="sock-2"');
    expect(html).toMatch(/data-socks-pair-panel="sock-2"[^>]*\shidden/);
    expect(html).not.toMatch(/data-socks-pair-panel="sock-1"[^>]*\shidden/);
    expect(html).toContain("data-section-id=\"ankle\"");
    expect(html).toContain("Ankle");
    expect(html).toContain(SOCK_SHORT_ROW_WRAP_WARNING);
    expect(html).toContain("contrasting waste yarn");
    expect(html).toContain("and remove the work from the machine.");
    expect(html).toContain("Finish the Toe");
    expect(html).toContain("Choose a finishing method:");
    expect(html).toContain("Rehang and join");
    expect(html).toContain("Graft or seam");
    expect(html).toContain(BICKFORD_SEAM_GLOSSARY_TERM);
    expect(html).toContain(KITCHENER_STITCH_GLOSSARY_TERM);
    expect(html).toContain(`data-glossary-id="${BICKFORD_SEAM_GLOSSARY_ID}"`);
    expect(html).toContain(`data-glossary-id="${KITCHENER_STITCH_GLOSSARY_ID}"`);
    expect(html).not.toContain("top of the toes");
    expect(html).not.toContain("Bind off the toe seam");
    expect(html).toContain(`data-tip-id="${SOCK_WHY_STOP_ROW_COUNTER_TIP_ID}"`);
    expect(html).toContain(`data-tip-id="${SOCK_HEEL_VIDEO_TIP_ID}"`);
    expect(html).toContain(`player.vimeo.com/video/${SOCK_HEEL_VIDEO_VIMEO_ID}`);
    expect(html).toContain(`data-tip-id="${SOCK_TOE_VIDEO_TIP_ID}"`);
    expect(html).toContain(`player.vimeo.com/video/${SOCK_TOE_VIDEO_VIMEO_ID}`);
    expect(html).toContain(`data-tip-id="${SOCK_TOE_FINISHING_VIDEO_TIP_ID}"`);
    expect(html).toContain(`player.vimeo.com/video/${SOCK_TOE_FINISHING_VIDEO_VIMEO_ID}`);
    expect(html).toContain(`data-tip-id="${SOCK_CUFF_CAST_ON_VIDEO_TIP_ID}"`);
    expect(html).toContain(`class="pattern-tip pattern-quick-tip"`);
    expect(html).toContain(SOCK_CUFF_CAST_ON_VIDEO_TITLE);
    expect(html).toContain(`player.vimeo.com/video/${SOCK_CUFF_CAST_ON_VIDEO_VIMEO_ID}`);
    expect(html).toContain(`data-tip-id="${SOCK_ANKLE_VIDEO_TIP_ID}"`);
    expect(html).toContain(SOCK_ANKLE_VIDEO_TITLE);
    expect(html).toContain(`player.vimeo.com/video/${SOCK_ANKLE_VIDEO_VIMEO_ID}`);
    expect(html).toContain("Cast on");
    expect(html).toContain("with the method of your choice.");
    expect(html).not.toContain("(top of leg)");
    expect(html).not.toContain("Use the cast-on method of your choice.");
    expect(html).not.toContain(`data-glossary-id="${SCRAP_AND_RAVEL_CAST_ON_GLOSSARY_ID}"`);
    expect(html.match(/data-section-id="ankle"/g)?.length).toBe(2);
    expect(html.match(/data-section-id="foot"/g)?.length).toBe(2);
    expect(result.sock1.sections.filter((s) => s.id === "ankle")).toHaveLength(1);
    expect(result.sock1.sections.filter((s) => s.id === "foot")).toHaveLength(1);
    assertStitchContinuity(result.sock1);
    assertStitchContinuity(result.sock2);
  });

  it("renders Toe-Up with cuff bind-off and the same physical orientation", () => {
    const result = mustPattern(completeDraft({ constructionDirection: "toe-up" }));
    const html = renderSockPatternPairHtml(result.sock1, result.sock2);
    expect(html).toContain("Sock 1 — Toe Up");
    expect(html).toContain("Sock 2 — Toe Up");
    expect(html).toContain("Bind off");
    expect(html).toContain("at the cuff");
    expect(html).not.toContain("waste yarn");
    expect(html).toContain(`<h4>${SOCK_TOE_UP_OPENING_SECTION_TITLE}</h4>`);
    expect(html).toContain(`data-glossary-id="${SCRAP_AND_RAVEL_CAST_ON_GLOSSARY_ID}"`);
    expect(html).toContain(`data-aria-label="${SCRAP_AND_RAVEL_CAST_ON_GLOSSARY_TERM}"`);
    expect(html).toContain('data-term="Scrap on"');
    expect(html).not.toContain("(full foot / tube)");
    expect(html).not.toContain("Use the cast-on method of your choice.");
    expect(html).not.toContain(`player.vimeo.com/video/${SOCK_CUFF_CAST_ON_VIDEO_VIMEO_ID}`);
    expect(html).not.toContain(`data-tip-id="${SOCK_CUFF_CAST_ON_VIDEO_TIP_ID}"`);
    expect(html).toContain(`player.vimeo.com/video/${SOCK_ANKLE_VIDEO_VIMEO_ID}`);
    expect(html).toContain(`data-tip-id="${SOCK_ANKLE_VIDEO_TIP_ID}"`);
    expect(html).not.toContain(`player.vimeo.com/video/${SOCK_HEEL_VIDEO_VIMEO_ID}`);
    expect(html).not.toContain(`player.vimeo.com/video/${SOCK_TOE_VIDEO_VIMEO_ID}`);
    expect(html).not.toContain(`player.vimeo.com/video/${SOCK_TOE_FINISHING_VIDEO_VIMEO_ID}`);
    expect(html).not.toContain(`data-tip-id="${SOCK_HEEL_VIDEO_TIP_ID}"`);
    expect(html).not.toContain(`data-tip-id="${SOCK_TOE_VIDEO_TIP_ID}"`);
    expect(html).not.toContain(`data-tip-id="${SOCK_TOE_FINISHING_VIDEO_TIP_ID}"`);
    expect(html).not.toContain(`data-tip-id="${SOCK_WHY_STOP_ROW_COUNTER_TIP_ID}"`);
    expect(html).not.toContain("Finish the toe using");
    expect(html).not.toContain("Choose a finishing method:");
    expect(result.sock1.sections.map((s) => s.id)).toEqual([
      "cast-on",
      "toe",
      "foot",
      "heel",
      "ankle",
      "leg",
      "finishing",
    ]);
    expect(result.sock1.sections.find((s) => s.id === "toe")?.orientation).toMatchObject({
      carriageStartSide: "right",
      holdHalf: "left",
      workHalf: "right",
    });
  });
});

describe("Sock 1 / Sock 2 orientation", () => {
  it("forms Sock 1 heel and toe on the RIGHT and Sock 2 on the LEFT", () => {
    const result = mustPattern(completeDraft());
    expect(result.sock1.sections.find((s) => s.id === "heel")?.orientation).toMatchObject({
      carriageStartSide: "right",
      holdHalf: "left",
      workHalf: "right",
    });
    expect(result.sock1.sections.find((s) => s.id === "toe")?.orientation).toMatchObject({
      carriageStartSide: "right",
      holdHalf: "left",
      workHalf: "right",
    });
    expect(result.sock2.sections.find((s) => s.id === "heel")?.orientation).toMatchObject({
      carriageStartSide: "left",
      holdHalf: "right",
      workHalf: "left",
    });
    expect(result.sock2.sections.find((s) => s.id === "toe")?.orientation).toMatchObject({
      carriageStartSide: "left",
      holdHalf: "right",
      workHalf: "left",
    });
    const html = renderSockPatternPairHtml(result.sock1, result.sock2);
    expect(html).toContain("carriage on the RIGHT");
    expect(html).toContain("carriage on the LEFT");
  });
});

describe("straight, wider, and narrower legs", () => {
  it("renders a straight leg without Magic Formula copy", () => {
    const result = mustPattern(completeDraft());
    const html = renderSockPatternPairHtml(result.sock1, result.sock2);
    expect(html).toContain("Knit 36 rows even");
    expect(html).not.toContain("Decrease 1 stitch at each side");
    expect(html).not.toContain("Increase 1 stitch at each side");
  });

  it("renders wider-leg Magic Formula decreases cuff to ankle", () => {
    const result = mustPattern(completeDraft({ legCircumference: "10" }));
    const html = renderSockPatternPairHtml(result.sock1, result.sock2);
    expect(html).toContain("Decrease 1 stitch at each side");
    expect(html).toContain("Cast on");
    expect(html).toContain("70 stitches");
    expect(result.sock1.sections.find((s) => s.id === "leg")?.endStitches).toBe(60);
  });

  it("renders narrower-leg Magic Formula increases cuff to ankle", () => {
    const result = mustPattern(completeDraft({ legCircumference: "7" }));
    const html = renderSockPatternPairHtml(result.sock1, result.sock2);
    expect(html).toContain("Increase 1 stitch at each side");
    expect(html).toContain("50 stitches");
  });
});

describe("short-row rendering and header measurements", () => {
  it("uses the shared short-row primitive for heel and toe", () => {
    const result = mustPattern(completeDraft());
    const heel = result.sock1.sections.find((s) => s.id === "heel");
    const toe = result.sock1.sections.find((s) => s.id === "toe");
    expect(heel?.steps.map((s) => s.type)).toEqual([
      "stop-rc",
      "ensure-carriage",
      "place-hold",
      "short-row-in",
      "short-row-wrap-warning",
      "short-row-out",
      "cancel-hold-return",
    ]);
    expect(toe?.steps.map((s) => s.type)).toEqual([
      "stop-rc",
      "place-hold",
      "short-row-in",
      "short-row-wrap-warning",
      "short-row-out",
      "cancel-hold-return",
    ]);
    expect(heel?.steps.map((s) => s.type)).toContain("short-row-in");
    expect(heel?.steps.map((s) => s.type)).toContain("short-row-out");
    expect(heel?.steps.map((s) => s.type)).toContain("short-row-wrap-warning");
    const html = renderSockPatternPairHtml(result.sock1, result.sock2);
    expect(html).toContain("On the carriage side, put 1 needle into hold");
    expect(html).toContain("Opposite the carriage, return 1 needle to work");
    expect(html).toContain("Repeat every row");
  });

  it("lists finished measurements and gauge without derived ankle/heel depth", () => {
    const result = mustPattern(completeDraft());
    const dl = buildSockPatternSummaryDlHtml(result.view, { inline: true });
    expect(dl).toContain("Socks");
    expect(dl).toContain("Foot Circumference");
    expect(dl).toContain("Foot Length");
    expect(dl).toContain("Leg Circumference");
    expect(dl).toContain("Leg Length");
    expect(dl).toContain("Cuff to Toe");
    expect(dl).toContain("Woman Medium");
    expect(dl).toContain("over 4 inches");
    expect(dl).not.toContain("Heel depth");
    expect(dl).not.toContain("derived");
    expect(dl).not.toContain("10%");
  });
});

describe("Pattern page does not recalculate geometry", () => {
  it("does not import Magic Formula or short-row math into the Pattern layer", () => {
    const dir = dirname(fileURLToPath(import.meta.url));
    const sources = [
      resolve(dir, "sockPatternPage.ts"),
      resolve(dir, "sockCanonicalDiagram.ts"),
      resolve(dir, "sockPatternDiagramSvg.ts"),
      resolve(dir, "sockShapingNotationDiagramSvg.ts"),
      resolve(dir, "sockPatternDiagramTabs.ts"),
      resolve(dir, "sockPairInstructionTabs.ts"),
      resolve("src/scripts/socks-pattern-page.ts"),
      resolve("src/pages/patterns/socks/pattern.astro"),
    ].map((path) => readFileSync(path, "utf8"));
    const joined = sources.join("\n");
    expect(joined).not.toMatch(/magicFormulaIntervals/);
    expect(joined).not.toMatch(/remainingStitchesAtOneThird/);
    expect(joined).not.toMatch(/roundToEvenPreferUp/);
    expect(joined).not.toMatch(/computeMagicFormulaPairedShaping/);
    expect(joined).not.toMatch(/calculateShortRowShaping/);
    expect(joined).not.toMatch(/calculateBasicSockPattern/);
    expect(joined).toContain("buildSockPatternFromDraft");
  });

  it("does not embed videos or Kitchener as a Builder choice", () => {
    const patternPage = readFileSync(resolve("src/pages/patterns/socks/pattern.astro"), "utf8");
    expect(patternPage).toContain("PatternTipsToggle");
    expect(patternPage).toContain('storageKey="socks-show-tips"');
    expect(patternPage).toContain('id="socks-pattern-tips-scope"');
    expect(patternPage).toContain("pattern-tips-scope");
    expect(patternPage).not.toContain("vimeo");
    expect(patternPage).not.toContain("hat-pattern-diagram");
    expect(patternPage).toContain('src="/images/patterns/socks-pattern-catalog.webp"');
    expect(patternPage).not.toContain("/images/sock.svg");
    expect(patternPage).not.toContain("kitchener-under");
    expect(patternPage).not.toContain("Fancy Socks");
  });

  it("print CSS keeps both Sock instruction documents and both diagram panels", () => {
    const patternPage = readFileSync(resolve("src/pages/patterns/socks/pattern.astro"), "utf8");
    expect(patternPage).toContain(".socks-pair-tabs__panel[hidden]");
    expect(patternPage).toContain(".sock-pattern-diagram-tabs__panel[hidden]");
    expect(patternPage).toContain(".socks-pair-print-heading");
    expect(patternPage).toContain(".sock-pattern-diagram-print-heading");
    expect(patternPage).toMatch(/@media print/);
  });
});
