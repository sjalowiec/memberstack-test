import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  CUP_DART_BY_SIZE,
  computeDartShaping,
} from "./dartFormulaMath";
import {
  BUST_DART_HELP_VIDEO_CONTENT_ID,
  DART_FORMULA_HELP_BUTTON_LABEL,
  DART_FORMULA_HELP_DESCRIPTION,
  DART_FORMULA_HELP_HEADING,
  DART_FORMULA_HELP_VIDEO_CONTENT_ID,
  renderDartFormulaHelpSectionHtml,
  resolveDartFormulaHelpVideo,
} from "./dartFormulaHelpVideo";

const pageDir = dirname(fileURLToPath(import.meta.url));
const pageSource = readFileSync(join(pageDir, "../../pages/tools/dart-formula.astro"), "utf8");
const modalSource = readFileSync(
  join(pageDir, "../../components/common/KinCatalogVideoModal.astro"),
  "utf8",
);

describe("dartFormulaHelpVideo", () => {
  it("uses Learning Library content_id 643", () => {
    expect(DART_FORMULA_HELP_VIDEO_CONTENT_ID).toBe(643);
    expect(BUST_DART_HELP_VIDEO_CONTENT_ID).toBe(DART_FORMULA_HELP_VIDEO_CONTENT_ID);
    const video = resolveDartFormulaHelpVideo();
    expect(video).not.toBeNull();
    expect(video?.title).toMatch(/bust dart/i);
    expect(video?.id).toMatch(/^\d+$/);
    expect(video?.id).not.toBe("643");
  });

  it("renders help heading, description, and Watch button that opens KinCatalogVideoModal", () => {
    const video = resolveDartFormulaHelpVideo();
    expect(video).not.toBeNull();
    const html = renderDartFormulaHelpSectionHtml(video);
    expect(html).toContain(DART_FORMULA_HELP_HEADING);
    expect(html).toContain(DART_FORMULA_HELP_DESCRIPTION);
    expect(html).toContain(DART_FORMULA_HELP_BUTTON_LABEL);
    expect(html).toContain(`data-content-id="${DART_FORMULA_HELP_VIDEO_CONTENT_ID}"`);
    expect(html).toContain(`data-dart-formula-help-content-id="${DART_FORMULA_HELP_VIDEO_CONTENT_ID}"`);
    expect(html).toContain("kbm-kin-catalog-video");
    expect(html).toContain(`data-vimeo-id="${video!.id}"`);
    expect(html).toContain('data-testid="button-dart-formula-help-video"');
  });

  it("does not hardcode a Vimeo URL; catalog supplies the player id", () => {
    const html = renderDartFormulaHelpSectionHtml();
    expect(html).not.toMatch(/player\.vimeo\.com/i);
    expect(html).not.toMatch(/https?:\/\/vimeo\.com/i);
    expect(pageSource).not.toMatch(/player\.vimeo\.com/i);
    expect(pageSource).not.toMatch(/151859486/);
    expect(pageSource).toContain("resolveDartFormulaHelpVideo");
    expect(pageSource).toContain("renderDartFormulaHelpSectionHtml");
    expect(pageSource).toContain("dartFormulaHelpVideo");
  });

  it("omits the Watch button when the catalog row cannot be resolved", () => {
    const html = renderDartFormulaHelpSectionHtml(null);
    expect(html).toContain(DART_FORMULA_HELP_HEADING);
    expect(html).toContain(DART_FORMULA_HELP_DESCRIPTION);
    expect(html).not.toContain("kbm-kin-catalog-video");
    expect(html).not.toContain("data-vimeo-id");
  });

  it("leaves Dart Formula cup presets and shaping math unchanged", () => {
    expect(CUP_DART_BY_SIZE.C).toEqual({ dartWidth: 3.25, dartDepth: 1 });
    const r = computeDartShaping({
      cupKey: "C",
      stitchGauge: 20,
      rowGauge: 28,
      unit: "in",
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.totalHeldStitches).toBe(16);
    expect(r.totalDepthRows).toBe(7);
  });

  it("wires the help section on the Dart Formula Tool page before the calculator", () => {
    expect(pageSource).toContain("dartHelpSectionHtml");
    expect(pageSource).toContain('class="dart-formula-help-mount"');
    const helpIdx = pageSource.indexOf("dart-formula-help-mount");
    const formIdx = pageSource.indexOf('id="wizard-form"');
    expect(helpIdx).toBeGreaterThan(-1);
    expect(formIdx).toBeGreaterThan(helpIdx);
    expect(pageSource).toContain("ToolGate");
  });

  it("reuses the site-wide KinCatalogVideoModal trigger contract", () => {
    expect(modalSource).toContain('class="kbm-kin-catalog-video"');
    expect(modalSource).toContain("data-vimeo-id");
    expect(modalSource).toContain("lastFocus.focus");
    expect(modalSource).toContain("kbmKinCatalogVideoModal");
  });
});
