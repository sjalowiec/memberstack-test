/**
 * Simplified Optional Bust Dart modal: no help video, compact summary, cup-first layout,
 * correct Add vs Update/Remove action states.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it } from "vitest";
import {
  buildBustDartModalSummaryLine,
  buildBustDartPatternContext,
} from "../lib/patterns/bustDartPatternCustomization";
import { stubLocalStorage } from "../lib/patterns/test/stubLocalStorage";

const here = dirname(fileURLToPath(import.meta.url));
const modalSource = readFileSync(
  join(here, "../components/patterns/BustDartPatternModal.astro"),
  "utf8",
);
const clientSource = readFileSync(join(here, "bustDartPatternModalClient.ts"), "utf8");
const frontSlotSource = readFileSync(
  join(here, "../lib/patterns/bustDartFrontSlotHtml.ts"),
  "utf8",
);

describe("BustDartPatternModal simplified layout", () => {
  it("does not mount the Watch help video section (pattern page keeps it)", () => {
    expect(modalSource).not.toContain("renderBustDartModalHelpHtml");
    expect(modalSource).not.toContain("resolveBustDartHelpVideo");
    expect(modalSource).not.toContain("bust-dart-pattern-modal__help-mount");
    expect(modalSource).not.toContain("data-bust-dart-modal-help");
    expect(modalSource).not.toContain("Watch: Bust Darts for Better Fit");
    expect(frontSlotSource).toContain("renderBustDartInactivePromptHelpHtml");
  });

  it("shows a compact summary line instead of Pattern/Style/Gauge/Front stitches rows", () => {
    expect(modalSource).toContain("data-bust-dart-modal-summary-line");
    expect(modalSource).not.toContain("data-bust-dart-summary-construction");
    expect(modalSource).not.toContain("data-bust-dart-summary-garment");
    expect(modalSource).not.toContain("data-bust-dart-summary-gauge");
    expect(modalSource).not.toContain("data-bust-dart-summary-front-sts");
    expect(modalSource).not.toContain(">Gauge<");
    expect(modalSource).not.toContain("Front stitches");
    expect(clientSource).toContain("ctx.summary.summaryLine");
    expect(clientSource).not.toContain("data-bust-dart-summary-gauge");
  });

  it("places cup size immediately after intro + summary; dims stay until a cup is chosen", () => {
    const introIdx = modalSource.indexOf("bust-dart-pattern-modal__intro");
    const summaryIdx = modalSource.indexOf("data-bust-dart-modal-summary-line");
    const cupIdx = modalSource.indexOf('id="bust-dart-pattern-cup"');
    const dimsIdx = modalSource.indexOf("data-bust-dart-modal-dims");
    expect(introIdx).toBeGreaterThan(-1);
    expect(summaryIdx).toBeGreaterThan(introIdx);
    expect(cupIdx).toBeGreaterThan(summaryIdx);
    expect(dimsIdx).toBeGreaterThan(cupIdx);
    expect(modalSource).toMatch(/data-bust-dart-modal-dims[^>]*\bhidden\b/);
    expect(clientSource).toContain("setDimsVisible");
    expect(clientSource).toMatch(/setDimsVisible\(modal,\s*!!parseCupSizeInput/);
    expect(clientSource).toMatch(/setDimsVisible\(modal,\s*!!cup\)/);
  });
});

describe("BustDartPatternModal action states", () => {
  it("Remove is hidden until an active dart exists; labels switch Add vs Update", () => {
    expect(modalSource).toMatch(/data-bust-dart-modal-remove[\s\S]*?\bhidden\b/);
    expect(clientSource).toContain("removeBtn.hidden = !hasActive");
    expect(clientSource).toContain('primary.textContent = hasActive ? "Update Pattern" : "Add to Pattern"');
    expect(clientSource).toContain('title.textContent = hasActive ? "Change Bust Dart" : "Optional Bust Dart"');
    expect(modalSource).toContain("data-bust-dart-modal-cancel");
    expect(modalSource).toContain("data-bust-dart-modal-add");
    expect(modalSource).toMatch(/Remove Bust Dart/i);
  });
});

describe("buildBustDartModalSummaryLine", () => {
  it("combines construction, garment, audience, and finished bust", () => {
    expect(
      buildBustDartModalSummaryLine({
        constructionLabel: "Sleeveless",
        garmentLabel: "Pullover",
        sizeGroup: "misses",
        finishedBustInches: 38,
        unit: "in",
      }),
    ).toBe("Sleeveless Pullover • Women's 38");
    expect(
      buildBustDartModalSummaryLine({
        constructionLabel: "Drop Shoulder",
        garmentLabel: "Cardigan",
        sizeGroup: "misses",
        finishedBustInches: 40,
        unit: "in",
      }),
    ).toBe("Drop Shoulder Cardigan • Women's 40");
  });

  it("formats finished bust for centimeters without changing dart math", () => {
    expect(
      buildBustDartModalSummaryLine({
        constructionLabel: "Sleeveless",
        garmentLabel: "Pullover",
        sizeGroup: "misses",
        finishedBustInches: 40,
        unit: "cm",
      }),
    ).toBe("Sleeveless Pullover • Women's 101.6");
  });
});

describe("buildBustDartPatternContext summary line (Sleeveless + Drop Shoulder)", () => {
  beforeEach(() => {
    stubLocalStorage();
  });

  function womenPattern(extraStyle: Record<string, unknown> = {}): Record<string, unknown> {
    return {
      fit: {
        sizingChart: "misses",
        selectedMeasurements: {
          finished_bust_chest: 38,
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
      yarnGauge: { gaugeRawUnit: "in", stitchGauge: "5", rowGauge: "7" },
      yarnGaugeMachine: {
        gaugeStitchesPerInch: 5,
        gaugeRowsPerInch: 7,
        availableNeedles: 200,
        gaugeRawUnit: "in",
      },
    };
  }

  it("builds the compact line for sleeveless and drop shoulder", () => {
    const sleeveless = buildBustDartPatternContext(womenPattern());
    expect(sleeveless.summary.summaryLine).toBe("Sleeveless Pullover • Women's 38");
    expect(sleeveless.summary.gaugeLabel).toMatch(/sts/);
    expect(sleeveless.frontStitchCount).toBeGreaterThan(0);

    const drop = buildBustDartPatternContext(
      womenPattern({
        construction: "drop-shoulder",
        constructionAuthored: "drop-shoulder",
      }),
    );
    expect(drop.summary.summaryLine).toBe("Drop Shoulder Pullover • Women's 38");

    const cardigan = buildBustDartPatternContext(
      womenPattern({ frontStyle: "open", garmentStyle: "cardigan" }),
    );
    expect(cardigan.summary.summaryLine).toBe("Sleeveless Cardigan • Women's 38");
  });
});
