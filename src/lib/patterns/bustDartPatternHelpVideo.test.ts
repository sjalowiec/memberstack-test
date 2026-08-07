/**
 * Bust-dart help video on finished sweater patterns (inactive Front prompt + Add/Update modal).
 * Shares content_id 643 with the Dart Formula Tool via dartFormulaHelpVideo.ts.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  BUST_DART_HELP_VIDEO_CONTENT_ID,
  BUST_DART_HELP_WATCH_LABEL,
  BUST_DART_INACTIVE_HELP_NOTE,
  BUST_DART_MODAL_HELP_DESCRIPTION,
  BUST_DART_MODAL_HELP_HEADING,
  DART_FORMULA_HELP_VIDEO_CONTENT_ID,
  renderBustDartInactivePromptHelpHtml,
  renderBustDartModalHelpHtml,
  resolveBustDartHelpVideo,
} from "../tools/dartFormulaHelpVideo";
import {
  OPTIONAL_BUST_DART_TIP_ID,
  renderBustDartCustomizationPrintHtml,
  renderBustDartCustomizationScreenHtml,
} from "./bustDartFrontSlotHtml";
import { calculateBustDart } from "./legoBlocks/bustDart";
import { BUST_DART_STYLE_KEY } from "./bustDartPatternCustomization";
import { generateDropShoulderPattern } from "./dropShoulderPatternOutput";
import { generateSleevelessBackPattern } from "./sleevelessPatternOutput";
import { CUP_DART_BY_SIZE, computeDartShaping } from "../tools/dartFormulaMath";

const here = dirname(fileURLToPath(import.meta.url));
const modalSource = readFileSync(
  join(here, "../../components/patterns/BustDartPatternModal.astro"),
  "utf8",
);
const kinModalSource = readFileSync(
  join(here, "../../components/common/KinCatalogVideoModal.astro"),
  "utf8",
);
const helpModuleSource = readFileSync(join(here, "../tools/dartFormulaHelpVideo.ts"), "utf8");
const frontSlotSource = readFileSync(join(here, "bustDartFrontSlotHtml.ts"), "utf8");

const inactiveBase = {
  kind: "bustDartCustomization" as const,
  active: false,
  cupSize: null as string | null,
  dartStartGarmentRc: 133,
  armholeOpeningGarmentRc: 140,
  placementOffsetRows: 7,
  rowsFromHemToDartStart: 111,
  rowsFromDartToArmhole: 7,
  instructionParagraphs: [] as string[],
  errors: [] as string[],
};

function womenPattern(extraStyle: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    fit: {
      sizingChart: "misses",
      selectedMeasurements: {
        finished_bust_chest: 40,
        back_neck_to_hem: 22,
        armhole_depth: 8,
        neck_opening: 3,
        shoulder_width: 4.25,
        front_neck_depth: 3,
        back_neck_depth: 1,
        upper_arm: 12,
        wrist: 6,
        sleeve_length: 17,
      },
    },
    style: {
      recipientCategory: "misses",
      neckline: "round",
      frontStyle: "closed",
      garmentStyle: "pullover",
      ...extraStyle,
    },
    yarnGaugeMachine: {
      gaugeStitchesPerInch: 5,
      gaugeRowsPerInch: 7,
      availableNeedles: 200,
      gaugeRawUnit: "in",
    },
  };
}

describe("bust dart pattern help video (shared content_id 643)", () => {
  it("shares content_id 643 rather than duplicating it across pattern files", () => {
    expect(BUST_DART_HELP_VIDEO_CONTENT_ID).toBe(643);
    expect(DART_FORMULA_HELP_VIDEO_CONTENT_ID).toBe(BUST_DART_HELP_VIDEO_CONTENT_ID);
    expect(helpModuleSource).toContain("BUST_DART_HELP_VIDEO_CONTENT_ID = 643");
    expect(frontSlotSource).not.toMatch(/\b643\b/);
    expect(modalSource).not.toMatch(/\b643\b/);
    expect(frontSlotSource).not.toMatch(/151859486|player\.vimeo\.com/i);
    expect(modalSource).not.toMatch(/151859486|player\.vimeo\.com/i);
    expect(frontSlotSource).toContain("renderBustDartInactivePromptHelpHtml");
    // Modal no longer embeds help — pattern-page inactive prompt owns the Watch control.
    expect(modalSource).not.toContain("renderBustDartModalHelpHtml");
    expect(modalSource).not.toContain("resolveBustDartHelpVideo");
  });

  it("inactive prompt includes help note and Watch control for KinCatalogVideoModal", () => {
    const video = resolveBustDartHelpVideo();
    expect(video).not.toBeNull();
    const html = renderBustDartCustomizationScreenHtml(inactiveBase);
    expect(html).toContain(OPTIONAL_BUST_DART_TIP_ID);
    expect(html).toContain(BUST_DART_INACTIVE_HELP_NOTE);
    expect(html).toContain(BUST_DART_HELP_WATCH_LABEL);
    expect(html).toContain("kbm-kin-catalog-video");
    expect(html).toContain(`data-vimeo-id="${video!.id}"`);
    expect(html).toContain('data-testid="button-bust-dart-front-help-video"');
    expect(html).toContain('data-testid="button-optional-bust-dart"');
    expect(html).toContain("Add Bust Dart");
    // Add remains primary open control; Watch does not open the dart modal.
    expect(html).not.toMatch(
      /data-testid="button-bust-dart-front-help-video"[^>]*data-bust-dart-pattern-open/,
    );
    expect(kinModalSource).toContain('class="kbm-kin-catalog-video"');
    expect(kinModalSource).toContain("lastFocus.focus");
  });

  it("Watch control does not add a dart; help is inside the hideable tip wrapper", () => {
    const html = renderBustDartCustomizationScreenHtml(inactiveBase);
    const tipOpen = html.indexOf(`data-tip-id="${OPTIONAL_BUST_DART_TIP_ID}"`);
    const helpIdx = html.indexOf("data-bust-dart-front-help");
    const tipCloseApprox = html.indexOf("data-bust-dart-active=\"false\"");
    expect(tipOpen).toBeGreaterThan(-1);
    expect(helpIdx).toBeGreaterThan(tipOpen);
    expect(html).toContain("pattern-tip");
    expect(html).toContain("pattern-print-personalization-never-print");
    expect(html).toContain("no-print");
    void tipCloseApprox;
    // Watching uses catalog trigger only — no dart persist attributes on Watch.
    expect(html).not.toMatch(/button-bust-dart-front-help-video[^>]*(data-bust-dart-pattern-open|data-bust-dart-pattern-remove)/);
  });

  it("inactive help content is excluded from print; active instructions omit help", () => {
    expect(renderBustDartCustomizationPrintHtml(inactiveBase)).toBe("");
    const helpOnly = renderBustDartInactivePromptHelpHtml();
    expect(helpOnly).toContain("no-print");

    const activeHtml = renderBustDartCustomizationScreenHtml({
      ...inactiveBase,
      active: true,
      cupSize: "C",
      instructionParagraphs: [
        "Stop the row counter at RC 133, 1″ below the armhole opening.",
        "On each side of the Front center, place 4 needles in hold.",
      ],
    });
    expect(activeHtml).not.toContain(BUST_DART_INACTIVE_HELP_NOTE);
    expect(activeHtml).not.toContain("button-bust-dart-front-help-video");
    expect(activeHtml).toContain("Update Bust Dart");
    expect(activeHtml).toContain("Remove Bust Dart");
    expect(activeHtml).toContain("Cup C");

    const printActive = renderBustDartCustomizationPrintHtml({
      ...inactiveBase,
      active: true,
      cupSize: "C",
      instructionParagraphs: [
        "Stop the row counter at RC 133, 1″ below the armhole opening.",
        "On each side of the Front center, place 4 needles in hold.",
      ],
    });
    expect(printActive).toMatch(/Stop the row counter/);
    expect(printActive).toMatch(/Cup C/);
    expect(printActive).not.toMatch(/Work the short-row bust darts/);
    expect(printActive).not.toContain(BUST_DART_INACTIVE_HELP_NOTE);
    expect(printActive).not.toContain("Watch:");
  });

  it("Add/Update modal no longer embeds help; helper still renders for other callers", () => {
    const video = resolveBustDartHelpVideo();
    expect(video).not.toBeNull();
    const help = renderBustDartModalHelpHtml(video);
    expect(help).toContain(BUST_DART_MODAL_HELP_HEADING);
    expect(help).toContain(BUST_DART_MODAL_HELP_DESCRIPTION);
    expect(help).toContain(BUST_DART_HELP_WATCH_LABEL);
    expect(help).toContain("kbm-kin-catalog-video");
    expect(help).toContain(`data-vimeo-id="${video!.id}"`);
    expect(help).toContain('data-testid="button-bust-dart-modal-help-video"');
    expect(modalSource).not.toContain("bust-dart-pattern-modal__help-mount");
    expect(modalSource).not.toContain("modalHelpHtml");
    expect(help).toContain('type="button"');
    expect(renderBustDartModalHelpHtml(null)).toBe("");
  });

  it("modal field wiring stays intact without a help mount", () => {
    // Regression guard: width/depth inputs and cup select remain in the modal.
    expect(modalSource).toContain('id="bust-dart-pattern-cup"');
    expect(modalSource).toContain('id="bust-dart-pattern-width"');
    expect(modalSource).toContain('id="bust-dart-pattern-depth"');
    expect(modalSource).toContain("data-bust-dart-modal-add");
    const cupIdx = modalSource.indexOf("bust-dart-pattern-cup");
    const widthIdx = modalSource.indexOf("bust-dart-pattern-width");
    expect(cupIdx).toBeGreaterThan(-1);
    expect(widthIdx).toBeGreaterThan(cupIdx);
    expect(kinModalSource).toContain("lastFocus.focus");
  });

  it("Sleeveless and Drop Shoulder inactive slots render the same tip id and help", () => {
    const sleeveless = generateSleevelessBackPattern(womenPattern());
    const drop = generateDropShoulderPattern(
      womenPattern({
        construction: "drop-shoulder",
        constructionAuthored: "drop-shoulder",
      }),
    );
    const cardigan = generateSleevelessBackPattern(
      womenPattern({ frontStyle: "open", garmentStyle: "cardigan" }),
    );
    for (const gen of [sleeveless, drop, cardigan]) {
      const slot = gen.frontDisplayRows.find((r) => r.kind === "bustDartCustomization");
      expect(slot?.kind === "bustDartCustomization" && !slot.active).toBe(true);
      if (slot?.kind !== "bustDartCustomization") continue;
      const html = renderBustDartCustomizationScreenHtml(slot);
      expect(html).toContain(OPTIONAL_BUST_DART_TIP_ID);
      expect(html).toContain(BUST_DART_INACTIVE_HELP_NOTE);
      expect(html).toContain("Add Bust Dart");
    }
  });

  it("does not change dart calculations, persistence shape, or print of active custom darts", () => {
    expect(CUP_DART_BY_SIZE.C).toEqual({ dartWidth: 3.25, dartDepth: 1 });
    const shaped = computeDartShaping({
      cupKey: "C",
      stitchGauge: 20,
      rowGauge: 28,
      unit: "in",
    });
    expect(shaped.ok).toBe(true);
    if (shaped.ok) {
      expect(shaped.totalHeldStitches).toBe(16);
    }

    const active = calculateBustDart({
      enabled: true,
      cupSize: "C",
      dartWidthInches: 3.75,
      dartDepthInches: 1.1,
      sizeGroup: "misses",
      stitchesPerInch: 5,
      rowsPerInch: 7,
      frontConstruction: "pullover",
      frontStitchCount: 100,
      armholeOpeningGarmentRc: 140,
      hemRows: 22,
      bodyToArmholeRows: 118,
    });
    expect(active.active).toBe(true);
    expect(active.config.dartWidthInches).toBe(3.75);
    expect(active.instructionParagraphs.join("\n")).not.toMatch(/Watch:|Not sure whether/i);

    const gen = generateSleevelessBackPattern(
      womenPattern({
        [BUST_DART_STYLE_KEY]: {
          enabled: true,
          cupSize: "C",
          dartWidthInches: 3.75,
          dartDepthInches: 1.1,
        },
      }),
    );
    const slot = gen.frontDisplayRows.find((r) => r.kind === "bustDartCustomization");
    expect(slot?.kind === "bustDartCustomization" && slot.active).toBe(true);
    if (slot?.kind === "bustDartCustomization") {
      const screen = renderBustDartCustomizationScreenHtml(slot);
      expect(screen).not.toContain(BUST_DART_INACTIVE_HELP_NOTE);
      expect(screen).toContain("Update Bust Dart");
      expect(renderBustDartCustomizationPrintHtml(slot)).toMatch(/Customized|Cup C/);
    }
  });
});
