import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { estimateYarnWeightWithBuffer, YARN_REQUIREMENT_BUFFER } from "../tools/yarnRequirementDimensions";
import { buildTriangleScarfYarnDimensionsDetail } from "./triangleScarf/triangleScarfPatternView";
import videosPublic from "../../data/videos-public.json";
import type { PublicVideoRow } from "../lessonVideo";
import { sleevelessHelpVideoFromCatalog } from "./sleevelessCatalogHelpVideo";
import {
  TRIANGLE_SCARF_CONSTRUCTION_SUMMARY,
  TRIANGLE_SCARF_NEEDLE_ARRANGEMENT_GUIDANCE,
  TRIANGLE_SCARF_ICORD_VIDEO_CONTENT_ID,
  TRIANGLE_SCARF_SHAPING_VIDEO_CONTENT_ID,
  TRIANGLE_SCARF_THUMBNAIL_SRC,
  buildTriangleScarfPatternHtml,
  calculateTriangleScarf,
  parseTriangleScarfSearchParams,
  simulateTriangleScarf,
  stripLegacyTriangleScarfMethodParams,
  triangleScarfChecklist,
  triangleScarfShareParams,
  triangleScarfShapingIntervals,
  triangleScarfYarnAreaSquareInches,
  triangleScarfYarnHeading,
  type TriangleScarfInputs,
  type TriangleScarfOk,
} from "./triangleScarfMath";

const catalog = videosPublic as PublicVideoRow[];

function okResult(input: TriangleScarfInputs): TriangleScarfOk {
  const result = calculateTriangleScarf(input);
  expect(result.ok, result.ok ? "" : result.message).toBe(true);
  if (!result.ok) throw new Error(result.message);
  return result;
}

function expectReconciled(result: TriangleScarfOk): void {
  const simulated = simulateTriangleScarf(result);
  expect(result.construction).toBe("point-to-point");
  expect(result.startStitches).toBe(3);
  expect(result.endStitches).toBe(3);
  expect(simulated.startStitches).toBe(3);
  expect(simulated.stitchesAfterIncreases).toBe(result.maxStitches);
  expect(simulated.endStitches).toBe(3);
  expect(simulated.maxSeen).toBe(result.maxStitches);
  expect(simulated.rows).toBe(result.totalRows);
  expect(result.increaseRows + result.decreaseRows).toBe(result.totalRows);
  expect(Math.abs(result.increaseRows - result.decreaseRows)).toBeLessThanOrEqual(1);
  expect(result.shapingTimes).toBe(result.maxStitches - 3);

  const increases = result.phases.filter((phase) => phase.action === "increase");
  const decreases = result.phases.filter((phase) => phase.action === "decrease");
  expect(increases.reduce((sum, phase) => sum + phase.times, 0)).toBe(result.shapingTimes);
  expect(decreases.reduce((sum, phase) => sum + phase.times, 0)).toBe(result.shapingTimes);
  expect(increases.reduce((sum, phase) => sum + phase.rows * phase.times, 0)).toBe(result.increaseRows);
  expect(decreases.reduce((sum, phase) => sum + phase.rows * phase.times, 0)).toBe(result.decreaseRows);
  expect(result.phases.every((phase) => phase.side === "left edge" && phase.stitches === 1)).toBe(true);

  const firstDecrease = result.phases.findIndex((phase) => phase.action === "decrease");
  expect(result.phases.slice(0, firstDecrease).every((phase) => phase.action === "increase")).toBe(true);
  expect(result.phases.slice(firstDecrease).every((phase) => phase.action === "decrease")).toBe(true);
}

