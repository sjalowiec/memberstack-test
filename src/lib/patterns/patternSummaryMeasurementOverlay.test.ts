import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  DESKTOP_MEASUREMENT_OVERLAY_MIN_STAGE_PX,
  DESKTOP_MEASUREMENT_OVERLAY_MQ,
  EDIT_WORKSPACE_TWO_COLUMN_MIN_PX,
  applyMeasurementTargetToBox,
  clearMeasurementBoxPosition,
  measurementOverlayTargetsAreLaidOut,
  positionMeasurementBox,
  shouldUseDesktopMeasurementOverlay,
} from "./patternSummaryMeasurementOverlay";

const customBuildCss = readFileSync(
  resolve("src/styles/sleeveless-custom-build-measurements.css"),
  "utf8",
);
const confirmCss = readFileSync(
  resolve("src/styles/sleeveless-express-measurements-confirm.css"),
  "utf8",
);
const editDiagramCss = readFileSync(
  resolve("src/styles/patterns/sweater-edit-measurement-diagram.css"),
  "utf8",
);
const overlaySrc = readFileSync(
  resolve("src/lib/patterns/patternSummaryMeasurementOverlay.ts"),
  "utf8",
);
const sleevelessEditAstro = readFileSync(
  resolve("src/pages/patterns/sleeveless/pattern/index.astro"),
  "utf8",
);
const dropShoulderEditAstro = readFileSync(
  resolve("src/pages/patterns/drop-shoulder/pattern/index.astro"),
  "utf8",
);
const customBuildFitAstro = readFileSync(
  resolve("src/pages/patterns/sleeveless/custom-build/fit/index.astro"),
  "utf8",
);
const measurementsPageSrc = readFileSync(
  resolve("src/scripts/sleeveless-custom-build-measurements-page.ts"),
  "utf8",
);

/** Minimal style bag for clearMeasurementBoxPosition (no jsdom). */
class FakeStyle {
  left = "120px";
  top = "80px";
  transform = "translate(-50%, -50%)";
}

class FakeBox {
  style = new FakeStyle();
  dataset: Record<string, string | undefined> = {};
}

