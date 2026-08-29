import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { EDIT_WORKSPACE_TWO_COLUMN_MIN_PX } from "./patternSummaryMeasurementOverlay";
import {
  PATTERN_SUMMARY_EDIT_WORKSPACE_ATTR,
  PATTERN_SUMMARY_MEASURE_CHIP_CLASS,
  PATTERN_SUMMARY_MEASURE_CHIP_INVALID_CLASS,
} from "./patternSummaryMeasurementField";
import { HAT_SUMMARY_MEASUREMENT_FIELDS } from "./hat/hatPatternEditTargets";

const workspaceAstro = readFileSync(
  resolve("src/components/patterns/PatternSummaryEditWorkspace.astro"),
  "utf8",
);
const chipAstro = readFileSync(
  resolve("src/components/patterns/PatternSummaryMeasurementChip.astro"),
  "utf8",
);
const stageAstro = readFileSync(
  resolve("src/components/patterns/PatternSummaryDiagramStage.astro"),
  "utf8",
);
const workspaceCss = readFileSync(
  resolve("src/styles/patterns/pattern-summary-edit-workspace.css"),
  "utf8",
);
const workspaceFieldSrc = readFileSync(
  resolve("src/lib/patterns/patternSummaryMeasurementField.ts"),
  "utf8",
);
const overlaySrc = readFileSync(
  resolve("src/lib/patterns/patternSummaryMeasurementOverlay.ts"),
  "utf8",
);
const hatSummaryPage = readFileSync(
  resolve("src/pages/patterns/hat/summary/index.astro"),
  "utf8",
);
const hatSummaryScript = readFileSync(
  resolve("src/scripts/hat-pattern-summary-page.ts"),
  "utf8",
);
const sleevelessPattern = readFileSync(
  resolve("src/pages/patterns/sleeveless/pattern/index.astro"),
  "utf8",
);
const dropShoulderPattern = readFileSync(
  resolve("src/pages/patterns/drop-shoulder/pattern/index.astro"),
  "utf8",
);

