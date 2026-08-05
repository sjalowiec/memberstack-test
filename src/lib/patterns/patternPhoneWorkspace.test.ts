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
const phoneWorkspaceCss = readFileSync(
  resolve("src/styles/patterns/pattern-phone-workspace.css"),
  "utf8",
);
const phoneNoticeAstro = readFileSync(
  resolve("src/components/patterns/PatternPhoneWorkspaceNotice.astro"),
  "utf8",
);
const layoutAstro = readFileSync(resolve("src/layouts/Layout.astro"), "utf8");
const headerAstro = readFileSync(resolve("src/components/Header.astro"), "utf8");
const sleevelessBuilder = readFileSync(
  resolve("src/pages/patterns/sleeveless/builder.astro"),
  "utf8",
);
const dropShoulderBuilder = readFileSync(
  resolve("src/pages/patterns/drop-shoulder/builder.astro"),
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
const customBuildFit = readFileSync(
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

  it("clears absolute left/top/transform for the mobile Measurements panel", () => {
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
  });

  it("clears overlay coords below 700px instead of side-column positioning", () => {
    expect(overlaySrc).toMatch(/if\s*\(\s*!desktop\s*\)\s*\{[\s\S]*clearMeasurementBoxPosition/);
    expect(overlaySrc).not.toContain("positionMeasurementBoxesMobile");
    expect(overlaySrc).not.toContain("computeMobileChipPlacement");
  });
});

describe("shared mobile Measurements panel CSS contract", () => {
  it("confirm CSS stacks overlay chips under the diagram below 700px", () => {
    expect(confirmCss).toMatch(
      /@media \(max-width:\s*699\.98px\)[\s\S]*\.express-mbp-overlay\s*\{[\s\S]*position:\s*static/,
    );
    expect(confirmCss).toContain('content: "Measurements"');
    expect(confirmCss).toContain("grid-template-columns: 1fr 1fr");
    expect(confirmCss).not.toContain("--mbp-mobile-control-col");
  });

  it("custom-build CSS must not re-force absolute overlay chips on mobile", () => {
    expect(customBuildCss).not.toMatch(
      /@media \(max-width:\s*699\.98px\)[\s\S]*\.express-mbp-overlay\s*\{[\s\S]*position:\s*absolute/,
    );
    expect(customBuildCss).not.toMatch(
      /@media \(max-width:\s*699\.98px\)[\s\S]*\.express-mbp-box\s*\{[\s\S]*position:\s*absolute/,
    );
  });
});

describe("pattern phone workspace — notice + compact header", () => {
  it("shows the shared phone notice copy only below tablet width", () => {
    expect(phoneNoticeAstro).toContain(
      "Pattern building works best on a computer or tablet. Saved patterns are phone-friendly, so you",
    );
    expect(phoneNoticeAstro).toContain("can easily follow them while you knit.");
    expect(phoneWorkspaceCss).toContain("max-width: 767.98px");
    expect(phoneWorkspaceCss).toMatch(
      /\.pattern-phone-workspace-notice\s*\{[\s\S]*display:\s*none/,
    );
    // Compact advisory tip (not a large alert): smaller type + tight padding.
    expect(phoneWorkspaceCss).toMatch(
      /\.pattern-phone-workspace-notice__text\s*\{[\s\S]*font-size:\s*0\.78rem[\s\S]*font-weight:\s*400/,
    );
    expect(phoneWorkspaceCss).toMatch(
      /\.pattern-phone-workspace-notice\s*\{[\s\S]*padding:\s*0\.4rem 0\.55rem/,
    );
  });

  it("hides the tall search strip on pattern workspace phones and keeps a search icon", () => {
    expect(phoneWorkspaceCss).toContain("body.page--pattern-workspace .kbm-search-strip");
    expect(phoneWorkspaceCss).toContain("display: none !important");
    expect(headerAstro).toContain("kbm-pattern-workspace-search");
    expect(headerAstro).toContain("patternWorkspace");
    expect(layoutAstro).toContain("page--pattern-workspace");
    expect(layoutAstro).toContain("isPatternWorkspacePhone");
    expect(layoutAstro).toContain("isPatternWorkspaceDesktop");
  });

  it("opts Builder, Edit, and Custom Build into the shared pattern workspace phone mode", () => {
    for (const src of [
      sleevelessBuilder,
      dropShoulderBuilder,
      sleevelessPattern,
      dropShoulderPattern,
      customBuildFit,
    ]) {
      expect(src).toContain("patternWorkspace={true}");
      expect(src).toContain("PatternPhoneWorkspaceNotice");
    }
  });

  it("shares Edit gauge fields with title + unit hint markup", () => {
    expect(sleevelessPattern).toContain("EditWorkspaceGaugeFields");
    expect(dropShoulderPattern).toContain("EditWorkspaceGaugeFields");
    expect(phoneWorkspaceCss).toContain("pattern-workspace-field-hint");
    expect(phoneWorkspaceCss).toContain("pattern-workspace-gauge-grid");
    // Phone gauge stays single-column (no 400px two-column switch).
    expect(phoneWorkspaceCss).not.toMatch(
      /pattern-workspace-gauge-grid[\s\S]{0,80}@media \(min-width:\s*400px\)/,
    );
  });

  it("uses GaugeInput formFields mode on pattern builders (no long floating labels)", () => {
    expect(sleevelessBuilder).toContain("formFields={true}");
    expect(dropShoulderBuilder).toContain("formFields={true}");
    expect(sleevelessBuilder).not.toContain("Stitch gauge — stitches over");
    expect(dropShoulderBuilder).not.toContain("Stitch gauge — stitches over");
  });

  it("places the phone notice in Edit workspaces but not in the finished-pattern action bar", () => {
    expect(sleevelessPattern).toMatch(
      /sl-edit-drawer__panel[\s\S]*PatternPhoneWorkspaceNotice[\s\S]*sl-edit-workspace__layout/,
    );
    const actionBarChunk = sleevelessPattern.slice(
      sleevelessPattern.indexOf("pattern-action-bar"),
      sleevelessPattern.indexOf("sl-edit-drawer"),
    );
    expect(actionBarChunk).not.toContain("PatternPhoneWorkspaceNotice");
  });
});