describe("patternSummaryMeasurementOverlay — stage-width overlay mode", () => {
  it("uses a stage-width threshold chosen above the crowded-chip clear width", () => {
    expect(DESKTOP_MEASUREMENT_OVERLAY_MIN_STAGE_PX).toBe(640);
    expect(DESKTOP_MEASUREMENT_OVERLAY_MIN_STAGE_PX).toBeGreaterThan(570);
  });

  it("treats a wide viewport with an artificially narrow stage as stacked", () => {
    expect(shouldUseDesktopMeasurementOverlay(420)).toBe(false);
    expect(shouldUseDesktopMeasurementOverlay(560)).toBe(false);
    expect(shouldUseDesktopMeasurementOverlay(639)).toBe(false);
  });

  it("uses on-diagram inputs when the stage is at tablet/laptop readable width", () => {
    // After removing the Sleeveless vh width cap, ~1280×720 two-column stages land ~750–820px.
    expect(shouldUseDesktopMeasurementOverlay(640)).toBe(true);
    expect(shouldUseDesktopMeasurementOverlay(750)).toBe(true);
    expect(shouldUseDesktopMeasurementOverlay(800)).toBe(true);
    expect(shouldUseDesktopMeasurementOverlay(1000)).toBe(true);
  });

  it("uses stacked fallback for genuinely phone-sized stages", () => {
    expect(shouldUseDesktopMeasurementOverlay(320)).toBe(false);
    expect(shouldUseDesktopMeasurementOverlay(390)).toBe(false);
  });

  it("does not decide overlay mode solely from the legacy 700px viewport media query", () => {
    expect(DESKTOP_MEASUREMENT_OVERLAY_MQ).toBe("(min-width: 700px)");
    expect(overlaySrc).toContain("shouldUseDesktopMeasurementOverlay");
    expect(overlaySrc).toContain("ResizeObserver");
    expect(overlaySrc).toContain("DESKTOP_MEASUREMENT_OVERLAY_MIN_STAGE_PX");
    expect(overlaySrc).not.toMatch(
      /bindPatternSummaryOverlayPositioning[\s\S]*matchMedia\(\s*DESKTOP_MEASUREMENT_OVERLAY_MQ/,
    );
    expect(overlaySrc).toMatch(
      /const desktop = width > 0 && shouldUseDesktopMeasurementOverlay\(width\)/,
    );
  });

  it("starts stacked to avoid a flash of overlapping absolute chips", () => {
    expect(overlaySrc).toContain("applyModeClass(false)");
    expect(overlaySrc).toContain("Stacked until the first real measurement");
    expect(measurementsPageSrc).toMatch(/dataset\.measurementOverlayMode = "mobile"/);
  });

  it("clears absolute left/top/transform so mobile panel CSS can take over", () => {
    const box = new FakeBox();
    clearMeasurementBoxPosition(box as unknown as HTMLElement);
    expect(box.style.left).toBe("");
    expect(box.style.top).toBe("");
    expect(box.style.transform).toBe("");
  });

  it("stamps measurement target ids used by the shared overlay binder", () => {
    const box = new FakeBox();
    applyMeasurementTargetToBox(box as unknown as HTMLElement, "target_bust");
    expect(box.dataset.measurementTarget).toBe("target_bust");

    applyMeasurementTargetToBox(box as unknown as HTMLElement, "target_neck_opening", {
      transform: "translate(-50%, -100%)",
    });
    expect(box.dataset.measurementTarget).toBe("target_neck_opening");
    expect(box.dataset.measurementTransform).toBe("translate(-50%, -100%)");
  });

  it("clears coords in stacked mode for the under-diagram Measurements panel", () => {
    expect(overlaySrc).toMatch(/if\s*\(\s*!desktop\s*\)\s*\{[\s\S]*clearMeasurementBoxPosition/);
    expect(overlaySrc).not.toContain("positionMeasurementBoxesMobile");
  });

  it("does not park chips offscreen when a replaced SVG target has no layout yet", () => {
    const cssEscape = (globalThis as { CSS?: { escape: (value: string) => string } }).CSS;
    if (!cssEscape) {
      (globalThis as { CSS: { escape: (value: string) => string } }).CSS = {
        escape: (value) => value,
      };
    }
    const box = new FakeBox();
    const overlay = {
      getBoundingClientRect: () => ({ left: 120, top: 80, width: 640, height: 640 }),
    };
    const svg = {
      querySelector: () => ({
        getBoundingClientRect: () => ({ left: 0, top: 0, width: 0, height: 0 }),
      }),
    };
    const placed = positionMeasurementBox(
      box as unknown as HTMLElement,
      svg as unknown as SVGElement,
      overlay as unknown as HTMLElement,
      "target_bust",
    );
    expect(placed).toBe(false);
    expect(box.style.left).toBe("120px");
    expect(box.style.top).toBe("80px");
    expect(measurementOverlayTargetsAreLaidOut(svg as unknown as SVGElement, [{ targetId: "target_bust" }])).toBe(
      false,
    );
    expect(overlaySrc).toContain("measurementOverlayTargetsAreLaidOut");
    expect(overlaySrc).toContain("cleanup.retarget = retarget");
  });
});

describe("shared stacked measurement panel CSS contract", () => {
  it("confirm CSS stacks overlay chips under the diagram via stage overlay mode", () => {
    expect(confirmCss).toMatch(
      /data-measurement-overlay-mode="mobile"[\s\S]*\.express-mbp-overlay\s*\{[\s\S]*position:\s*static/,
    );
    expect(confirmCss).toContain('content: "Measurements"');
    expect(confirmCss).toMatch(
      /data-measurement-overlay-mode="mobile"[\s\S]*\.express-mbp-box\s*\{[\s\S]*position:\s*static/,
    );
    expect(confirmCss).toMatch(
      /data-measurement-overlay-mode="mobile"[\s\S]*\.measure-icon\s*\{[\s\S]*display:\s*none/,
    );
    expect(confirmCss).toMatch(/grid-template-columns:\s*1fr;/);
    expect(confirmCss).not.toMatch(
      /@media \(max-width:\s*699\.98px\)[\s\S]*\.express-mbp-overlay\s*\{[\s\S]*position:\s*static/,
    );
  });

  it("custom-build CSS must not re-force absolute overlay chips in stacked mode", () => {
    expect(customBuildCss).not.toMatch(
      /data-measurement-overlay-mode="mobile"[\s\S]*\.express-mbp-overlay\s*\{[\s\S]*position:\s*absolute/,
    );
    expect(customBuildCss).not.toMatch(
      /data-measurement-overlay-mode="mobile"[\s\S]*\.express-mbp-box\s*\{[\s\S]*position:\s*absolute/,
    );
  });

  it("Sleeveless + Drop Shoulder Edit and Custom Build fit share measurement stylesheets", () => {
    for (const src of [sleevelessEditAstro, dropShoulderEditAstro, customBuildFitAstro]) {
      expect(src).toContain("sleeveless-express-measurements-confirm.css");
      expect(src).toContain("sleeveless-custom-build-measurements.css");
    }
  });
});

describe("shared sweater edit measurement diagram sizing contract", () => {
  it("both Edit Pattern pages import the shared sizing stylesheet", () => {
    for (const src of [sleevelessEditAstro, dropShoulderEditAstro]) {
      expect(src).toContain("sweater-edit-measurement-diagram.css");
    }
  });

  it("sizes the diagram from content width and never from viewport height", () => {
    expect(editDiagramCss).toMatch(/max-width:\s*min\(100%,\s*1000px\)/);
    expect(editDiagramCss).not.toContain("calc(100vh - 300px)");
    expect(editDiagramCss).not.toMatch(/max-width:[^;]*100vh/);
    expect(sleevelessEditAstro).not.toContain("calc(100vh - 300px)");
    expect(dropShoulderEditAstro).not.toContain("calc(100vh - 300px)");
  });

  it("keeps laptop/tablet-readable stages in overlay mode after the height-cap removal", () => {
    // Content-width stages at the approved viewports exceed the phone fallback.
    for (const stageWidth of [750, 800, 900]) {
      expect(shouldUseDesktopMeasurementOverlay(stageWidth)).toBe(true);
    }
  });

  it("enlarged on-diagram chips live in the shared stylesheet and require desktop overlay mode", () => {
    expect(editDiagramCss).toContain(
      '.express-mbp-stage[data-measurement-overlay-mode="desktop"]',
    );
    expect(editDiagramCss).toMatch(
      /data-measurement-overlay-mode="desktop"[\s\S]*\.measurement-chip/,
    );
  });

  it("preserves tall-diagram scrolling via construction stamp, not pattern-name branching", () => {
    expect(editDiagramCss).toContain('[data-express-construction="drop-shoulder"]');
    expect(editDiagramCss).toMatch(
      /data-express-construction="drop-shoulder"[\s\S]*\.express-mbp-scroll[\s\S]*overflow-y:\s*auto/,
    );
    expect(editDiagramCss).not.toMatch(/drop-shoulder\/pattern|sleeveless\/pattern/);
  });

  it("does not give the Measurements column a second two-column scrollport", () => {
    const twoColStart = editDiagramCss.indexOf("@container sl-edit-workspace (min-width: 1100px)");
    expect(twoColStart).toBeGreaterThan(-1);
    const twoColBlock = editDiagramCss.slice(twoColStart);
    expect(twoColBlock).toMatch(
      /\.sl-edit-workspace__measure \.sl-measure-workspace__body\s*\{[^}]*overflow:\s*visible/s,
    );
    expect(twoColBlock).not.toMatch(
      /\.sl-edit-workspace__measure \.sl-measure-workspace__body\s*\{[^}]*overflow-y:\s*auto/s,
    );
    expect(editDiagramCss).toMatch(
      /\.sl-edit-workspace__measure[\s\S]*data-express-construction="drop-shoulder"[\s\S]*\.express-mbp-scroll[\s\S]*overflow:\s*visible/,
    );
    expect(editDiagramCss).toMatch(
      /\.sl-edit-workspace__measure \.express-mbp-scroll\s*\{[^}]*overflow:\s*visible/s,
    );
    expect(editDiagramCss).not.toMatch(
      /\.sl-edit-workspace__measure[\s\S]*\.express-mbp-scroll[\s\S]*overflow-x:\s*hidden[\s\S]*overflow-y:\s*visible/,
    );
  });

  it("leaves only aspect-ratio tokens on the pattern pages", () => {
    expect(sleevelessEditAstro).toContain("--pattern-summary-aspect-ratio: 210.2 / 210.2");
    expect(dropShoulderEditAstro).toContain("--pattern-summary-aspect-ratio: 228.87 / 423.24");
    expect(sleevelessEditAstro).not.toMatch(
      /\.express-mbp-stage\[data-measurement-overlay-mode="desktop"\] \.measurement-chip/,
    );
    expect(dropShoulderEditAstro).not.toMatch(
      /\.express-mbp-stage\[data-measurement-overlay-mode="desktop"\] \.measurement-chip/,
    );
  });
});

describe("Edit Pattern workspace container-width contract", () => {
  it("exports the two-column container breakpoint used by both edit workspaces", () => {
    expect(EDIT_WORKSPACE_TWO_COLUMN_MIN_PX).toBe(1100);
  });

  it("both edit workspaces use container queries for two-column vs stacked layout", () => {
    for (const src of [sleevelessEditAstro, dropShoulderEditAstro]) {
      expect(src).toContain("container-type: inline-size");
      expect(src).toContain("container-name: sl-edit-workspace");
      expect(src).toContain("@container sl-edit-workspace (min-width: 1100px)");
      expect(src).toContain("@container sl-edit-workspace (max-width: 1099.98px)");
      expect(src).not.toMatch(/@media \(min-width:\s*1000px\)\s*\{[\s\S]*\.sl-edit-workspace__layout/);
      expect(src).not.toMatch(/@media \(max-width:\s*999px\)\s*\{[\s\S]*\.sl-edit-workspace__measure-actions/);
    }
  });
});
