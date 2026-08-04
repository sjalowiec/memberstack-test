import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  DESKTOP_MEASUREMENT_OVERLAY_MQ,
  applyMeasurementTargetToBox,
  clearMeasurementBoxPosition,
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

describe("patternSummaryMeasurementOverlay — mobile panel contract", () => {
  it("uses 700px as the desktop overlay breakpoint", () => {
    expect(DESKTOP_MEASUREMENT_OVERLAY_MQ).toBe("(min-width: 700px)");
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

  it("clears coords below 700px for the under-diagram Measurements panel", () => {
    expect(overlaySrc).toMatch(/if\s*\(\s*!desktop\s*\)\s*\{[\s\S]*clearMeasurementBoxPosition/);
    expect(overlaySrc).not.toContain("positionMeasurementBoxesMobile");
  });
});

describe("shared mobile measurement panel CSS contract", () => {
  it("confirm CSS stacks overlay chips under the diagram below 700px", () => {
    expect(confirmCss).toMatch(
      /@media \(max-width:\s*699\.98px\)[\s\S]*\.express-mbp-overlay\s*\{[\s\S]*position:\s*static/,
    );
    expect(confirmCss).toContain('content: "Measurements"');
    expect(confirmCss).toMatch(
      /@media \(max-width:\s*699\.98px\)[\s\S]*\.express-mbp-box\s*\{[\s\S]*position:\s*static/,
    );
    expect(confirmCss).toMatch(
      /@media \(max-width:\s*699\.98px\)[\s\S]*\.measure-icon\s*\{[\s\S]*display:\s*none/,
    );
    expect(confirmCss).toMatch(
      /\.express-mbp-overlay\s*\{[\s\S]*grid-template-columns:\s*1fr;/,
    );
  });

  it("custom-build CSS must not re-force absolute overlay chips on mobile", () => {
    expect(customBuildCss).not.toMatch(
      /@media \(max-width:\s*699\.98px\)[\s\S]*\.express-mbp-overlay\s*\{[\s\S]*position:\s*absolute/,
    );
    expect(customBuildCss).not.toMatch(
      /@media \(max-width:\s*699\.98px\)[\s\S]*\.express-mbp-box\s*\{[\s\S]*position:\s*absolute/,
    );
  });

  it("Sleeveless + Drop Shoulder Edit and Custom Build fit share both measurement stylesheets", () => {
    for (const src of [sleevelessEditAstro, dropShoulderEditAstro, customBuildFitAstro]) {
      expect(src).toContain("sleeveless-express-measurements-confirm.css");
      expect(src).toContain("sleeveless-custom-build-measurements.css");
    }
  });
});
