import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  DESKTOP_MEASUREMENT_OVERLAY_MIN_STAGE_PX,
  DESKTOP_MEASUREMENT_OVERLAY_MQ,
  EDIT_WORKSPACE_TWO_COLUMN_MIN_PX,
  applyMeasurementTargetToBox,
  clearMeasurementBoxPosition,
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

  it("treats a wide viewport with a narrow stage as stacked (not overlays)", () => {
    // 1280 CSS px viewport can still yield a height-capped ~420px sleeveless stage.
    expect(shouldUseDesktopMeasurementOverlay(420)).toBe(false);
    expect(shouldUseDesktopMeasurementOverlay(560)).toBe(false);
    expect(shouldUseDesktopMeasurementOverlay(639)).toBe(false);
  });

  it("uses overlays only when the stage itself is wide enough", () => {
    expect(shouldUseDesktopMeasurementOverlay(640)).toBe(true);
    expect(shouldUseDesktopMeasurementOverlay(800)).toBe(true);
    expect(shouldUseDesktopMeasurementOverlay(1000)).toBe(true);
  });

  it("does not decide overlay mode solely from the legacy 700px viewport media query", () => {
    expect(DESKTOP_MEASUREMENT_OVERLAY_MQ).toBe("(min-width: 700px)");
    expect(overlaySrc).toContain("shouldUseDesktopMeasurementOverlay");
    expect(overlaySrc).toContain("ResizeObserver");
    expect(overlaySrc).toContain("DESKTOP_MEASUREMENT_OVERLAY_MIN_STAGE_PX");
    // Primary decision must use stage width, not matchMedia(DESKTOP_MEASUREMENT_OVERLAY_MQ).
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
    // Must not rely only on the old viewport max-width: 699.98px gate.
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

  it("Sleeveless + Drop Shoulder Edit and Custom Build fit share both measurement stylesheets", () => {
    for (const src of [sleevelessEditAstro, dropShoulderEditAstro, customBuildFitAstro]) {
      expect(src).toContain("sleeveless-express-measurements-confirm.css");
      expect(src).toContain("sleeveless-custom-build-measurements.css");
    }
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
      // Viewport 1000px must not be the primary two-column switch anymore.
      expect(src).not.toMatch(/@media \(min-width:\s*1000px\)\s*\{[\s\S]*\.sl-edit-workspace__layout/);
      expect(src).not.toMatch(/@media \(max-width:\s*999px\)\s*\{[\s\S]*\.sl-edit-workspace__measure-actions/);
    }
  });

  it("enlarged on-diagram chips apply only in desktop overlay mode", () => {
    for (const src of [sleevelessEditAstro, dropShoulderEditAstro]) {
      expect(src).toContain('data-measurement-overlay-mode="desktop"');
      expect(src).toContain(
        '.express-mbp-stage[data-measurement-overlay-mode="desktop"] .measurement-chip',
      );
    }
  });
});
