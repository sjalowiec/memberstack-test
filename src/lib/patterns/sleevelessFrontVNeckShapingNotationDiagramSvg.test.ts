import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  displayRcFromGarmentRc,
  pulloverArmholeEvents,
} from "./frontArmholeNecklineComposition";
import { collectInnerNeckDecreasePointsFromTimeline } from "./notationOverlaySvg";
import {
  armholeBindOffDecreaseFromEachSide,
  formatRcNotation,
} from "./sleevelessBackJapaneseNotation";
import {
  buildFrontJapaneseNotationReplacements,
  resolveFrontVNeckNotationRcModel,
  resolveSleevelessFrontDiagramSrc,
} from "./sleevelessFrontJapaneseNotation";
import { resolveSleevelessBackDiagramSrc } from "./sleevelessBackDiagramSrc";
import {
  buildSleevelessFrontVNeckShapingNotationDiagramSvg,
  pulloverVNeckFrontShoulderNotationLines,
  pulloverVNeckFrontShoulderPoints,
  shouldUseGeneratedSleevelessFrontVNeckNotation,
  SLEEVELESS_FRONT_VNECK_ARMHOLE_LABEL_SAFE_MAX_X,
  SLEEVELESS_FRONT_VNECK_ARMHOLE_LABEL_START_X,
  SLEEVELESS_FRONT_VNECK_ARMHOLE_NOTATION_GAP,
  SLEEVELESS_FRONT_VNECK_BODY_LABEL_OUTLINE_CLEARANCE,
  SLEEVELESS_FRONT_VNECK_NOTATION_FS_NOTATION,
  SLEEVELESS_FRONT_VNECK_NOTATION_FS_RC,
  SLEEVELESS_FRONT_VNECK_NOTATION_VIEWBOX,
  SLEEVELESS_FRONT_VNECK_RC_RESET_GAP,
  tryBuildLiveSleevelessFrontVNeckNotationSvg,
} from "./sleevelessFrontVNeckShapingNotationDiagramSvg";
import { generateSleevelessBackPattern } from "./sleevelessPatternOutput";

const srcRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");

function amandaVNeckPattern(): Record<string, unknown> {
  return {
    fit: {
      sizingChart: "misses",
      selectedMeasurements: {
        finished_bust_chest: 39,
        back_neck_to_hem: 18,
        armhole_depth: 8,
        neck_opening: 6,
        shoulder_width: 12,
        front_neck_depth: 6.86,
        back_neck_depth: 1,
      },
    },
    style: { recipientCategory: "misses", neckline: "v-neck" },
    yarnGaugeMachine: {
      gaugeStitchesPerInch: 4,
      gaugeRowsPerInch: 7,
      availableNeedles: 200,
    },
  };
}

function shallowVNeckPattern(): Record<string, unknown> {
  return {
    fit: {
      sizingChart: "misses",
      selectedMeasurements: {
        finished_bust_chest: 39,
        back_neck_to_hem: 18,
        armhole_depth: 8,
        neck_opening: 6,
        shoulder_width: 12,
        front_neck_depth: 3,
        back_neck_depth: 1,
      },
    },
    style: { recipientCategory: "misses", neckline: "v-neck" },
    yarnGaugeMachine: {
      gaugeStitchesPerInch: 4,
      gaugeRowsPerInch: 7,
      availableNeedles: 200,
    },
  };
}

function equalDepthVNeckPattern(): Record<string, unknown> {
  return {
    fit: {
      sizingChart: "mens",
      selectedMeasurements: {
        finished_bust_chest: 51,
        back_neck_to_hem: 28,
        armhole_depth: 10,
        neck_opening: 6,
        shoulder_width: 22,
        front_neck_depth: 10,
        back_neck_depth: 1,
      },
    },
    style: { recipientCategory: "mens", neckline: "v-neck" },
    yarnGaugeMachine: {
      gaugeStitchesPerInch: 4,
      gaugeRowsPerInch: 7,
      availableNeedles: 200,
    },
  };
}

function vNeckBeforeArmholePattern(): Record<string, unknown> {
  return {
    fit: {
      sizingChart: "mens",
      selectedMeasurements: {
        finished_bust_chest: 51,
        back_neck_to_hem: 28,
        armhole_depth: 9,
        neck_opening: 6,
        shoulder_width: 22,
        front_neck_depth: 11,
        back_neck_depth: 1,
      },
    },
    style: { recipientCategory: "mens", neckline: "v-neck" },
    yarnGaugeMachine: {
      gaugeStitchesPerInch: 4,
      gaugeRowsPerInch: 7,
      availableNeedles: 200,
    },
  };
}

function roundPulloverPattern(): Record<string, unknown> {
  return {
    fit: {
      sizingChart: "misses",
      selectedMeasurements: {
        finished_bust_chest: 40,
        back_neck_to_hem: 22,
        armhole_depth: 8,
        neck_opening: 6,
        shoulder_width: 12,
        front_neck_depth: 3,
        back_neck_depth: 1,
      },
    },
    style: { garmentStyle: "pullover", neckline: "round", frontStyle: "closed", recipientCategory: "misses" },
    yarnGaugeMachine: { gaugeStitchesPerInch: 5, gaugeRowsPerInch: 7, availableNeedles: 200 },
  };
}

function cardiganPattern(neckline: string): Record<string, unknown> {
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
      },
    },
    style: { garmentStyle: "cardigan", neckline, frontStyle: "open", recipientCategory: "misses" },
    yarnGaugeMachine: { gaugeStitchesPerInch: 5, gaugeRowsPerInch: 7, availableNeedles: 200 },
  };
}

function inwardBodyVNeckPattern(): Record<string, unknown> {
  const pattern = shallowVNeckPattern();
  const fit = pattern.fit as { selectedMeasurements: Record<string, number> };
  fit.selectedMeasurements.finished_hip = 46;
  return pattern;
}

function outwardBodyVNeckPattern(): Record<string, unknown> {
  const pattern = shallowVNeckPattern();
  const fit = pattern.fit as { selectedMeasurements: Record<string, number> };
  fit.selectedMeasurements.finished_hip = 32;
  return pattern;
}

function straightBodyVNeckPattern(): Record<string, unknown> {
  return shallowVNeckPattern();
}

function alineOutwardExplicitVNeckPattern(): Record<string, unknown> {
  const pattern = shallowVNeckPattern();
  (pattern.style as { bodyShape?: string }).bodyShape = "aline";
  const fit = pattern.fit as { selectedMeasurements: Record<string, number> };
  fit.selectedMeasurements.finished_hip = 32;
  return pattern;
}

function shapedVNeckPattern(): Record<string, unknown> {
  const pattern = shallowVNeckPattern();
  (pattern.style as { bodyShape?: string }).bodyShape = "shaped";
  const fit = pattern.fit as { selectedMeasurements: Record<string, number> };
  fit.selectedMeasurements.finished_hip = 32;
  return pattern;
}

function waistVNeckPattern(): Record<string, unknown> {
  const pattern = shallowVNeckPattern();
  (pattern.style as { bodyShape?: string }).bodyShape = "waist";
  const fit = pattern.fit as { selectedMeasurements: Record<string, number> };
  fit.selectedMeasurements.finished_hip = 32;
  return pattern;
}

function wideInwardBodyVNeckPattern(): Record<string, unknown> {
  const pattern = equalDepthVNeckPattern();
  const fit = pattern.fit as { selectedMeasurements: Record<string, number> };
  fit.selectedMeasurements.finished_hip = 60;
  return pattern;
}