const PATTERN_NAME_BRANCH = /if\s*\(?\s*(hat|drop[\s-]?shoulder|sleeveless)/i;

describe("PatternSummaryEditWorkspace Lego block", () => {
  it("owns layout, actions, and slots without garment-name branching", () => {
    expect(workspaceAstro).toContain('slot name="quick"');
    expect(workspaceAstro).toContain('slot name="diagram"');
    expect(workspaceAstro).toContain('slot name="actions"');
    expect(workspaceAstro).toContain('slot name="heading"');
    expect(workspaceAstro).toContain("sl-edit-workspace__layout");
    expect(workspaceAstro).toContain("sl-edit-workspace__quick");
    expect(workspaceAstro).toContain("sl-edit-workspace__measure");
    expect(workspaceAstro).toContain("sl-edit-workspace__measure-actions");
    expect(workspaceAstro).toContain(PATTERN_SUMMARY_EDIT_WORKSPACE_ATTR);
    expect(workspaceAstro).not.toMatch(PATTERN_NAME_BRANCH);
    expect(workspaceCss).not.toMatch(PATTERN_NAME_BRANCH);
    expect(workspaceFieldSrc).not.toMatch(PATTERN_NAME_BRANCH);
    expect(chipAstro).not.toMatch(PATTERN_NAME_BRANCH);
    expect(stageAstro).not.toMatch(PATTERN_NAME_BRANCH);
  });

  it("uses the shared 1100px container query for two-column vs stacked layout", () => {
    expect(EDIT_WORKSPACE_TWO_COLUMN_MIN_PX).toBe(1100);
    expect(workspaceCss).toContain("container-type: inline-size");
    expect(workspaceCss).toContain("container-name: sl-edit-workspace");
    expect(workspaceCss).toContain("@container sl-edit-workspace (min-width: 1100px)");
    expect(workspaceCss).toContain("@container sl-edit-workspace (max-width: 1099.98px)");
    expect(workspaceCss).toContain("flex-direction: row");
    expect(workspaceCss).toContain("flex: 1 1 0");
    expect(workspaceCss).toContain("overflow-x: hidden");
    expect(workspaceCss).toContain("overflow-x: clip");
    expect(workspaceCss).not.toMatch(
      /@media \(min-width:\s*1000px\)\s*\{[\s\S]*\.sl-edit-workspace__layout/,
    );
  });

  it("keeps one primary vertical scroll on the overlay workspace at two-column", () => {
    expect(workspaceCss).toMatch(
      /\.sl-edit-drawer--workspace \.sl-edit-workspace__layout\s*\{[^}]*overflow-y:\s*auto/s,
    );
    const twoColStart = workspaceCss.indexOf("@container sl-edit-workspace (min-width: 1100px)");
    const stackedStart = workspaceCss.indexOf("@container sl-edit-workspace (max-width: 1099.98px)");
    expect(twoColStart).toBeGreaterThan(-1);
    expect(stackedStart).toBeGreaterThan(twoColStart);
    const twoColBlock = workspaceCss.slice(twoColStart, stackedStart);
    expect(twoColBlock).toContain("flex-direction: row");
    expect(twoColBlock).toMatch(
      /\.sl-edit-drawer--workspace \.sl-edit-workspace__layout\s*\{[^}]*overflow-y:\s*auto/s,
    );
    expect(twoColBlock).not.toMatch(
      /\.sl-edit-drawer--workspace \.sl-edit-workspace__layout\s*\{[^}]*overflow:\s*hidden/s,
    );
    expect(twoColBlock).not.toMatch(
      /\.sl-edit-drawer--workspace \.sl-edit-workspace__measure\s*\{[^}]*overflow:\s*hidden/s,
    );
    expect(twoColBlock).toMatch(
      /\.sl-edit-workspace__layout\s*\{[^}]*align-items:\s*flex-start/s,
    );
  });

  it("does not require focus/click before wheel can reach the overlay scrollport", () => {
    expect(workspaceAstro).not.toMatch(/sl-edit-workspace__layout[^>]*tabindex/);
    expect(workspaceCss).toMatch(
      /\.sl-edit-workspace \.sl-edit-drawer__body\s*\{[^}]*overflow:\s*visible/s,
    );
    expect(workspaceCss).toMatch(
      /\.sl-edit-workspace__measure\s*\{[^}]*overflow-x:\s*clip/s,
    );
    expect(workspaceCss).toMatch(
      /\.sl-edit-workspace\s*\{[^}]*overflow-x:\s*clip/s,
    );
    expect(workspaceCss).not.toMatch(
      /\.sl-edit-workspace__measure\s*\{[^}]*overflow-x:\s*hidden/s,
    );
    expect(sleevelessPattern).toContain("PatternSummaryEditWorkspace");
    expect(dropShoulderPattern).toContain("PatternSummaryEditWorkspace");
    expect(sleevelessPattern).toContain("sl-edit-drawer--workspace");
    expect(dropShoulderPattern).toContain("sl-edit-drawer--workspace");
  });

  it("renders compact measurement chips and stacks them on a narrow stage", () => {
    expect(chipAstro).toContain(PATTERN_SUMMARY_MEASURE_CHIP_CLASS);
    expect(chipAstro).toContain("data-measurement-target");
    expect(chipAstro).toContain("ps-measure-chip__input");
    expect(workspaceCss).toContain(".ps-measure-chip");
    expect(workspaceCss).toMatch(/\.ps-measure-chip__input\s*\{[^}]*width:\s*6\.5ch/s);
    expect(workspaceCss).toMatch(/\.ps-measure-chip__input\s*\{[^}]*min-width:\s*6\.5ch/s);
    expect(workspaceCss).not.toMatch(/\.ps-measure-chip__input\s*\{[^}]*max-width:\s*3\.35rem/s);
    expect(workspaceCss).toMatch(/\.ps-measure-chip__unit\s*\{[^}]*min-width:\s*1\.45em/s);
    expect(workspaceCss).toContain("appearance: textfield");
    expect(workspaceCss).toContain('data-measurement-overlay-mode="mobile"');
    expect(workspaceCss).toContain(
      '.ps-measure-stage__inner[data-measurement-overlay-mode="desktop"]',
    );
    expect(workspaceCss).toMatch(
      /data-measurement-overlay-mode="desktop"[\s\S]*padding:\s*0\.35rem 5\.5rem 2\.35rem 0\.5rem/,
    );
    expect(workspaceCss).not.toContain("0 2px 8px");
    expect(workspaceCss).toMatch(
      /\[data-measurement-overlay-mode="mobile"\][^{]*\{[^}]*position:\s*static/s,
    );
    expect(overlaySrc).toContain("ps-measure-stage");
  });
});

describe("Hat Summary/Edit uses the shared Lego block", () => {
  it("plugs hat controls and the generated hat diagram into the shared workspace", () => {
    expect(hatSummaryPage).toContain("PatternSummaryEditWorkspace");
    expect(hatSummaryPage).toContain("PatternSummaryDiagramStage");
    expect(hatSummaryPage).toContain("PatternSummaryMeasurementChip");
    expect(hatSummaryPage).toContain("HAT_SUMMARY_MEASUREMENT_FIELDS");
    expect(hatSummaryPage).toContain("Pattern choices");
    expect(hatSummaryPage).toContain("data-hat-edit-size");
    expect(hatSummaryPage).toContain("data-hat-edit-fit");
    expect(hatSummaryPage).toContain("data-hat-edit-brim-type");
    expect(hatSummaryPage).toContain("data-hat-edit-crown");
    expect(hatSummaryPage).toContain("data-hat-edit-stitch-gauge");
    expect(hatSummaryPage).toContain("data-hat-edit-units");
    expect(hatSummaryPage).toContain("data-hat-edit-diagram");
    expect(hatSummaryPage).not.toContain("hat-edit-mbp-box");
    expect(hatSummaryPage).not.toMatch(/Finished hat size[\s\S]{0,200}hat-edit-card/);
  });

  it("associates finished size, length, and brim height with the hat diagram", () => {
    const ids = HAT_SUMMARY_MEASUREMENT_FIELDS.map((field) => field.id);
    expect(ids).toEqual(["circumference", "length", "brim"]);
    expect(HAT_SUMMARY_MEASUREMENT_FIELDS.map((field) => field.label)).toEqual([
      "Finished hat size",
      "Finished hat length",
      "Visible Brim Height",
    ]);
    expect(HAT_SUMMARY_MEASUREMENT_FIELDS.map((field) => field.targetId)).toEqual([
      "target_hat_circumference",
      "target_hat_length",
      "target_hat_brim",
    ]);
    expect(HAT_SUMMARY_MEASUREMENT_FIELDS.map((field) => field.inputDataAttr)).toEqual([
      "data-hat-edit-circ",
      "data-hat-edit-length",
      "data-hat-edit-brim",
    ]);
    expect(hatSummaryScript).toContain("buildHatPatternDiagramSvg");
    expect(hatSummaryScript).toContain("HAT_PATTERN_DIAGRAM_MODE_SUMMARY_EDIT");
    expect(hatSummaryScript).toContain("bindPatternSummaryOverlayPositioning");
    expect(hatSummaryScript).toContain(PATTERN_SUMMARY_MEASURE_CHIP_INVALID_CLASS);
    expect(hatSummaryScript).not.toContain("hat-edit-mbp-box");
  });

  it("does not duplicate large measurement cards below the diagram", () => {
    expect(hatSummaryPage).not.toContain("hat-edit-measure-cards");
    expect(hatSummaryPage).not.toContain("hat-edit-mbp-box");
    expect(hatSummaryPage).toContain("PatternSummaryMeasurementChip");
    expect(hatSummaryPage).toContain('slot="diagram"');
    const diagramStart = hatSummaryPage.indexOf('slot="diagram"');
    const diagramEnd = hatSummaryPage.indexOf("</PatternSummaryDiagramStage>", diagramStart);
    const diagramSlot = hatSummaryPage.slice(diagramStart, diagramEnd);
    expect(diagramSlot).toContain("PatternSummaryMeasurementChip");
    expect(diagramSlot).not.toContain("hat-edit-gauge-grid");
  });
});

describe("Sweater Summary/Edit shells use the shared Lego block", () => {
  it("Drop Shoulder and Sleeveless wrap existing controls and diagrams in the shared workspace", () => {
    for (const src of [sleevelessPattern, dropShoulderPattern]) {
      expect(src).toContain("PatternSummaryEditWorkspace");
      expect(src).toContain('slot="quick"');
      expect(src).toContain('slot="diagram"');
      expect(src).toContain("data-cb-measure-diagram");
      expect(src).toContain("data-sl-edit-apply");
      expect(src).toContain("Save Changes");
      expect(src).not.toContain("container-name: sl-edit-workspace");
    }
    expect(dropShoulderPattern).toContain("data-drop-shoulder-workspace-measure-summary");
    expect(sleevelessPattern).not.toContain("data-drop-shoulder-workspace-measure-summary");
  });

  it("keeps sweater measurement editors pattern-specific (no hat diagram on sweater pages)", () => {
    expect(sleevelessPattern).not.toContain("buildHatPatternDiagramSvg");
    expect(dropShoulderPattern).not.toContain("buildHatPatternDiagramSvg");
    expect(sleevelessPattern).toContain("sleevelessPatternEditDrawerPrototype.ts");
    expect(dropShoulderPattern).toContain("sleevelessPatternEditDrawerPrototype.ts");
    expect(sleevelessPattern).toContain("data-cb-measure-root");
    expect(dropShoulderPattern).toContain("data-cb-measure-root");
  });
});