describe("point-to-point triangle scarf", () => {
  it("starts and ends at 3 stitches and reconciles both halves", () => {
    const result = okResult({
      depth: 10,
      length: 20,
      stitchGauge: 20,
      rowGauge: 28,
      needles: 200,
      unit: "in",
    });
    expect(result.maxStitches).toBe(50);
    expect(result.totalRows).toBe(140);
    expect(result.increaseRows).toBe(70);
    expect(result.decreaseRows).toBe(70);
    expectReconciled(result);

    const html = buildTriangleScarfPatternHtml(result);
    expect(html).toContain(TRIANGLE_SCARF_CONSTRUCTION_SUMMARY);
    expect(html).toContain("<strong>50</strong>");
    expect(html).toContain(TRIANGLE_SCARF_NEEDLE_ARRANGEMENT_GUIDANCE);
    expect(html).toContain('href="/help-hub/swatching-every-other-needle"');
    expect(html).toContain("Swatching on every other needle");
    expect(html).toContain('data-tip-id="triangle-scarf-wider-scarf"');
    expect(html).toContain('class="pattern-tip pattern-quick-tip"');
    expect(html).toContain("on the left edge");
    expect(html).toContain("Keep the right edge straight");
    expect(html).toContain('id="construction"');
    expect(html).toContain('id="increase"');
    expect(html).toContain('id="decrease"');
    expect(html).toContain('id="bind-off"');
    expect(html).toContain('id="optional-edge"');
    expect(html).toContain('class="pattern-section"');
    expect(html).toContain('class="pattern-tip"');
    expect(html).not.toContain(TRIANGLE_SCARF_THUMBNAIL_SRC);
    expect(html).not.toContain("shaping-instruction-block");
    const intervals = triangleScarfShapingIntervals(result.increaseRows, result.shapingTimes);
    expect(intervals.reduce((sum, interval) => sum + interval, 0)).toBe(result.increaseRows);
    expect(intervals.filter((interval) => interval === 2)).toHaveLength(23);
    expect(intervals.filter((interval) => interval === 1)).toHaveLength(24);
    expect(intervals.slice(0, 23).every((interval) => interval === 2)).toBe(false);
    const checklist = triangleScarfChecklist(result);
    const increaseChecklist = checklist.filter((entry) => entry.action === "increase");
    expect(increaseChecklist.map((entry) => entry.interval)).toEqual(intervals);
    expect(increaseChecklist[0]?.stitchesAfter).toBe(4);
    expect(increaseChecklist.at(-1)?.stitchesAfter).toBe(50);
    expect(increaseChecklist.at(-1)?.row).toBe(70);
    expect(html).toContain(`data-ts-shaping-row="${increaseChecklist[0]?.row}"`);
    expect(html).toContain(`data-ts-shaping-interval="${increaseChecklist[2]?.interval}"`);
    expect(html).not.toContain("each edge");
    expect(html).not.toContain("Wide");
    expect(html).not.toContain("data-content-id=\"2209\"");
  });

  it("puts an odd midpoint row in the decrease half only", () => {
    const result = okResult({
      depth: 10,
      length: 20.1,
      stitchGauge: 20,
      rowGauge: 28,
      needles: 200,
      unit: "in",
    });
    expect(result.totalRows).toBe(141);
    expect(result.increaseRows).toBe(70);
    expect(result.decreaseRows).toBe(71);
    expectReconciled(result);
    expect(buildTriangleScarfPatternHtml(result)).toContain("shaped once");
  });

  it("accepts a rounded maximum equal to the needle limit and rejects one stitch over", () => {
    const atLimit = okResult({
      depth: 40,
      length: 40,
      stitchGauge: 20,
      rowGauge: 40,
      needles: 200,
      unit: "in",
    });
    expect(atLimit.maxStitches).toBe(200);
    expectReconciled(atLimit);

    const over = calculateTriangleScarf({
      depth: 40.1,
      length: 40,
      stitchGauge: 20,
      rowGauge: 40,
      needles: 200,
      unit: "in",
    });
    expect(over.ok).toBe(false);
    if (over.ok) return;
    expect(over.message).toContain("Not enough needles to knit this size");
    expect(over.message).toContain("Required needles: 201");
    expect(over.message).toContain("Available needles: 200");
    expect(over.message).toContain("Reduce the scarf depth or use a machine with more available needles");
    expect(over.message).not.toMatch(/rows cannot hold/i);
  });

  it("rejects shaping that does not fit the rows without changing the requested size", () => {
    const result = calculateTriangleScarf({
      depth: 10,
      length: 10,
      stitchGauge: 20,
      rowGauge: 28,
      needles: 200,
      unit: "in",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toContain("47 increases");
    expect(result.message).toContain("were not changed");
    expect(result.message).not.toMatch(/Not enough needles/i);
  });

  it("maps Large 45 × 20 from length to rows and depth to stitches", () => {
    const large = okResult({
      depth: 20,
      length: 45,
      stitchGauge: 20,
      rowGauge: 28,
      needles: 200,
      unit: "in",
    });
    expect(large.maxStitches).toBe(100);
    expect(large.totalRows).toBe(315);
    expectReconciled(large);

    const depthTreatedAsLength = calculateTriangleScarf({
      depth: 45,
      length: 20,
      stitchGauge: 20,
      rowGauge: 28,
      needles: 200,
      unit: "in",
    });
    expect(depthTreatedAsLength.ok).toBe(false);
    if (depthTreatedAsLength.ok) return;
    expect(depthTreatedAsLength.message).toContain("Required needles: 225");
    expect(depthTreatedAsLength.message).toContain("Available needles: 200");
    expect(depthTreatedAsLength.message).not.toMatch(/rows cannot hold/i);
  });

  it("keeps yarn area at half the length-by-depth rectangle", () => {
    expect(triangleScarfYarnAreaSquareInches(36, 18, "in")).toBe(324);
    expect(triangleScarfYarnAreaSquareInches(24, 12, "in")).toBe(144);
    expect(triangleScarfYarnAreaSquareInches(45, 20, "in")).toBe(450);
    expect(triangleScarfYarnAreaSquareInches(36 * 2.54, 18 * 2.54, "cm")).toBeCloseTo(324, 5);
    expect(triangleScarfYarnHeading(36, 18, "in")).toBe(
      "How much yarn do I need for my 36″ × 18″ project?",
    );
    expect(triangleScarfYarnHeading(90, 40, "cm")).toBe(
      "How much yarn do I need for my 90 cm × 40 cm project?",
    );
  });

  it("feeds the finished pattern yarn drawer from the current length and depth", () => {
    const pattern = readFileSync(resolve("src/pages/patterns/triangle-scarf/pattern.astro"), "utf8");
    const builder = readFileSync(resolve("src/pages/patterns/triangle-scarf/builder.astro"), "utf8");
    const summary = readFileSync(resolve("src/pages/patterns/triangle-scarf/summary/index.astro"), "utf8");
    const script = readFileSync(resolve("src/scripts/triangle-scarf-pattern-page.ts"), "utf8");
    const yarnIdx = pattern.indexOf('data-testid="triangle-scarf-how-much-yarn"');
    const navIdx = pattern.indexOf("<SavedPatternStickyNav");
    expect(yarnIdx).toBeGreaterThan(-1);
    expect(navIdx).toBeGreaterThan(yarnIdx);
    expect(pattern).toContain("How Much Yarn?");
    expect(pattern).toContain("GarmentPatternYarnDrawer");
    expect(pattern).toContain("Includes a 10% buffer.");
    expect(pattern).not.toContain("add extra length to your sweater");
    expect(builder).not.toContain("express-yarn-drawer");
    expect(summary).not.toContain("express-yarn-drawer");
    expect(script).toContain("buildTriangleScarfYarnDimensionsDetail");
    expect(script).toContain("initGarmentPatternYarnDrawer");
    expect(script).toContain("kbm:yarnDimensions");

    const result = okResult({
      depth: 18,
      length: 36,
      stitchGauge: 20,
      rowGauge: 28,
      needles: 200,
      unit: "in",
    });
    const detail = buildTriangleScarfYarnDimensionsDetail(result);
    expect(detail.projectWidth).toBe(36);
    expect(detail.projectLength).toBe(18);
    expect(detail.projectAreaSquareInches).toBe(324);
    const swatch = { swatchWidthInches: 4, swatchLengthInches: 4, swatchWeight: 10 };
    const buffered = estimateYarnWeightWithBuffer({
      ...swatch,
      projectAreaSquareInches: detail.projectAreaSquareInches ?? 0,
    });
    const unbuffered = estimateYarnWeightWithBuffer({
      ...swatch,
      projectAreaSquareInches: detail.projectAreaSquareInches ?? 0,
      buffer: 1,
    });
    expect(buffered).toBeCloseTo(unbuffered * YARN_REQUIREMENT_BUFFER, 5);
    expect(buffered).toBeCloseTo(222.75, 5);
  });

  it("calculates centimeters with the same stitch and row rules", () => {
    const result = okResult({
      depth: 80,
      length: 160,
      stitchGauge: 25,
      rowGauge: 30,
      needles: 200,
      unit: "cm",
    });
    expect(result.maxStitches).toBe(200);
    expect(result.totalRows).toBe(480);
    expectReconciled(result);
    const html = buildTriangleScarfPatternHtml(result);
    expect(html).toContain("80 cm");
    expect(html).toContain("160 cm");

    const over = calculateTriangleScarf({
      depth: 80.4,
      length: 160,
      stitchGauge: 25,
      rowGauge: 30,
      needles: 200,
      unit: "cm",
    });
    expect(over.ok).toBe(false);
    if (over.ok) return;
    expect(over.message).toContain("Required needles: 201");
    expect(over.message).toContain("Available needles: 200");
  });

  it("ignores a saved wide-to-point method and does not put it back in the share URL", () => {
    const params = new URLSearchParams(
      "w=10&l=20&sg=20&rg=28&n=200&u=in&method=wide-to-point&construction=wide-to-point&na=eon",
    );
    const inputs = parseTriangleScarfSearchParams(params);
    expect(inputs).toEqual({
      depth: 10,
      length: 20,
      stitchGauge: 20,
      rowGauge: 28,
      needles: 200,
      unit: "in",
    });
    const result = okResult(inputs!);
    expect(result.construction).toBe("point-to-point");
    expect(result.maxStitches).toBe(50);
    const share = triangleScarfShareParams(inputs!);
    expect(share.get("method")).toBeNull();
    expect(share.get("construction")).toBeNull();
    expect(share.get("w")).toBe("10");
    expect(share.get("l")).toBe("20");
    expect(share.get("na")).toBeNull();
    expect(share.get("sg")).toBe("20");
    const stripped = stripLegacyTriangleScarfMethodParams(params);
    expect(stripped.get("method")).toBeNull();
    expect(stripped.get("construction")).toBeNull();
    expect(stripped.get("na")).toBeNull();
    expect(stripped.get("w")).toBe("10");
  });

  it("shows the requested videos from the catalog and keeps I-cord off the stitch count", () => {
    const shaping = catalog.find((row) => String(row.content_id) === "525");
    const icord = catalog.find((row) => String(row.content_id) === "679");
    expect(shaping?.title).toBe("Basic Increasing and Decreasing");
    expect(shaping?.vimeo_id).toBe(151858447);
    expect(icord?.title).toBe("Knit-in I-Cord");
    expect(icord?.vimeo_id).toBe(151859707);
    expect(sleevelessHelpVideoFromCatalog(TRIANGLE_SCARF_SHAPING_VIDEO_CONTENT_ID)?.id).toBe("151858447");
    expect(sleevelessHelpVideoFromCatalog(TRIANGLE_SCARF_ICORD_VIDEO_CONTENT_ID)?.id).toBe("151859707");

    const result = okResult({
      depth: 10,
      length: 20,
      stitchGauge: 20,
      rowGauge: 28,
      needles: 200,
      unit: "in",
    });
    const html = buildTriangleScarfPatternHtml(result);
    expect(html).toContain('data-content-id="525"');
    expect(html).toContain('data-vimeo-id="151858447"');
    expect(html).toContain('data-content-id="679"');
    expect(html).toContain('data-vimeo-id="151859707"');
    expect(html).toContain("data-vimeo-defer");
    expect(html).toContain('class="kbm-kin-catalog-video pattern-help-link__button"');
    expect(html).toContain("Watch: Basic Increasing and Decreasing");
    expect(html).toContain("Watch: Knit-in I-Cord");
    expect(html).toContain("included in the stitch count and in the maximum needle requirement");
    expect(html).toContain("a few stitches in from the left edge");
    expect(html).not.toMatch(/knit-in i-cord.{0,80}\d+ stitches in/i);
    const icordAt = html.indexOf("Optional edge: Knit-in I-cord");
    const videoAt = html.indexOf('data-triangle-scarf-video="i-cord"');
    expect(icordAt).toBeGreaterThan(-1);
    expect(videoAt).toBeGreaterThan(icordAt);
    expect(html).not.toMatch(/<iframe\b/i);
    expect(html.match(/Cast on <strong>3<\/strong>/g)).toHaveLength(1);
  });

  it("uses one instruction builder for the on-screen and printed pattern", () => {
    const entry = readFileSync(resolve("src/pages/patterns/triangle-scarf.astro"), "utf8");
    const builder = readFileSync(resolve("src/pages/patterns/triangle-scarf/builder.astro"), "utf8");
    const pattern = readFileSync(resolve("src/pages/patterns/triangle-scarf/pattern.astro"), "utf8");
    const fields = readFileSync(resolve("src/components/patterns/TriangleScarfSetupFields.astro"), "utf8");
    const math = readFileSync(resolve("src/lib/patterns/triangleScarfMath.ts"), "utf8");
    const script = readFileSync(resolve("src/scripts/triangle-scarf-pattern-page.ts"), "utf8");
    const presets = readFileSync(resolve("src/lib/patterns/triangleScarf/triangleScarfForm.ts"), "utf8");
    expect(entry).toContain("buildTriangleScarfLegacyEntryRedirect");
    expect(entry).not.toContain("PatternTabs");
    expect(builder).not.toContain("PatternTabs");
    expect(builder).not.toContain("Get Inspired");
    expect(builder).not.toContain("PinterestEmbed");
    expect(builder).not.toContain("Every other needle");
    expect(pattern).not.toContain("PatternTabs");
    expect(pattern).toContain("pattern-workspace-new-pattern-trigger");
    expect(fields).toContain("Point-to-point length");
    expect(fields).toContain("Scarf depth");
    expect(presets).toContain("Small 24 × 12");
    expect(presets).toContain("Large 45 × 20");
    expect(fields).not.toContain("data-triangle-scarf-needle");
    expect(fields).not.toContain("Every other needle");
    expect(math).toContain(TRIANGLE_SCARF_NEEDLE_ARRANGEMENT_GUIDANCE);
    expect(math).toContain("TRIANGLE_SCARF_EVERY_OTHER_NEEDLE_HELP_HREF");
    expect(math).not.toContain("workingNeedleCapacity");
    expect(math).not.toContain('sp.set("na"');
    expect(builder).toContain("TRIANGLE_SCARF_THUMBNAIL_SRC");
    expect(pattern).toContain("TRIANGLE_SCARF_THUMBNAIL_SRC");
    expect(pattern).toContain("buildTriangleScarfPatternHtml");
    expect(script).toContain("buildTriangleScarfPatternHtml");
    expect(script).toContain("triggerPatternPrint");
    expect(builder).not.toContain("wide-to-point");
    expect(pattern).not.toContain("2209");
    expect(fields).not.toContain("Finished width");
  });
});