function fineGaugeWidePattern(): Record<string, unknown> {
  return {
    fit: {
      sizingChart: "mens",
      selectedMeasurements: {
        finished_bust_chest: 48,
        back_neck_to_hem: 24,
        armhole_depth: 9,
        neck_opening: 7,
        shoulder_width: 18,
        front_neck_depth: 5,
        back_neck_depth: 1,
      },
    },
    style: { recipientCategory: "mens", neckline: "v-neck" },
    yarnGaugeMachine: {
      gaugeStitchesPerInch: 7,
      gaugeRowsPerInch: 10,
      availableNeedles: 200,
    },
  };
}

function svgAttr(svg: string, name: string): string {
  const re = new RegExp(`${name}="([^"]*)"`);
  return re.exec(svg)?.[1] ?? "";
}

function svgNum(svg: string, name: string): number {
  return Number(svgAttr(svg, name));
}

function roles(svg: string, role: string): string[] {
  const re = new RegExp(`data-role="${role}"[^>]*>`, "g");
  return svg.match(re) ?? [];
}

function roleRcs(svg: string, role: string): string[] {
  return roles(svg, role)
    .map((tag) => /data-rc="([^"]*)"/.exec(tag)?.[1] ?? "")
    .filter(Boolean);
}

function expectValidSvg(svg: string): void {
  expect(svg).toContain(`viewBox="0 0 ${SLEEVELESS_FRONT_VNECK_NOTATION_VIEWBOX.width} ${SLEEVELESS_FRONT_VNECK_NOTATION_VIEWBOX.height}"`);
  expect(svg).toContain('width="100%"');
  expect(svg).toContain('height="auto"');
  expect(svg).toContain('preserveAspectRatio="xMidYMid meet"');
  expect(svg).toContain('data-sleeveless-vneck-generated-notation="true"');
  expect(svg).not.toMatch(/\bNaN\b/);
  expect(svg).not.toMatch(/\bInfinity\b/);
  expect(svg).not.toMatch(/\bundefined\b/);
}

function expectParity(
  svg: string,
  result: ReturnType<typeof generateSleevelessBackPattern>,
  pattern: Record<string, unknown>,
): void {
  const repl = buildFrontJapaneseNotationReplacements(result, pattern);
  expect(svgAttr(svg, "data-cast-on")).toBe(repl["jp-caston"]);
  expect(svgAttr(svg, "data-armhole-bo")).toBe(repl["jp-armhole-bo"]);
  expect(svgAttr(svg, "data-armhole-shaping")).toBe(repl["jp-armhole-shaping"]);
  expect(svgAttr(svg, "data-neck-shaping")).toBe(repl["jp-neckline-shaping"]);
  expect(svgAttr(svg, "data-shoulder-shaping")).toBe(
    pulloverVNeckFrontShoulderNotationLines(result).join("\n"),
  );
  expect(svgAttr(svg, "data-rc-reset")).toBe(repl.rc_reset);
  expect(svgAttr(svg, "data-rc-neck-start")).toBe(repl["rc-neckline-start"]);
  expect(svgAttr(svg, "data-rc-armhole-bo")).toBe(repl["rc-armhole-bo"]);
  expect(svgAttr(svg, "data-rc-shoulder-start")).toBe(repl["rc-shoulder-start"]);
  expect(svgAttr(svg, "data-body-shaping")).toBe(repl["jp-body-shaping"]);
  expect(svg).toContain(repl["jp-caston"]);
  if (repl["jp-armhole-shaping"]) expect(svg).toContain(repl["jp-armhole-shaping"].split("\n")[0]!);
  if (repl["jp-neckline-shaping"]) expect(svg).toContain(repl["jp-neckline-shaping"].split("\n")[0]!);
}

function expectYsInViewBox(svg: string): void {
  const vbH = SLEEVELESS_FRONT_VNECK_NOTATION_VIEWBOX.height;
  for (const name of ["data-neck-start-y", "data-armhole-start-y", "data-last-armhole-y", "data-shoulder-y"]) {
    const y = svgNum(svg, name);
    expect(Number.isFinite(y)).toBe(true);
    expect(y).toBeGreaterThanOrEqual(0);
    expect(y).toBeLessThanOrEqual(vbH);
  }
}

describe("buildSleevelessFrontVNeckShapingNotationDiagramSvg", () => {
  it("is deterministic for the same fixture", () => {
    const pattern = amandaVNeckPattern();
    const result = generateSleevelessBackPattern(pattern);
    const a = buildSleevelessFrontVNeckShapingNotationDiagramSvg(result, pattern);
    const b = buildSleevelessFrontVNeckShapingNotationDiagramSvg(result, pattern);
    expect(a).toBe(b);
    expectValidSvg(a);
  });

  it("Case 1 shallow V: reset, later local neck start, canonical armhole RCs", () => {
    const pattern = shallowVNeckPattern();
    const result = generateSleevelessBackPattern(pattern);
    const model = resolveFrontVNeckNotationRcModel(result);
    const repl = buildFrontJapaneseNotationReplacements(result, pattern);
    const svg = buildSleevelessFrontVNeckShapingNotationDiagramSvg(result, pattern);

    expectValidSvg(svg);
    expect(svgAttr(svg, "data-rc-policy")).toBe("armhole-reset-first");
    expect(svgAttr(svg, "data-reset")).toBe("true");
    expect(svg).toContain("↺ rc000");
    expect(roles(svg, "rc-reset")).toHaveLength(1);
    expect(svgAttr(svg, "data-rc-neck-start")).toBe(repl["rc-neckline-start"]);
    expect(repl["rc-neckline-start"]).not.toBe("rc000");
    expect(svgNum(svg, "data-neck-start-y")).toBeLessThan(svgNum(svg, "data-armhole-start-y"));
    expect(svgNum(svg, "data-neck-start-garment-rc")).toBeGreaterThan(
      svgNum(svg, "data-armhole-start-garment-rc"),
    );

    const expectedDecs = model.armholeDecreasePoints.map((p) => formatRcNotation(p.row));
    const drawn = roleRcs(svg, "armhole-event");
    for (const rc of expectedDecs) {
      expect(drawn).toContain(rc);
    }
    expect(svg).not.toContain("1s-2r-0x");
    expectParity(svg, result, pattern);
    expectYsInViewBox(svg);
  });

  it("Case 2 Amanda: reset, V at rc007, remaining armhole 008/010/012/014", () => {
    const pattern = amandaVNeckPattern();
    const result = generateSleevelessBackPattern(pattern);
    const model = resolveFrontVNeckNotationRcModel(result);
    const svg = buildSleevelessFrontVNeckShapingNotationDiagramSvg(result, pattern);

    expectValidSvg(svg);
    expect(svgAttr(svg, "data-reset")).toBe("true");
    expect(svg).toContain("↺ rc000");
    expect(svgAttr(svg, "data-rc-neck-start")).toBe("rc007");
    expect(svgNum(svg, "data-neck-start-display-rc")).toBe(7);

    const remaining = [8, 10, 12, 14].map((n) => formatRcNotation(n));
    const drawn = roleRcs(svg, "armhole-event");
    for (const rc of remaining) {
      expect(drawn).toContain(rc);
    }
    expect(model.armholeDecreasePoints.map((p) => p.row)).toEqual(
      expect.arrayContaining([8, 10, 12, 14]),
    );
    expect(model.armholeDecreasePoints.map((p) => p.row)).not.toEqual(
      model.armholeDecreasePoints.map((_, i) => i * 2),
    );

    const neckY = svgNum(svg, "data-neck-start-y");
    const armY = svgNum(svg, "data-armhole-start-y");
    const lastY = svgNum(svg, "data-last-armhole-y");
    expect(neckY).toBeLessThan(armY);
    expect(neckY).toBeGreaterThanOrEqual(Math.min(lastY, svgNum(svg, "data-shoulder-y")));
    expectParity(svg, result, pattern);
    expectYsInViewBox(svg);
  });

  it("Case 3 equal-depth: shared reset, V start rc000, shared start Y", () => {
    const pattern = equalDepthVNeckPattern();
    const result = generateSleevelessBackPattern(pattern);
    const model = resolveFrontVNeckNotationRcModel(result);
    const svg = buildSleevelessFrontVNeckShapingNotationDiagramSvg(result, pattern);

    expectValidSvg(svg);
    expect(svgAttr(svg, "data-rc-policy")).toBe("shared-reset");
    expect(svgAttr(svg, "data-reset")).toBe("true");
    expect(svg).toContain("↺ rc000");
    expect(svgAttr(svg, "data-rc-neck-start")).toBe("rc000");
    expect(svgNum(svg, "data-neck-start-display-rc")).toBe(0);
    expect(svgNum(svg, "data-neck-start-garment-rc")).toBe(
      svgNum(svg, "data-armhole-start-garment-rc"),
    );
    expect(Math.abs(svgNum(svg, "data-neck-start-y") - svgNum(svg, "data-armhole-start-y"))).toBeLessThan(
      0.6,
    );
    expect(roles(svg, "first-neck-decrease").length).toBeGreaterThan(0);
    const firstNeck = roleRcs(svg, "first-neck-decrease")[0];
    expect(firstNeck).not.toBe("rc000");
    expect(model.armholeDecreasePoints[0]?.row).toBe(2);
    expectParity(svg, result, pattern);
    expectYsInViewBox(svg);
  });

  it("Case 4 deep V: no reset, garment RC start, composed armhole rows", () => {
    const pattern = vNeckBeforeArmholePattern();
    const result = generateSleevelessBackPattern(pattern);
    const model = resolveFrontVNeckNotationRcModel(result);
    const overlap = result.debug.frontArmholeNecklineOverlap!;
    const svg = buildSleevelessFrontVNeckShapingNotationDiagramSvg(result, pattern);

    expectValidSvg(svg);
    expect(svgAttr(svg, "data-rc-policy")).toBe("continuous-garment-rc");
    expect(svgAttr(svg, "data-reset")).toBe("false");
    expect(svg).not.toContain("↺");
    expect(roles(svg, "rc-reset")).toHaveLength(0);
    expect(svgAttr(svg, "data-rc-neck-start")).not.toBe("rc000");
    expect(svgNum(svg, "data-neck-start-display-rc")).toBe(overlap.divideGarmentRc);
    expect(svgNum(svg, "data-neck-start-garment-rc")).toBe(overlap.divideGarmentRc);
    expect(svgNum(svg, "data-armhole-start-garment-rc")).toBeGreaterThan(overlap.divideGarmentRc);
    expect(svgNum(svg, "data-neck-start-y")).toBeGreaterThan(svgNum(svg, "data-armhole-start-y"));

    const expectedDecs = overlap.remainingDecreaseLocalRcs.map(
      (local) => result.debug.armholeStartRow! + local,
    );
    expect(model.armholeDecreasePoints.map((p) => p.row)).toEqual(expectedDecs);
    const drawn = roleRcs(svg, "armhole-event");
    for (const rc of expectedDecs.map((n) => formatRcNotation(n))) {
      expect(drawn).toContain(rc);
    }
    expect(model.armholeDecreasePoints.map((p) => p.row)).not.toEqual(
      expectedDecs.map((_, i) => i * 2),
    );
    expect(svgAttr(svg, "data-rc-shoulder-start")).toBe(
      formatRcNotation(model.shoulderStartDisplayRc ?? -1),
    );
    expectParity(svg, result, pattern);
    expectYsInViewBox(svg);
  });

  it("same-row Neck + Armhole share one RC node", () => {
    const pattern = vNeckBeforeArmholePattern();
    const result = generateSleevelessBackPattern(pattern);
    const model = resolveFrontVNeckNotationRcModel(result);
    const armholeStart = result.debug.armholeStartRow!;
    const eachSide = result.debug.armholeStitchesEachSide!;
    const { bindOffSts, decreaseSts } = armholeBindOffDecreaseFromEachSide(eachSide);
    const armholeRcs = new Set(
      pulloverArmholeEvents({
        firstArmholeGarmentRc: armholeStart,
        bindOffSts,
        decreaseSts,
      })
        .filter((ev) => ev.side === "right")
        .map((ev) => ev.garmentRc),
    );
    const neckRcs = collectInnerNeckDecreasePointsFromTimeline(
      result.frontNeckShoulderTimeline ?? [],
      "right",
    ).map((p) => p.row);
    const shared = neckRcs.filter((rc) => armholeRcs.has(rc));
    expect(shared.length).toBeGreaterThan(0);

    const svg = buildSleevelessFrontVNeckShapingNotationDiagramSvg(result, pattern);
    for (const garmentRc of shared) {
      const display = formatRcNotation(
        displayRcFromGarmentRc(garmentRc, armholeStart, model.policy),
      );
      const rcNodes = roles(svg, "rc").filter((tag) => tag.includes(`data-rc="${display}"`));
      expect(rcNodes).toHaveLength(1);
      expect(rcNodes[0]).toContain('data-shared-rc="true"');
      const neckHooks = roles(svg, "neck-event").filter((tag) => tag.includes(`data-rc="${display}"`));
      const ahHooks = roles(svg, "armhole-event").filter((tag) =>
        tag.includes(`data-rc="${display}"`),
      );
      expect(neckHooks.length).toBeGreaterThan(0);
      expect(ahHooks.length).toBeGreaterThan(0);
      expect(neckHooks[0]).toContain('data-shared-rc="true"');
      expect(ahHooks[0]).toContain('data-shared-rc="true"');
    }
  });

  it("keeps event Ys in viewBox and geometry changes with a different gauge", () => {
    const amanda = amandaVNeckPattern();
    const fine = fineGaugeWidePattern();
    const amandaResult = generateSleevelessBackPattern(amanda);
    const fineResult = generateSleevelessBackPattern(fine);
    const amandaSvg = buildSleevelessFrontVNeckShapingNotationDiagramSvg(amandaResult, amanda);
    const fineSvg = buildSleevelessFrontVNeckShapingNotationDiagramSvg(fineResult, fine);

    expectValidSvg(fineSvg);
    expectYsInViewBox(fineSvg);
    expectParity(fineSvg, fineResult, fine);

    const amandaCastOn = svgAttr(amandaSvg, "data-cast-on");
    const fineCastOn = svgAttr(fineSvg, "data-cast-on");
    expect(fineCastOn).not.toBe(amandaCastOn);
    expect(fineCastOn).toBe(
      buildFrontJapaneseNotationReplacements(fineResult, fine)["jp-caston"],
    );
    expect(svgNum(fineSvg, "data-body-width")).not.toBe(svgNum(amandaSvg, "data-body-width"));
    expect(
      svgNum(fineSvg, "data-neck-start-y") - svgNum(fineSvg, "data-armhole-start-y"),
    ).not.toBe(
      svgNum(amandaSvg, "data-neck-start-y") - svgNum(amandaSvg, "data-armhole-start-y"),
    );
  });

  it("does not emit invalid numeric tokens", () => {
    for (const pattern of [
      shallowVNeckPattern(),
      amandaVNeckPattern(),
      equalDepthVNeckPattern(),
      vNeckBeforeArmholePattern(),
      fineGaugeWidePattern(),
      inwardBodyVNeckPattern(),
      outwardBodyVNeckPattern(),
    ]) {
      const result = generateSleevelessBackPattern(pattern);
      const svg = buildSleevelessFrontVNeckShapingNotationDiagramSvg(result, pattern);
      expect(svg).not.toMatch(/\bNaN\b/);
      expect(svg).not.toMatch(/\bInfinity\b/);
      expect(svg).not.toMatch(/\bundefined\b/);
    }
  });

  it("Case 4 deep V: shoulder notation excludes the leaked armhole bind-off", () => {
    const pattern = vNeckBeforeArmholePattern();
    const result = generateSleevelessBackPattern(pattern);
    const svg = buildSleevelessFrontVNeckShapingNotationDiagramSvg(result, pattern);
    const shoulder = svgAttr(svg, "data-shoulder-shaping");

    expect(svgAttr(svg, "data-armhole-bo")).toBe("bo4");
    expect(svgAttr(svg, "data-armhole-shaping")).toBe("1s-2r-3x");
    expect(shoulder).toBe("8s-2r-4x");
    expect(shoulder).not.toContain("4s-57r-1x");
    expect(shoulder).not.toContain("4s-55r-1x");
    expect(svg).toContain("bo4");
    expect(svg).toContain("1s-2r-3x");
    expect(svg).toContain("8s-2r-4x");
    expect(svg).not.toContain("4s-57r-1x");
  });

  it("Case 1 shallow V: keeps the real shoulder run", () => {
    const pattern = shallowVNeckPattern();
    const result = generateSleevelessBackPattern(pattern);
    const svg = buildSleevelessFrontVNeckShapingNotationDiagramSvg(result, pattern);
    expect(svgAttr(svg, "data-shoulder-shaping")).toBe("3s-2r-4x");
    expect(svg).toContain("3s-2r-4x");
    expect(svgAttr(svg, "data-armhole-bo")).toBe("bo8");
    expect(svgAttr(svg, "data-armhole-shaping")).toBe("1s-2r-7x");
    expect(svgAttr(svg, "data-neck-shaping")).toBe("1s-2r-12x");
  });

  it("keeps semantic event hooks without customer-facing dots", () => {
    const pattern = vNeckBeforeArmholePattern();
    const result = generateSleevelessBackPattern(pattern);
    const svg = buildSleevelessFrontVNeckShapingNotationDiagramSvg(result, pattern);

    expect(roles(svg, "armhole-event").length).toBeGreaterThan(0);
    expect(roles(svg, "neck-event").length).toBeGreaterThan(0);
    expect(roleRcs(svg, "armhole-event").length).toBeGreaterThan(0);
    expect(roleRcs(svg, "neck-event").length).toBeGreaterThan(0);
    expect(svg).not.toMatch(/<circle\b/);
    expect(svg).toMatch(/<g data-role="armhole-event"/);
    expect(svg).toMatch(/<g data-role="neck-event"/);
  });

  it("places shaping labels in reserved zones away from the garment lines", () => {
    const pattern = vNeckBeforeArmholePattern();
    const result = generateSleevelessBackPattern(pattern);
    const svg = buildSleevelessFrontVNeckShapingNotationDiagramSvg(result, pattern);
    const vbW = SLEEVELESS_FRONT_VNECK_NOTATION_VIEWBOX.width;
    const neck = firstTextPos(svg, "neck-shaping");
    const shoulder = firstTextPos(svg, "shoulder-shaping");
    const armholeBo = firstTextPos(svg, "armhole-bo");

    expect(neck.x).toBeLessThan(vbW / 2);
    expect(neck.x).toBeLessThan(Number(svgAttr(svg, "data-neck-label-x")) + 0.01);
    const previousShoulderBaseline = svgNum(svg, "data-shoulder-top-y") - 26;
    const rightShoulder = pathPoints(svg, "right-shoulder-path");
    expect(shoulder.y).toBeGreaterThan(previousShoulderBaseline);
    expect(shoulder.y).toBeLessThan(svgNum(svg, "data-shoulder-y"));
    if (rightShoulder.length >= 2) {
      expect(shoulder.x).toBeGreaterThan(rightShoulder[1]!.x);
    }
    expect(armholeBo.x).toBeLessThanOrEqual(SLEEVELESS_FRONT_VNECK_ARMHOLE_LABEL_SAFE_MAX_X);
    expect(armholeBo.y).toBeLessThan(svgNum(svg, "data-armhole-start-y"));
  });

  it("draws a single sloped shoulder on each side from filtered shoulder events", () => {
    for (const pattern of [
      shallowVNeckPattern(),
      amandaVNeckPattern(),
      equalDepthVNeckPattern(),
      vNeckBeforeArmholePattern(),
      fineGaugeWidePattern(),
    ]) {
      const result = generateSleevelessBackPattern(pattern);
      const svg = buildSleevelessFrontVNeckShapingNotationDiagramSvg(result, pattern);
      const passes = pulloverVNeckFrontShoulderPoints(result);
      expect(svgAttr(svg, "data-shoulder-contour")).toBe("slope");
      expect(svgNum(svg, "data-shoulder-pass-count")).toBe(passes.length);
      expect(svgNum(svg, "data-shoulder-shaping-stitches")).toBe(
        passes.reduce((sum, p) => sum + p.amount, 0),
      );
      expect(roles(svg, "left-shoulder-path")).toHaveLength(1);
      expect(roles(svg, "right-shoulder-path")).toHaveLength(1);
      const left = pathPoints(svg, "left-shoulder-path");
      const right = pathPoints(svg, "right-shoulder-path");
      expect(left).toHaveLength(2);
      expect(right).toHaveLength(2);
      if (passes.length > 0) {
        expect(left[1]!.y).toBeLessThan(left[0]!.y);
        expect(right[1]!.y).toBeLessThan(right[0]!.y);
        expect(left[0]!.x).toBeLessThan(left[1]!.x);
        expect(right[0]!.x).toBeGreaterThan(right[1]!.x);
      }
      expect(left[0]!.x).toBeLessThan(right[0]!.x);
      expect(svg).not.toMatch(/<circle\b/);
    }
  });

  it("keeps Armhole labels inside the right safe gutter", () => {
    for (const pattern of [
      shallowVNeckPattern(),
      amandaVNeckPattern(),
      equalDepthVNeckPattern(),
      vNeckBeforeArmholePattern(),
      fineGaugeWidePattern(),
    ]) {
      const result = generateSleevelessBackPattern(pattern);
      const svg = buildSleevelessFrontVNeckShapingNotationDiagramSvg(result, pattern);
      const cap = svgNum(svg, "data-right-label-safe-max-x");
      expect(cap).toBe(SLEEVELESS_FRONT_VNECK_ARMHOLE_LABEL_SAFE_MAX_X);
      for (const role of ["armhole-bo", "armhole-shaping"]) {
        for (const pos of allTextPos(svg, role)) {
          expect(pos.x).toBeLessThanOrEqual(cap);
          expect(pos.x).toBeGreaterThan(svgNum(svg, "data-body-width"));
        }
      }
    }
  });

  it("left-aligns Armhole notation from one shared start X inside the viewBox", () => {
    const vbW = SLEEVELESS_FRONT_VNECK_NOTATION_VIEWBOX.width;
    for (const pattern of [
      shallowVNeckPattern(),
      amandaVNeckPattern(),
      equalDepthVNeckPattern(),
      vNeckBeforeArmholePattern(),
      fineGaugeWidePattern(),
    ]) {
      const result = generateSleevelessBackPattern(pattern);
      const svg = buildSleevelessFrontVNeckShapingNotationDiagramSvg(result, pattern);
      const bo = allTextMeta(svg, "armhole-bo");
      const shaping = allTextMeta(svg, "armhole-shaping");
      expect(bo.length).toBeGreaterThan(0);
      expect(shaping.length).toBeGreaterThan(0);
      const xs = [...bo, ...shaping].map((t) => t.x);
      expect(new Set(xs).size).toBe(1);
      expect(xs[0]).toBe(SLEEVELESS_FRONT_VNECK_ARMHOLE_LABEL_START_X);
      for (const t of [...bo, ...shaping]) {
        expect(t.anchor).toBe("start");
        expect(t.x).toBeGreaterThan(svgNum(svg, "data-body-width"));
        expect(t.x).toBeLessThan(vbW);
      }
      const longest = Math.max(
        (svgAttr(svg, "data-armhole-bo") ?? "").length,
        ...(svgAttr(svg, "data-armhole-shaping") ?? "")
          .split("\n")
          .map((line) => line.length),
      );
      expect(xs[0]! + longest * 8).toBeLessThanOrEqual(vbW);
    }
  });

  it("separates Armhole BO and decrease lines by one notation line height", () => {
    const vbW = SLEEVELESS_FRONT_VNECK_NOTATION_VIEWBOX.width;
    expect(SLEEVELESS_FRONT_VNECK_ARMHOLE_NOTATION_GAP).toBe(18);
    expect(SLEEVELESS_FRONT_VNECK_ARMHOLE_LABEL_START_X).toBe(320);
    for (const pattern of [
      shallowVNeckPattern(),
      amandaVNeckPattern(),
      equalDepthVNeckPattern(),
      vNeckBeforeArmholePattern(),
      fineGaugeWidePattern(),
    ]) {
      const result = generateSleevelessBackPattern(pattern);
      const svg = buildSleevelessFrontVNeckShapingNotationDiagramSvg(result, pattern);
      const bo = allTextMeta(svg, "armhole-bo");
      const shaping = allTextMeta(svg, "armhole-shaping");
      expect(bo.length).toBeGreaterThan(0);
      expect(shaping.length).toBeGreaterThan(0);
      const xs = [...bo, ...shaping].map((t) => t.x);
      expect(new Set(xs).size).toBe(1);
      expect(xs[0]).toBe(SLEEVELESS_FRONT_VNECK_ARMHOLE_LABEL_START_X);
      for (const t of [...bo, ...shaping]) {
        expect(t.anchor).toBe("start");
        expect(t.x).toBeGreaterThanOrEqual(0);
        expect(t.x).toBeLessThan(vbW);
      }
      const boY = bo[0]!.y;
      const shapingYs = shaping.map((t) => t.y).sort((a, b) => a - b);
      expect(boY).toBeLessThan(shapingYs[0]!);
      expect(shapingYs[0]! - boY).toBe(SLEEVELESS_FRONT_VNECK_ARMHOLE_NOTATION_GAP);
      for (let i = 1; i < shapingYs.length; i++) {
        expect(shapingYs[i]! - shapingYs[i - 1]!).toBe(
          SLEEVELESS_FRONT_VNECK_ARMHOLE_NOTATION_GAP,
        );
      }
    }
  });

  it("draws armhole bind-off above decrease notation in knitting order", () => {
    for (const pattern of [
      shallowVNeckPattern(),
      amandaVNeckPattern(),
      equalDepthVNeckPattern(),
      vNeckBeforeArmholePattern(),
      fineGaugeWidePattern(),
    ]) {
      const result = generateSleevelessBackPattern(pattern);
      const repl = buildFrontJapaneseNotationReplacements(result, pattern);
      const svg = buildSleevelessFrontVNeckShapingNotationDiagramSvg(result, pattern);
      const bo = allTextMeta(svg, "armhole-bo");
      const shaping = allTextMeta(svg, "armhole-shaping");
      expect(svgAttr(svg, "data-armhole-bo")).toBe(repl["jp-armhole-bo"]);
      expect(svgAttr(svg, "data-armhole-shaping")).toBe(repl["jp-armhole-shaping"]);
      expect(bo[0]!.text).toBe(repl["jp-armhole-bo"]);
      expect(shaping.map((t) => t.text).join("\n")).toBe(repl["jp-armhole-shaping"]);
      expect(bo[0]!.anchor).toBe("start");
      expect(shaping[0]!.anchor).toBe("start");
      expect(bo[0]!.x).toBe(SLEEVELESS_FRONT_VNECK_ARMHOLE_LABEL_START_X);
      expect(shaping[0]!.x).toBe(SLEEVELESS_FRONT_VNECK_ARMHOLE_LABEL_START_X);
      expect(bo[0]!.y).toBeLessThan(shaping[0]!.y);
      expect(shaping[0]!.y - bo[0]!.y).toBe(SLEEVELESS_FRONT_VNECK_ARMHOLE_NOTATION_GAP);
      expect(bo[0]!.stackOrder).toBe(0);
      expect(shaping[0]!.stackOrder).toBe(1);
    }
  });

  it("keeps Neck labels left of center and RC labels in the left gutter", () => {
    const svg = buildSleevelessFrontVNeckShapingNotationDiagramSvg(
      generateSleevelessBackPattern(vNeckBeforeArmholePattern()),
      vNeckBeforeArmholePattern(),
    );
    const vbW = SLEEVELESS_FRONT_VNECK_NOTATION_VIEWBOX.width;
    expect(roles(svg, "neck-label-zone")).toHaveLength(1);
    const neckYs = allTextPos(svg, "neck-shaping").map((p) => p.y).sort((a, b) => a - b);
    for (const pos of allTextPos(svg, "neck-shaping")) {
      expect(pos.x).toBeLessThan(vbW / 2);
    }
    expect(firstTextPos(svg, "neck-shaping").y).toBeGreaterThan(
      firstTextPos(svg, "shoulder-start-rc").y + 12,
    );
    if (neckYs.length > 1) {
      expect(neckYs[1]! - neckYs[0]!).toBeGreaterThanOrEqual(18);
    }
    for (const role of ["rc-caston", "rc-hem", "armhole-start-rc", "neck-start-rc", "shoulder-start-rc"]) {
      const pos = firstTextPos(svg, role);
      expect(pos.x).toBeLessThan(100);
    }
  });

  it("slopes the body inward when cast-on is wider than bust", () => {
    const pattern = inwardBodyVNeckPattern();
    const result = generateSleevelessBackPattern(pattern);
    const svg = buildSleevelessFrontVNeckShapingNotationDiagramSvg(result, pattern);
    const repl = buildFrontJapaneseNotationReplacements(result, pattern);
    const hemSts = result.debug.hemCastOnStitches ?? 0;
    const bustSts = result.debug.bustBodyStitches ?? 0;
    const rows = result.debug.alineBodyShapingRowNumbers ?? [];
    expect(hemSts).toBeGreaterThan(bustSts);
    expect(rows.length).toBeGreaterThan(0);
    expect(svgAttr(svg, "data-body-shaping-direction")).toBe("inward");
    expect(svgNum(svg, "data-body-start-stitches")).toBe(hemSts);
    expect(svgNum(svg, "data-body-end-stitches")).toBe(bustSts);
    expect(svgNum(svg, "data-body-shaping-start-rc")).toBe(rows[0]!);
    expect(svgNum(svg, "data-body-shaping-end-rc")).toBe(rows[rows.length - 1]!);
    expect(svgAttr(svg, "data-body-shaping")).toBe(repl["jp-body-shaping"]);
    expect(svgAttr(svg, "data-body-shaping").length).toBeGreaterThan(0);
    expect(roles(svg, "body-shaping").length).toBeGreaterThan(0);
    expect(roles(svg, "body-event")).toHaveLength(rows.length);
    const left = pathPoints(svg, "left-body-path");
    const right = pathPoints(svg, "right-body-path");
    expect(left[0]!.x).toBeLessThan(left[left.length - 1]!.x);
    expect(right[0]!.x).toBeGreaterThan(right[right.length - 1]!.x);
    expect(svgNum(svg, "data-hem-left")).toBeLessThan(svgNum(svg, "data-bust-left"));
    expect(svgNum(svg, "data-hem-right")).toBeGreaterThan(svgNum(svg, "data-bust-right"));
    expect(svgNum(svg, "data-body-shaping-start-y")).toBeGreaterThan(
      svgNum(svg, "data-body-shaping-end-y"),
    );
    expect(svg).not.toMatch(/\bNaN\b/);
    expect(svg).not.toMatch(/\bInfinity\b/);
    expect(svg).not.toMatch(/\bundefined\b/);
    expectValidSvg(svg);
    expectYsInViewBox(svg);
    expectParity(svg, result, pattern);
  });

  it("slopes the body outward when cast-on is narrower than bust", () => {
    const pattern = outwardBodyVNeckPattern();
    const result = generateSleevelessBackPattern(pattern);
    const svg = buildSleevelessFrontVNeckShapingNotationDiagramSvg(result, pattern);
    const repl = buildFrontJapaneseNotationReplacements(result, pattern);
    const hemSts = result.debug.hemCastOnStitches ?? 0;
    const bustSts = result.debug.bustBodyStitches ?? 0;
    const rows = result.debug.alineBodyShapingRowNumbers ?? [];
    expect(hemSts).toBeLessThan(bustSts);
    expect(rows.length).toBeGreaterThan(0);
    expect(svgAttr(svg, "data-body-shaping-direction")).toBe("outward");
    expect(svgNum(svg, "data-body-start-stitches")).toBe(hemSts);
    expect(svgNum(svg, "data-body-end-stitches")).toBe(bustSts);
    expect(svgNum(svg, "data-body-shaping-start-rc")).toBe(rows[0]!);
    expect(svgNum(svg, "data-body-shaping-end-rc")).toBe(rows[rows.length - 1]!);
    expect(svgAttr(svg, "data-body-shaping")).toBe(repl["jp-body-shaping"]);
    expect(svgAttr(svg, "data-body-shaping")).toMatch(/^\+/);
    expect(roles(svg, "body-shaping").length).toBeGreaterThan(0);
    const left = pathPoints(svg, "left-body-path");
    const right = pathPoints(svg, "right-body-path");
    expect(left[0]!.x).toBeGreaterThan(left[left.length - 1]!.x);
    expect(right[0]!.x).toBeLessThan(right[right.length - 1]!.x);
    expect(svgNum(svg, "data-hem-left")).toBeGreaterThan(svgNum(svg, "data-bust-left"));
    expect(svgNum(svg, "data-hem-right")).toBeLessThan(svgNum(svg, "data-bust-right"));
    expect(svg).not.toMatch(/\bNaN\b/);
    expectValidSvg(svg);
    expectParity(svg, result, pattern);
  });

  it("keeps straight body sides and omits body-shaping notation when widths match", () => {
    const pattern = straightBodyVNeckPattern();
    const result = generateSleevelessBackPattern(pattern);
    const svg = buildSleevelessFrontVNeckShapingNotationDiagramSvg(result, pattern);
    const hemSts = result.debug.hemCastOnStitches ?? result.debug.backStitches ?? 0;
    const bustSts = result.debug.bustBodyStitches ?? hemSts;
    expect(hemSts).toBe(bustSts);
    expect(svgAttr(svg, "data-body-shaping-direction")).toBe("straight");
    expect(svgNum(svg, "data-body-start-stitches")).toBe(hemSts);
    expect(svgNum(svg, "data-body-end-stitches")).toBe(bustSts);
    expect(svgAttr(svg, "data-body-shaping")).toBe("");
    expect(roles(svg, "body-shaping")).toHaveLength(0);
    expect(roles(svg, "body-event")).toHaveLength(0);
    const left = pathPoints(svg, "left-body-path");
    const right = pathPoints(svg, "right-body-path");
    expect(left).toHaveLength(2);
    expect(right).toHaveLength(2);
    expect(left[0]!.x).toBe(left[1]!.x);
    expect(right[0]!.x).toBe(right[1]!.x);
    expect(svgNum(svg, "data-hem-left")).toBe(svgNum(svg, "data-bust-left"));
    expect(svgNum(svg, "data-hem-right")).toBe(svgNum(svg, "data-bust-right"));
    expectValidSvg(svg);
    expectParity(svg, result, pattern);
  });

  it("keeps existing V-neck fixtures on a straight body", () => {
    for (const pattern of [
      shallowVNeckPattern(),
      amandaVNeckPattern(),
      equalDepthVNeckPattern(),
      vNeckBeforeArmholePattern(),
    ]) {
      const result = generateSleevelessBackPattern(pattern);
      const svg = buildSleevelessFrontVNeckShapingNotationDiagramSvg(result, pattern);
      expect(svgAttr(svg, "data-body-shaping-direction")).toBe("straight");
      expect(roles(svg, "body-shaping")).toHaveLength(0);
    }
  });

  it("places body-shaping notation inside the garment with outline clearance", () => {
    for (const pattern of [inwardBodyVNeckPattern(), outwardBodyVNeckPattern(), wideInwardBodyVNeckPattern()]) {
      const result = generateSleevelessBackPattern(pattern);
      const svg = buildSleevelessFrontVNeckShapingNotationDiagramSvg(result, pattern);
      const labels = allTextMeta(svg, "body-shaping");
      expect(labels.length).toBeGreaterThan(0);
      const labelX = svgNum(svg, "data-body-label-x");
      const outlineX = svgNum(svg, "data-body-outline-x-at-label");
      const clearance = svgNum(svg, "data-body-label-clearance");
      expect(clearance).toBe(SLEEVELESS_FRONT_VNECK_BODY_LABEL_OUTLINE_CLEARANCE);
      expect(roles(svg, "body-shaping-label-zone")).toHaveLength(1);
      expect(labelX).toBeGreaterThan(svgNum(svg, "data-bust-left"));
      expect(labelX).toBeGreaterThan(SLEEVELESS_FRONT_VNECK_NOTATION_VIEWBOX.width / 2);
      expect(outlineX).toBeGreaterThan(labelX);
      expect(outlineX - labelX).toBeGreaterThanOrEqual(clearance);
      expect(labelX).not.toBe(SLEEVELESS_FRONT_VNECK_ARMHOLE_LABEL_START_X);
      const xs = labels.map((t) => t.x);
      expect(new Set(xs).size).toBe(1);
      expect(xs[0]).toBe(labelX);
      for (const t of labels) {
        expect(t.anchor).toBe("end");
        expect(t.x).toBeLessThan(outlineX);
      }
      const ys = labels.map((t) => t.y).sort((a, b) => a - b);
      if (ys.length > 1) {
        for (let i = 1; i < ys.length; i++) {
          expect(ys[i]! - ys[i - 1]!).toBe(Math.round(13 * 1.6));
        }
      }
      expect(svgAttr(svg, "data-body-shaping")).toBe(
        buildFrontJapaneseNotationReplacements(result, pattern)["jp-body-shaping"],
      );
    }
  });

  it("does not lock the body-shaping label to one X across different garment widths", () => {
    const narrow = buildSleevelessFrontVNeckShapingNotationDiagramSvg(
      generateSleevelessBackPattern(inwardBodyVNeckPattern()),
      inwardBodyVNeckPattern(),
    );
    const wide = buildSleevelessFrontVNeckShapingNotationDiagramSvg(
      generateSleevelessBackPattern(wideInwardBodyVNeckPattern()),
      wideInwardBodyVNeckPattern(),
    );
    expect(svgAttr(narrow, "data-body-shaping-direction")).toBe("inward");
    expect(svgAttr(wide, "data-body-shaping-direction")).toBe("inward");
    expect(svgNum(narrow, "data-body-width")).not.toBe(svgNum(wide, "data-body-width"));
    expect(svgNum(narrow, "data-body-label-x")).not.toBe(svgNum(wide, "data-body-label-x"));
    expect(svgNum(narrow, "data-body-outline-x-at-label")).not.toBe(
      svgNum(wide, "data-body-outline-x-at-label"),
    );
  });

  it("separates armhole-start RC and reset in the left gutter", () => {
    for (const pattern of [shallowVNeckPattern(), amandaVNeckPattern(), equalDepthVNeckPattern()]) {
      const svg = buildSleevelessFrontVNeckShapingNotationDiagramSvg(
        generateSleevelessBackPattern(pattern),
        pattern,
      );
      expect(svg).toContain("↺ rc000");
      const armRc = firstTextPos(svg, "armhole-start-rc");
      const reset = firstTextPos(svg, "rc-reset");
      expect(Number.isFinite(armRc.y)).toBe(true);
      expect(Number.isFinite(reset.y)).toBe(true);
      expect(Math.abs(armRc.y - reset.y)).toBeGreaterThanOrEqual(
        SLEEVELESS_FRONT_VNECK_RC_RESET_GAP,
      );
      expect(armRc.x).toBeLessThan(svgNum(svg, "data-hem-left"));
      expect(armRc.x).toBeLessThan(svgNum(svg, "data-bust-left"));
      expect(reset.x).toBe(armRc.x);
    }
  });

  it("does not introduce reset notation on deep V continuous garment RC", () => {
    const pattern = vNeckBeforeArmholePattern();
    const svg = buildSleevelessFrontVNeckShapingNotationDiagramSvg(
      generateSleevelessBackPattern(pattern),
      pattern,
    );
    expect(svgAttr(svg, "data-rc-policy")).toBe("continuous-garment-rc");
    expect(svgAttr(svg, "data-reset")).toBe("false");
    expect(svg).not.toContain("↺");
    expect(roles(svg, "rc-reset")).toHaveLength(0);
  });

  it("places shoulder notation next to the right shoulder slope", () => {
    const pattern = shallowVNeckPattern();
    const result = generateSleevelessBackPattern(pattern);
    const svg = buildSleevelessFrontVNeckShapingNotationDiagramSvg(result, pattern);
    const shoulder = allTextPos(svg, "shoulder-shaping");
    expect(shoulder.length).toBeGreaterThan(0);
    const slope = pathPoints(svg, "right-shoulder-path");
    expect(slope).toHaveLength(2);
    const previousLastBaseline = svgNum(svg, "data-shoulder-top-y") - 26;
    const lowest = Math.max(...shoulder.map((p) => p.y));
    const neckRight = slope[1]!.x;
    const afterRight = slope[0]!.x;
    for (const pos of shoulder) {
      expect(pos.x).toBeGreaterThan(neckRight);
      expect(pos.x).toBeLessThan(afterRight + 12);
      expect(pos.y).toBeLessThan(svgNum(svg, "data-shoulder-y"));
    }
    expect(lowest).toBeGreaterThan(previousLastBaseline);
    expect(lowest).toBeGreaterThan(svgNum(svg, "data-neck-corner-y") - 24);
  });

  it("uses the Stitches & Rows / Round notation type scale", () => {
    const pattern = shallowVNeckPattern();
    const result = generateSleevelessBackPattern(pattern);
    const svg = buildSleevelessFrontVNeckShapingNotationDiagramSvg(result, pattern);
    expect(SLEEVELESS_FRONT_VNECK_NOTATION_FS_NOTATION).toBe(17);
    expect(SLEEVELESS_FRONT_VNECK_NOTATION_FS_RC).toBe(14);
    expect(SLEEVELESS_FRONT_VNECK_ARMHOLE_NOTATION_GAP).toBe(18);
    for (const role of [
      "neck-shaping",
      "armhole-bo",
      "armhole-shaping",
      "shoulder-shaping",
      "cast-on",
    ]) {
      const tag = new RegExp(`<text(?=[^>]*data-role="${role}")[^>]*>`).exec(svg)?.[0] ?? "";
      expect(tag).toContain('font-size="17"');
    }
    for (const role of ["rc-caston", "armhole-start-rc", "neck-start-rc", "shoulder-start-rc"]) {
      const tag = new RegExp(`<text(?=[^>]*data-role="${role}")[^>]*>`).exec(svg)?.[0] ?? "";
      expect(tag).toContain('font-size="14"');
    }
    expect(svg).not.toContain('font-size="13"');
    expect(svg).not.toContain('font-size="12"');
  });

  it("keeps V and armhole notation strings and garment geometry unchanged", () => {
    const pattern = shallowVNeckPattern();
    const result = generateSleevelessBackPattern(pattern);
    const svg = buildSleevelessFrontVNeckShapingNotationDiagramSvg(result, pattern);
    const repl = buildFrontJapaneseNotationReplacements(result, pattern);
    expect(svgAttr(svg, "data-neck-shaping")).toBe(repl["jp-neckline-shaping"]);
    expect(svgAttr(svg, "data-armhole-bo")).toBe(repl["jp-armhole-bo"]);
    expect(svgAttr(svg, "data-armhole-shaping")).toBe(repl["jp-armhole-shaping"]);
    expect(svgAttr(svg, "data-shoulder-shaping")).toBe(
      pulloverVNeckFrontShoulderNotationLines(result).join("\n"),
    );
    expect(svgAttr(svg, "data-shoulder-contour")).toBe("slope");
    expect(svgNum(svg, "data-body-width")).toBeGreaterThan(0);
    expect(svgNum(svg, "data-shoulder-y")).toBeGreaterThan(svgNum(svg, "data-shoulder-top-y"));
    expect(svgNum(svg, "data-neck-start-y")).toBeGreaterThan(svgNum(svg, "data-neck-corner-y"));
    expect(roles(svg, "right-shoulder-path")).toHaveLength(1);
  });

  it("keeps Round Front notation source and shared 17 / 14 type", () => {
    const roundSource = readFileSync(
      join(srcRoot, "lib/patterns/sleevelessFrontRoundShapingNotationDiagramSvg.ts"),
      "utf8",
    );
    const backSource = readFileSync(
      join(srcRoot, "lib/patterns/sleevelessBackShapingNotationDiagramSvg.ts"),
      "utf8",
    );
    expect(roundSource).toContain("const FS_NOTATION = 17;");
    expect(roundSource).toContain("const FS_RC = 14;");
    expect(backSource).toContain("const FS_RC = 14;");
    expect(backSource).toContain("const FS_NOTATION = 17;");
  });
});

function firstTextPos(svg: string, role: string): { x: number; y: number } {
  return allTextPos(svg, role)[0] ?? { x: NaN, y: NaN };
}

function allTextPos(svg: string, role: string): { x: number; y: number }[] {
  return allTextMeta(svg, role).map(({ x, y }) => ({ x, y }));
}

function allTextMeta(
  svg: string,
  role: string,
): { x: number; y: number; anchor: string; text: string; stackOrder: number }[] {
  const re = new RegExp(`<text[^>]*data-role="${role}"[^>]*>([^<]*)`, "g");
  return [...svg.matchAll(re)].map((m) => {
    const tag = m[0];
    return {
      x: Number(/[\s]x="([^"]+)"/.exec(tag)?.[1] ?? NaN),
      y: Number(/[\s]y="([^"]+)"/.exec(tag)?.[1] ?? NaN),
      anchor: /text-anchor="([^"]+)"/.exec(tag)?.[1] ?? "",
      text: m[1] ?? "",
      stackOrder: Number(/data-stack-order="([^"]+)"/.exec(tag)?.[1] ?? NaN),
    };
  });
}

function pathPoints(svg: string, role: string): { x: number; y: number }[] {
  const d = new RegExp(`data-role="${role}"[^>]*\\sd="([^"]+)"`).exec(svg)?.[1] ?? "";
  const nums = [...d.matchAll(/(-?\d+(?:\.\d+)?)/g)].map((m) => Number(m[1]));
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i + 1 < nums.length; i += 2) {
    pts.push({ x: nums[i]!, y: nums[i + 1]! });
  }
  return pts;
}

describe("live Pullover V-neck Front notation cutover", () => {
  it("uses the generated renderer for pullover V-neck Front only", () => {
    const cases = [
      amandaVNeckPattern(),
      shallowVNeckPattern(),
      equalDepthVNeckPattern(),
      vNeckBeforeArmholePattern(),
    ];
    for (const pulloverV of cases) {
      const pulloverVResult = generateSleevelessBackPattern(pulloverV);
      const live = tryBuildLiveSleevelessFrontVNeckNotationSvg(pulloverVResult, pulloverV);

      expect(shouldUseGeneratedSleevelessFrontVNeckNotation(pulloverVResult, pulloverV)).toBe(true);
      expect(live).toBeTruthy();
      expect(live).toContain('data-sleeveless-vneck-generated-notation="true"');
      expect(live).toContain('data-supported="true"');
      expect(live).toBe(
        buildSleevelessFrontVNeckShapingNotationDiagramSvg(pulloverVResult, pulloverV),
      );
      expect(resolveSleevelessFrontDiagramSrc("sts-rows", pulloverV)).not.toContain(
        "diagram-jp-front",
      );
    }
  });

  it("falls back to the old template path for round Front, cardigan, and does not claim Back", () => {
    const round = roundPulloverPattern();
    const roundResult = generateSleevelessBackPattern(round);
    expect(shouldUseGeneratedSleevelessFrontVNeckNotation(roundResult, round)).toBe(false);
    expect(tryBuildLiveSleevelessFrontVNeckNotationSvg(roundResult, round)).toBeNull();
    expect(resolveSleevelessFrontDiagramSrc("shaping-notation", round)).toContain(
      "diagram-jp-front-round",
    );

    const scoop = { ...round, style: { ...round.style as object, neckline: "scoop" } };
    const scoopResult = generateSleevelessBackPattern(scoop);
    expect(shouldUseGeneratedSleevelessFrontVNeckNotation(scoopResult, scoop)).toBe(false);
    expect(tryBuildLiveSleevelessFrontVNeckNotationSvg(scoopResult, scoop)).toBeNull();
    expect(resolveSleevelessFrontDiagramSrc("shaping-notation", scoop)).toContain(
      "diagram-jp-front-round",
    );

    const cardiganRound = cardiganPattern("round");
    const cardiganRoundResult = generateSleevelessBackPattern(cardiganRound);
    expect(shouldUseGeneratedSleevelessFrontVNeckNotation(cardiganRoundResult, cardiganRound)).toBe(
      false,
    );
    expect(tryBuildLiveSleevelessFrontVNeckNotationSvg(cardiganRoundResult, cardiganRound)).toBeNull();
    expect(resolveSleevelessFrontDiagramSrc("shaping-notation", cardiganRound)).toContain(
      "diagram-jp-cardigan-round",
    );

    const cardiganV = cardiganPattern("v-neck");
    const cardiganVResult = generateSleevelessBackPattern(cardiganV);
    expect(cardiganVResult.frontNeckShoulderShapingChart.sleevelessFullWidthVNeckFront).toBe(true);
    expect(shouldUseGeneratedSleevelessFrontVNeckNotation(cardiganVResult, cardiganV)).toBe(false);
    expect(tryBuildLiveSleevelessFrontVNeckNotationSvg(cardiganVResult, cardiganV)).toBeNull();
    expect(resolveSleevelessFrontDiagramSrc("shaping-notation", cardiganV)).toContain(
      "diagram-jp-cardigan-v",
    );

    expect(resolveSleevelessBackDiagramSrc("shaping-notation", amandaVNeckPattern())).toContain(
      "diagram-jp-back",
    );
  });

  it("keeps the old V-neck Illustrator asset in the repo for fallback", () => {
    expect(
      existsSync(
        join(srcRoot, "../public/images/patterns/sleeveless/diagrams/diagram-jp-front-v.svg"),
      ),
    ).toBe(true);
  });

  it("wires generated hydration before the Front template fetch", () => {
    const script = readFileSync(join(srcRoot, "scripts/sleevelessPatternPageShared.ts"), "utf8");
    expect(script).toContain("tryBuildLiveSleevelessFrontVNeckNotationSvg");
    expect(script).toContain("sleevelessFrontVNeckShapingNotationDiagramSvg.ts");

    const fnStart = script.indexOf("async function inlineFrontJapaneseNotationSvg");
    expect(fnStart).toBeGreaterThan(-1);
    const fn = script.slice(fnStart, fnStart + 2200);
    expect(fn).toContain("tryBuildLiveSleevelessFrontVNeckNotationSvg");
    expect(fn.indexOf("tryBuildLiveSleevelessFrontVNeckNotationSvg")).toBeLessThan(
      fn.indexOf("tryBuildLiveSleevelessFrontRoundNotationSvg"),
    );
    expect(fn.indexOf("tryBuildLiveSleevelessFrontRoundNotationSvg")).toBeLessThan(
      fn.indexOf("tryBuildLiveSleevelessFrontCardiganVNeckNotationSvg"),
    );
    expect(fn.indexOf("tryBuildLiveSleevelessFrontCardiganVNeckNotationSvg")).toBeLessThan(
      fn.indexOf("resolveSleevelessFrontDiagramSrc"),
    );
    expect(fn.indexOf("if (generatedSvg)")).toBeLessThan(fn.indexOf("await fetch(notationSrc"));

    const backFnStart = script.indexOf("async function inlineBackJapaneseNotationSvg");
    const backFn = script.slice(backFnStart, backFnStart + 1600);
    expect(backFn).toContain("resolveSleevelessBackDiagramSrc");
    expect(backFn).toContain("await fetch(notationSrc");
    expect(backFn).not.toContain("tryBuildLiveSleevelessFrontVNeckNotationSvg");

    expect(script).toContain('resolveSleevelessFrontDiagramSrc("sts-rows"');
    expect(script).toContain("buildSleevelessPatternDiagramTabsShellHtml");
    expect(script).not.toContain("buildHatShapingNotationDiagramSvg");
  });

  it("selects generated A-line V notation and keeps V upper notation unchanged", () => {
    function expectUpperVUnchanged(straightSvg: string, alineSvg: string): void {
      for (const attr of [
        "data-armhole-bo",
        "data-armhole-shaping",
        "data-neck-shaping",
        "data-shoulder-shaping",
      ]) {
        expect(svgAttr(alineSvg, attr)).toBe(svgAttr(straightSvg, attr));
      }
      for (const attr of [
        "data-bust-left",
        "data-bust-right",
        "data-armhole-start-y",
        "data-last-armhole-y",
        "data-neck-start-y",
        "data-shoulder-y",
      ]) {
        expect(svgNum(alineSvg, attr)).toBeCloseTo(svgNum(straightSvg, attr), 2);
      }
    }

    const straight = straightBodyVNeckPattern();
    const straightSvg = buildSleevelessFrontVNeckShapingNotationDiagramSvg(
      generateSleevelessBackPattern(straight),
      straight,
    );

    for (const [pattern, direction] of [
      [inwardBodyVNeckPattern(), "inward"],
      [alineOutwardExplicitVNeckPattern(), "outward"],
    ] as const) {
      const result = generateSleevelessBackPattern(pattern);
      expect(shouldUseGeneratedSleevelessFrontVNeckNotation(result, pattern)).toBe(true);
      const live = tryBuildLiveSleevelessFrontVNeckNotationSvg(result, pattern);
      expect(live).toBeTruthy();
      expect(svgAttr(live!, "data-body-shaping-direction")).toBe(direction);
      expectUpperVUnchanged(straightSvg, live!);
    }
  });

  it("falls back for explicit shaped/waist Pullover V", () => {
    for (const pattern of [shapedVNeckPattern(), waistVNeckPattern()]) {
      const result = generateSleevelessBackPattern(pattern);
      expect(shouldUseGeneratedSleevelessFrontVNeckNotation(result, pattern)).toBe(false);
      expect(tryBuildLiveSleevelessFrontVNeckNotationSvg(result, pattern)).toBeNull();
    }
  });
});
