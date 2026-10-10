import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { MEMBERSHIPS } from "../../config/memberships";
import { getOpenPatternHrefForProject } from "./customPatternProjectNavigation";
import type { CustomPatternProject } from "./customPatternProjectTypes";
import { buildDropShoulderSleeveShapingChartRows } from "./dropShoulderSleeveShapingChart";
import { generateDropShoulderPattern } from "./dropShoulderPatternOutput";
import { withDropShoulderConstructionAuthored } from "./patternConstructionIdentity";
import {
  patternSystemDisplayName,
  resolvePatternSystemFromProject,
} from "./patternSystemId";
import { computeDefaultMeasurementsFromChartRow } from "./sleevelessExpressSizeChartClient";
import type { ChartRow } from "./sleevelessExpressSizeChartTypes";
import {
  buildSleevelessFinishingPrintListHtml,
  buildSleevelessFinishingStepsHtml,
} from "./sleevelessPatternFinishingHtml";
import { sleevelessFinishingFromPattern } from "./sleevelessPatternFinishing";
import { generateSleevelessBackPattern } from "./sleevelessPatternOutput";
import { renderPatternDisplayRowsHtml } from "./sleevelessPatternDisplayHtml";
import { renderSleevelessPrintPieceHtml } from "./sleevelessPatternPrintRender";
import {
  canCreatePatternForSystem,
  canEditPatternSettingsForSystem,
  hasPatternSystemAccess,
  resolvePatternSystemAccess,
  type SleevelessUserAccess,
} from "./sleevelessPatternSystemAccess";
import { generateSetInSleevePattern } from "./setInSleevePatternOutput";
import {
  armholeLocalRcActiveShoulderChecklistStart,
  buildActiveSideInstructionTableRows,
} from "./neckShoulderActiveSideChecklist";
import { renderNeckShoulderShapingChartTableOnlyHtml } from "./neckShoulderShapingChartHtml";
import { renderSleevelessPatternTabFrontChartTableHtml } from "./sleevelessFrontChartIntroHtml";
import { buildSleevelessRoundNeckShapingMapData } from "./sleevelessRoundNeckShapingSchedule";
import {
  SET_IN_SLEEVE_CONSTRUCTION,
  SET_IN_SLEEVE_DIRECTION,
  withSetInSleeveConstructionAuthored,
  withSetInSleeveConstructionFamily,
} from "./setInSleeveConstructionIdentity";
import plusSizes from "../../../public/data/sizing_sweaters_plus.json";

const finishingDeps = {
  escapeHtml: (s: string) => s,
  glossaryTooltip: (_id: number, term: string) => term,
  neckFinishingVideoKey: "onePieceBand",
  neckFinishingButtonLabel: "One-piece neckband",
  neckFinishingLeadHtml: "",
};

const MISSES_7: ChartRow = {
  bust_or_chest: 40,
  waist: 32,
  hip: 42,
  garment_back_length: 24.5,
  armhole_depth: 7.75,
  shoulder_width: 13.75,
  neck_opening: 7.5,
  front_neck_depth: 5,
  back_neck_depth: 1,
  upper_arm: 12,
  wrist: 6,
  sleeve_length: 17,
};

const MEN_4X: ChartRow = {
  bust_or_chest: 48,
  waist: 46,
  hip: 52.5,
  garment_back_length: 29,
  armhole_depth: 12,
  shoulder_width: 21,
  neck_opening: 8.25,
  front_neck_depth: 5.75,
  back_neck_depth: 1.5,
  upper_arm: 20,
  wrist: 8,
  sleeve_length: 19.75,
};

function pattern(options: {
  audience?: string;
  row?: ChartRow;
  fit?: string;
  bodyShape?: "straight" | "aline";
  garmentStyle?: "pullover" | "cardigan";
  neckline?: "round" | "v-neck";
  sleeveLength?: string;
  stitchesPerInch?: number;
  rowsPerInch?: number;
  availableNeedles?: number;
}): Record<string, unknown> {
  const audience = options.audience ?? "misses";
  const row = options.row ?? MISSES_7;
  const fit = options.fit ?? "standard";
  const measurements = computeDefaultMeasurementsFromChartRow(row, fit, {
    bodyShape: options.bodyShape ?? "straight",
  });
  return {
    fit: {
      sizingChart: audience,
      easeChoice: fit,
      selectedMeasurements: measurements,
    },
    style: withSetInSleeveConstructionAuthored(
      {
        recipientCategory: audience,
        garmentStyle: options.garmentStyle ?? "pullover",
        neckline: options.neckline ?? "round",
        bodyShape: options.bodyShape ?? "straight",
      },
      options.sleeveLength ?? "long",
    ),
    yarnGaugeMachine: {
      gaugeStitchesPerInch: options.stitchesPerInch ?? 5,
      gaugeRowsPerInch: options.rowsPerInch ?? 7,
      availableNeedles: options.availableNeedles ?? 200,
    },
  };
}

function textOf(rows: ReadonlyArray<{ kind: string; paragraphs?: string[]; title?: string }>): string {
  return rows
    .map((row) => (row.kind === "block" ? (row.paragraphs ?? []).join(" ") : row.title ?? ""))
    .join("\n");
}

function savedProject(
  construction: "set-in-sleeve" | "drop-shoulder" | "sleeveless",
): Pick<CustomPatternProject, "pattern" | "customOverrides"> {
  if (construction === "sleeveless") {
    return {
      pattern: { style: { patternMode: "express" } } as CustomPatternProject["pattern"],
      customOverrides: {},
    };
  }
  const style =
    construction === "set-in-sleeve"
      ? withSetInSleeveConstructionAuthored({ neckline: "round" }, "long")
      : withDropShoulderConstructionAuthored({ neckline: "round" }, "long");
  return {
    pattern: { style } as CustomPatternProject["pattern"],
    customOverrides:
      construction === "set-in-sleeve" ? withSetInSleeveConstructionFamily({}) : {},
  };
}

describe("set-in sleeve pattern choices", () => {
  it("builds a round-neck pullover with a cuff-up sleeve and matching cap", () => {
    const result = generateSetInSleevePattern(pattern({}));
    const overview = textOf(result.overviewRows);
    const back = textOf(result.displayRows);
    const sleeve = textOf(result.sleeveDisplayRows);
    expect(overview).toContain("pullover, round neckline");
    expect(overview).toContain("cuff-up");
    expect(overview).toMatch(/Finished bust 4\d/);
    expect(overview).toContain("separate from the cuff-to-upper-arm length");
    expect(back).toContain("Bind off");
    expect(back).not.toMatch(/decrease 1 stitch at each armhole edge every other row/i);
    expect(sleeve).toContain("Make 2 sleeves.");
    expect(sleeve).toContain("Increase 1 stitch at each side every");
    expect(sleeve).toMatch(/\(RC:/);
    expect(sleeve).toContain("Sleeve-cap height");
    expect(result.sleeveDisplayRows.map((row) => (row.kind === "section" ? row.title : ""))).toEqual(
      expect.arrayContaining(["CUFF", "SLEEVE BODY", "SLEEVE SHAPING CHART", "SLEEVE CAP"]),
    );
    const sectionTitles = result.sleeveDisplayRows
      .filter((row) => row.kind === "section")
      .map((row) => (row.kind === "section" ? row.title : ""));
    expect(sectionTitles).toEqual([
      "CUFF",
      "SLEEVE BODY",
      "SLEEVE SHAPING CHART",
      "SLEEVE CAP",
      "SLEEVE CAP SHAPING CHART",
    ]);
    const chartBlock = result.sleeveDisplayRows.find(
      (row) => row.kind === "block" && row.sleeveShapingChartRows && row.sleeveShapingChartRows.length > 0,
    );
    expect(chartBlock && chartBlock.kind === "block" ? chartBlock.sleeveShapingChartRows : []).toEqual(
      buildDropShoulderSleeveShapingChartRows({
        topSts: result.sleevePiece!.topSts,
        wristSts: result.sleevePiece!.wristSts,
        cuffRows: result.sleevePiece!.cuffRows,
        sleeveBodyRows: result.sleevePiece!.sleeveBodyRows,
        sleeveTotalRows: result.sleevePiece!.sleeveTotalRows,
        direction: "cuff-up",
      }).filter((row) => row.stitchesRemaining > 0),
    );
    const cuffBlock = result.sleeveDisplayRows.find(
      (row, index) =>
        row.kind === "block" &&
        result.sleeveDisplayRows
          .slice(0, index)
          .some((earlier) => earlier.kind === "section" && earlier.title === "CUFF") &&
        !result.sleeveDisplayRows
          .slice(0, index)
          .some((earlier) => earlier.kind === "section" && earlier.title === "SLEEVE BODY"),
    );
    expect(cuffBlock && cuffBlock.kind === "block" ? cuffBlock.stitchCount : 0).toBe(
      result.sleevePiece?.wristSts,
    );
    const capStart = result.sleeveDisplayRows.findIndex(
      (row) => row.kind === "section" && row.title === "SLEEVE CAP",
    );
    const capStitchBlock = result.sleeveDisplayRows
      .slice(capStart + 1)
      .find((row) => row.kind === "block" && row.stitchCount !== undefined);
    expect(capStitchBlock && capStitchBlock.kind === "block" ? capStitchBlock.stitchCount : 0).toBe(
      result.sleevePiece?.topSts,
    );
    const html = renderPatternDisplayRowsHtml(result.sleeveDisplayRows, { pieceSectionId: "sleeve" });
    expect(html).toContain("ns-shaping-chart__row-check");
    expect(html).toContain("SLEEVE SHAPING CHART");
    expect(html).toContain("SLEEVE CAP SHAPING CHART");
    expect(html).toContain('data-chart-id="drop-shoulder-sleeve-shaping-chart-sleeve"');
    expect(html).toContain('data-chart-id="set-in-sleeve-cap-shaping-chart-sleeve"');
    expect(html).toContain("data-chart-progress-show-completed");
    expect(html).toContain("data-chart-progress-reset");
    expect(html).not.toContain("Bind off loosely or scrap off");
    expect(html).not.toContain("Knit these rows even");
    const printHtml = renderSleevelessPrintPieceHtml(result.sleeveDisplayRows, "", "sleeve");
    expect(printHtml).toContain("ns-shaping-chart__row-check");
    expect(printHtml).toContain('data-chart-id="set-in-sleeve-cap-shaping-chart-sleeve"');
    expect(printHtml).toContain('type="checkbox"');
    const capChart = result.sleeveDisplayRows.find(
      (row) => row.kind === "block" && row.sleeveShapingChartId === "set-in-sleeve-cap-shaping-chart",
    );
    const capRows = capChart && capChart.kind === "block" ? capChart.sleeveShapingChartRows ?? [] : [];
    const cap = result.sleeveCap;
    expect(capRows.length).toBeGreaterThan(0);
    expect(cap).not.toBeNull();
    expect(capRows[capRows.length - 1]).toMatchObject({
      rc: (result.sleevePiece?.sleeveBodyRows ?? 0) + (cap?.totals.capRows ?? -1),
      stitchesRemaining: 0,
    });
    expect(capRows[capRows.length - 1]?.action).toBe(
      `Bind off the remaining ${cap?.totals.finalStitches ?? 0} stitches`,
    );
    expect(result.sleeveCap?.ok).toBe(true);
    expect(result.warnings.join(" ")).not.toMatch(/bind-off does not match/i);
    expect(result.setInArmholePlan?.appliesTo).toBe("front-and-back");
  });

  it("writes cardigan armhole and finishing, not pullover sleeve hanging", () => {
    const data = pattern({ garmentStyle: "cardigan", neckline: "round" });
    const result = generateSetInSleevePattern(data);
    const front = textOf(result.frontDisplayRows);
    expect(textOf(result.overviewRows)).toContain("cardigan, round neckline");
    expect(front).toContain("at the armhole edge");
    expect(front).not.toContain("at each armhole edge");
    const finishing = sleevelessFinishingFromPattern(data, result.debug);
    expect(finishing.isSetInSleeve).toBe(true);
    expect(finishing.isCardigan).toBe(true);
    expect(finishing.steps.map((step) => step.id)).toContain("finishFrontEdges");
    expect(finishing.steps.map((step) => step.id)).not.toContain("finishArmholes");
    const html = buildSleevelessFinishingStepsHtml({
      isCardigan: true,
      isSetInSleeve: true,
      deps: finishingDeps,
    });
    expect(html).toContain("Seam each sleeve.");
    expect(html).toContain("Match the center of the sleeve cap to the shoulder seam.");
    expect(html).toContain("Seam from hem to underarm.");
    expect(html).not.toContain("Hang the live sleeve stitches.");
    expect(html).toContain("Finish Front Edges");
  });

  it("keeps V-neck instructions off the round-neck path", () => {
    const round = generateSetInSleevePattern(pattern({ neckline: "round" }));
    const vNeck = generateSetInSleevePattern(pattern({ neckline: "v-neck", garmentStyle: "cardigan" }));
    expect(textOf(vNeck.overviewRows)).toContain("cardigan, V-neck");
    expect(textOf(vNeck.frontDisplayRows)).not.toMatch(
      /decrease 1 stitch at (each |the )?armhole edge every other row/i,
    );
    expect(textOf(round.frontDisplayRows)).not.toContain("V-neck");
    const vData = pattern({ neckline: "v-neck", garmentStyle: "pullover" });
    const finishing = sleevelessFinishingFromPattern(vData, vNeck.debug);
    const html = buildSleevelessFinishingStepsHtml({
      isCardigan: false,
      isSetInSleeve: true,
      deps: { ...finishingDeps, neckFinishingVideoKey: "vNeckBandFinishing" },
    });
    expect(finishing.isCardigan).toBe(false);
    expect(html).toContain("Set the sleeve into the armhole.");
    expect(html).not.toContain("Finish Front Edges");
    const print = buildSleevelessFinishingPrintListHtml({
      isCardigan: true,
      isSetInSleeve: true,
    });
    expect(print).toContain("match the center of the sleeve cap to the shoulder seam");
    expect(print).not.toContain("hang the live sleeve stitches");
  });

  it("uses straight and A-line hips from the existing body measurements", () => {
    const straight = generateSetInSleevePattern(pattern({ bodyShape: "straight" }));
    const aline = generateSetInSleevePattern(pattern({ bodyShape: "aline" }));
    const straightHip = textOf(straight.overviewRows).match(/Hip ([0-9.]+) in/)?.[1];
    const alineHip = textOf(aline.overviewRows).match(/Hip ([0-9.]+) in/)?.[1];
    expect(straightHip).toBeDefined();
    expect(alineHip).toBeDefined();
    expect(Number(alineHip)).toBeGreaterThan(Number(straightHip));
  });

  it("calculates Women's 6X and both armhole methods", () => {
    const plus6x = (plusSizes as ChartRow[]).find((row) => String(row.size) === "6x");
    expect(plus6x).toBeDefined();
    const plus = generateSetInSleevePattern(
      pattern({
        audience: "plus",
        row: plus6x,
        stitchesPerInch: 5,
        rowsPerInch: 7,
      }),
    );
    expect(plus.sleeveCap?.ok).toBe(true);
    expect(textOf(plus.overviewRows)).toContain("Armhole method:");
    expect(plus.warnings.join(" ")).not.toMatch(/bind-off does not match/i);

    const alternate = generateSetInSleevePattern(
      pattern({ stitchesPerInch: 5, rowsPerInch: 7 }),
    );
    const standard = generateSetInSleevePattern(
      pattern({
        audience: "men",
        row: MEN_4X,
        stitchesPerInch: 4,
        rowsPerInch: 6,
      }),
    );
    expect(alternate.setInArmholePlan?.method).toBe("alternate");
    expect(standard.setInArmholePlan?.method).toBe("standard");
    expect(standard.sleeveCap?.armhole.method).toBe("standard");
    expect(standard.warnings.join(" ")).not.toMatch(/bind-off does not match/i);
    expect(textOf(standard.sleeveDisplayRows)).toContain("Bind off");
  });

  it("changes sleeve instructions when gauge or sleeve length changes", () => {
    const fine = generateSetInSleevePattern(pattern({ stitchesPerInch: 7, rowsPerInch: 10 }));
    const coarse = generateSetInSleevePattern(pattern({ stitchesPerInch: 4, rowsPerInch: 6 }));
    const longSleeve = textOf(
      generateSetInSleevePattern(pattern({ sleeveLength: "long" })).sleeveDisplayRows,
    );
    const shortSleeve = textOf(
      generateSetInSleevePattern(pattern({ sleeveLength: "short" })).sleeveDisplayRows,
    );
    expect(fine.sleeveCap?.sleeve.upperArmStitches).not.toBe(
      coarse.sleeveCap?.sleeve.upperArmStitches,
    );
    expect(longSleeve).not.toBe(shortSleeve);
  });

  it("explains needle capacity without hiding a valid larger size", () => {
    const result = generateSetInSleevePattern(pattern({ availableNeedles: 40 }));
    expect(result.sleeveCap?.ok).toBe(true);
    expect(textOf(result.overviewRows)).toContain("needles at the widest piece");
    expect(textOf(result.overviewRows)).toContain("Panel seams are not added.");
    expect(textOf(result.displayRows)).toContain("Bind off");
  });
});

describe("set-in sleeve saved patterns, print, and membership", () => {
  it("classifies saved projects separately from sleeveless and drop shoulder", () => {
    const setIn = savedProject("set-in-sleeve");
    const drop = savedProject("drop-shoulder");
    const sleeveless = savedProject("sleeveless");
    expect(resolvePatternSystemFromProject(setIn)).toBe("set-in-sleeve");
    expect(resolvePatternSystemFromProject(drop)).toBe("drop-shoulder");
    expect(resolvePatternSystemFromProject(sleeveless)).toBe("sleeveless");
    expect(patternSystemDisplayName("set-in-sleeve")).toBe("Set-In Sleeve");
    expect(getOpenPatternHrefForProject(setIn)).toBe("/patterns/set-in-sleeve/pattern/");
    expect(getOpenPatternHrefForProject(drop)).toBe("/patterns/drop-shoulder/pattern/");
    expect(getOpenPatternHrefForProject(sleeveless)).not.toContain("set-in-sleeve");
    const style = setIn.pattern?.style as Record<string, unknown>;
    expect(style.sleeveDirection).toBe(SET_IN_SLEEVE_DIRECTION);
    expect(style.construction).toBe(SET_IN_SLEEVE_CONSTRUCTION);
  });

  it("keeps the catalog coming soon and prints from the pattern workspace", () => {
    const catalog = readFileSync("src/pages/patterns/index.astro", "utf8");
    expect(catalog).toContain("title: 'Set-In Sleeve Sweater'");
    expect(catalog).toContain("const comingSoonPatterns");
    const patternPage = readFileSync("src/pages/patterns/set-in-sleeve/pattern/index.astro", "utf8");
    expect(patternPage).toContain("thumbnailSrc={SET_IN_SLEEVE_PATTERN_LANDING_IMAGE_SRC}");
    expect(patternPage).toContain("thumbnailWidth={1536}");
    expect(patternPage).toContain("thumbnailHeight={1024}");
    expect(patternPage).not.toContain("drop_shoulder.webp");
    expect(patternPage).toContain('data-express-construction="set-in-sleeve"');
    expect(patternPage).toContain("data-pattern-print-skip-modal");
    expect(patternPage).toContain("PatternPrintFooter");
    expect(patternPage).toContain("KnitItNow.com/set-in-sleeve");
    expect(readFileSync("src/pages/patterns/set-in-sleeve/builder.astro", "utf8")).toContain(
      'data-express-review-href="/patterns/set-in-sleeve/pattern/?generated=1"',
    );
    expect(catalog).toContain("'/images/patterns/set-in.png'");
    expect(catalog).toContain("'/images/patterns/raglan.png'");
    expect(catalog).not.toContain("set-in.webp");
    expect(catalog).not.toContain("raglan.webp");
    const landing = readFileSync("src/lib/patterns/setInSleevePatternLanding.ts", "utf8");
    expect(landing).toContain("/images/patterns/set-in.png");
    expect(landing).not.toContain("set-in.webp");
    expect(readFileSync("src/pages/patterns/set-in-sleeve/index.astro", "utf8")).toContain(
      "SET_IN_SLEEVE_PATTERN_BUILDER_LANDING",
    );
  });

  it("follows membership access and does not treat a free claim as create access", () => {
    const member: SleevelessUserAccess = {
      loggedIn: true,
      memberId: "ms_member",
      activePlanIds: [MEMBERSHIPS.membership.memberstackPlanId],
      hasSystemAccess: true,
    };
    const loggedOut: SleevelessUserAccess = {
      loggedIn: false,
      hasSystemAccess: false,
    };
    expect(
      resolvePatternSystemAccess({
        activePlanIds: member.activePlanIds ?? [],
        patternSystemId: "set-in-sleeve",
      }).hasSystemAccess,
    ).toBe(true);
    expect(canCreatePatternForSystem(member, "set-in-sleeve")).toBe(true);
    expect(canEditPatternSettingsForSystem(member, "set-in-sleeve")).toBe(true);
    expect(hasPatternSystemAccess(loggedOut, "set-in-sleeve")).toBe(false);
    expect(canCreatePatternForSystem(loggedOut, "set-in-sleeve")).toBe(false);
    expect(
      resolvePatternSystemAccess({
        activePlanIds: [],
        patternSystemId: "set-in-sleeve",
        sleevelessUnlockedViaJson: true,
      }).hasSystemAccess,
    ).toBe(false);
  });
});

describe("existing sleeveless and drop-shoulder generation", () => {
  it("leaves sleeveless armhole wording unchanged when set-in mode is off", () => {
    const data = pattern({});
    const style = { ...(data.style as Record<string, unknown>) };
    delete style.construction;
    delete style.constructionAuthored;
    delete style.sleeveDirection;
    const sleeveless = generateSleevelessBackPattern({ ...data, style });
    const back = textOf(sleeveless.displayRows);
    expect(sleeveless.setInArmholePlan).toBeUndefined();
    expect(back).toMatch(/armhole/i);
    expect(back).not.toContain("Sleeve-cap height");
  });

  it("still generates a drop-shoulder pattern from drop-shoulder construction", () => {
    const data = pattern({});
    data.style = withDropShoulderConstructionAuthored(
      { ...(data.style as Record<string, unknown>) },
      "long",
    );
    const result = generateDropShoulderPattern(data);
    expect(result.isDropShoulder).toBe(true);
    expect((result as { isSetInSleeve?: boolean }).isSetInSleeve).not.toBe(true);
  });
});

function backNeckSummaryPlainText(result: ReturnType<typeof generateSetInSleevePattern>): string {
  let inSection = false;
  const parts: string[] = [];
  for (const row of result.displayRows) {
    if (row.kind === "section" && row.title === "BACK NECKLINE & SHOULDERS") {
      inSection = true;
      continue;
    }
    if (inSection && row.kind === "section") break;
    if (inSection && row.kind === "block") {
      const paras = row.trustedParagraphs ?? row.paragraphs ?? [];
      parts.push(...paras);
    }
  }
  return parts.join("\n").replace(/<[^>]+>/g, "");
}

function backChecklistHtml(result: ReturnType<typeof generateSetInSleevePattern>): string {
  const chart = result.neckShoulderShapingChart;
  if (!chart) return "";
  const rcStart = armholeLocalRcActiveShoulderChecklistStart(chart, result.debug.armholeStartRow, {
    includeCenterNecklineSetupRow: true,
  });
  return renderNeckShoulderShapingChartTableOnlyHtml(chart, "ns-shaping-chart-back", "", {
    activeSideOnly: true,
    activeSideRcStart: rcStart,
    includeCenterNecklineSetupRow: true,
    hideCenterNecklineSetupRow: true,
    tableHeading: "First Shoulder Checklist",
    collapsibleDefaultOpen: false,
  });
}

describe("set-in back neckline and shoulder checklist", () => {
  const cases = [
    { label: "misses 7 round", options: { row: MISSES_7, neckline: "round" as const } },
    { label: "misses 7 v-neck", options: { row: MISSES_7, neckline: "v-neck" as const } },
    {
      label: "men 4x finer gauge",
      options: { row: MEN_4X, audience: "men", stitchesPerInch: 4, rowsPerInch: 6, neckline: "round" as const },
    },
    {
      label: "plus size high row gauge",
      options: {
        row: (plusSizes as ChartRow[]).find((row) => String(row.size) === "6x"),
        audience: "plus",
        stitchesPerInch: 6,
        rowsPerInch: 8,
        neckline: "round" as const,
      },
    },
  ];

  it.each(cases)("renders both shoulder checklists for $label", ({ options }) => {
    const result = generateSetInSleevePattern(pattern(options));
    const summary = backNeckSummaryPlainText(result);
    expect(summary).toMatch(/Place center neckline needles L\d+ through R\d+ in hold/i);
    expect(summary).toMatch(/Put the opposite shoulder needles L\d+ through L\d+ into hold/i);
    expect(summary).toMatch(/Work the first shoulder on needles R\d+ through R\d+/i);
    expect(summary).toMatch(/Use the checklist below for row-by-row neckline and shoulder shaping/i);
    expect(summary).not.toMatch(/Put needles L\d+ through R\d+ into hold/i);
    expect(result.displayRows.some((row) => row.kind === "neckShoulderChartTableMount")).toBe(true);
    expect(result.neckShoulderChartUsesLiveRows).toBe(true);

    const html = backChecklistHtml(result);
    expect(html).toContain("First Shoulder Checklist");
    expect(html).toContain("Second Shoulder Checklist");
    expect(html).toContain("Show Completed Rows");
    expect(html).toContain("Reset Checklist");
    expect(html).toContain("Done");
    expect(html).toContain(">RC");
    expect(html).toContain("Action");
    expect(html).toContain("Edge");
    expect(html).toContain("Sts Remaining");
    expect(html).toContain('type="checkbox"');
    expect(html).toContain("ns-shaping-chart--second-shoulder");
    expect(html).toContain("data-second-shoulder-content");

    const rows = buildActiveSideInstructionTableRows(result.neckShoulderShapingChart!, 0, {
      includeCenterNecklineSetupRow: true,
      hideCenterNecklineSetupRow: true,
    });
    expect(rows.some((row) => row.edge === "Neck" && /Hold|Decrease|Bind off/.test(row.action))).toBe(true);
    expect(rows.some((row) => row.edge === "Shoulder" && /Bind off/.test(row.action))).toBe(true);
  });

  it("shows neckline and shoulder actions that fall on the same row", () => {
    const overlapping = cases
      .map(({ options }) => generateSetInSleevePattern(pattern(options)))
      .find((result) =>
        (result.neckShoulderShapingChart?.timeline ?? []).some((entry) => {
          const neck = entry.events.some((event) => event.edge === "inner" && event.side === "right");
          const shoulder = entry.events.some(
            (event) => event.edge === "outer" && event.side === "right" && event.kind !== "decrease",
          );
          return neck && shoulder;
        }),
      );
    expect(overlapping).toBeTruthy();
    const sharedTimeline = (overlapping!.neckShoulderShapingChart?.timeline ?? []).filter((entry) => {
      const neck = entry.events.some((event) => event.edge === "inner" && event.side === "right");
      const shoulder = entry.events.some(
        (event) => event.edge === "outer" && event.side === "right" && event.kind !== "decrease",
      );
      return neck && shoulder;
    });
    expect(sharedTimeline.length).toBeGreaterThan(0);
    const rows = buildActiveSideInstructionTableRows(overlapping!.neckShoulderShapingChart!, 0, {
      includeCenterNecklineSetupRow: true,
      hideCenterNecklineSetupRow: true,
    });
    const shaping = rows.filter((row) => row.edge === "Neck" || row.edge === "Shoulder");
    const pairs: Array<[typeof shaping[number], typeof shaping[number]]> = [];
    for (let i = 0; i < shaping.length - 1; i += 1) {
      const neck = shaping[i];
      const shoulder = shaping[i + 1];
      if (neck?.edge === "Neck" && shoulder?.edge === "Shoulder") pairs.push([neck, shoulder]);
    }
    expect(pairs.length).toBe(sharedTimeline.length);
    sharedTimeline.forEach((entry, index) => {
      const neckAmount = entry.events.find((event) => event.edge === "inner" && event.side === "right")?.amount;
      const shoulderAmount = entry.events.find(
        (event) => event.edge === "outer" && event.side === "right" && event.kind !== "decrease",
      )?.amount;
      const [neck, shoulder] = pairs[index]!;
      expect(neck.action).toContain(String(neckAmount));
      expect(shoulder.action).toContain(String(shoulderAmount));
      expect(shoulder.rc).toBe(neck.rc + 1);
      expect(neck.carriagePosition).not.toBe(shoulder.carriagePosition);
      expect(neck.stitchesRemaining - (shoulderAmount ?? 0)).toBe(shoulder.stitchesRemaining);
    });
    const html = backChecklistHtml(overlapping!);
    const firstPair = pairs[0]!;
    expect(html.split(firstPair[0].action).length - 1).toBeGreaterThanOrEqual(2);
    expect(html.split(firstPair[1].action).length - 1).toBeGreaterThanOrEqual(2);
  });

  it("keeps the sleeveless back summary on the combined hold range", () => {
    const data = pattern({});
    const style = { ...(data.style as Record<string, unknown>) };
    delete style.construction;
    delete style.constructionAuthored;
    delete style.sleeveDirection;
    const sleeveless = generateSleevelessBackPattern({ ...data, style });
    const summary = backNeckSummaryPlainText(sleeveless);
    expect(summary).toMatch(/Put needles L\d+ through R\d+ into hold/i);
    expect(summary).not.toMatch(/Put the opposite shoulder needles/i);
  });

  it("connects the shared checklist renderer on the set-in pattern page", () => {
    const source = readFileSync("src/scripts/sleevelessPatternPageShared.ts", "utf8");
    const setIn = source.slice(
      source.indexOf("async function renderSetInSleeveMount"),
      source.indexOf("async function renderMount"),
    );
    expect(setIn).toContain('mount.querySelector("#sg-neck-shoulder-chart-table-back")');
    expect(setIn).toContain("renderNeckShoulderShapingChartTableOnlyHtml");
    expect(setIn).toContain('tableHeading: "First Shoulder Checklist"');
    expect(setIn).toContain("window.kbmNeckShoulderChartPrintContext");
    expect(setIn).toContain("bindSecondShoulderChecklistToggles(mount)");
    expect(setIn).toContain("initChartProgressTracking");
    expect(setIn).toContain('mount.querySelector("#sg-neck-shoulder-chart-table-front")');
    expect(setIn).toContain("renderSleevelessPatternTabFrontChartTableHtml");
    expect(setIn).toContain("buildSleevelessRoundNeckShapingMapData");
    expect(setIn).toContain("front-neckline-shoulder-chart-print-btn");
    const printCss = readFileSync("src/styles/ns-shaping-chart.css", "utf8");
    expect(printCss).toContain(".ns-shaping-chart__tabpanel[hidden]");
    expect(printCss).toContain(".ns-shaping-chart--second-shoulder[hidden]");
    expect(printCss).toContain("display: block !important;");
  });
});

describe("set-in front neckline and shoulder checklist", () => {
  const cases = [
    { label: "misses 7 round", options: { row: MISSES_7, neckline: "round" as const } },
    { label: "misses 7 v-neck", options: { row: MISSES_7, neckline: "v-neck" as const } },
    {
      label: "men 4x finer gauge",
      options: { row: MEN_4X, audience: "men", stitchesPerInch: 4, rowsPerInch: 6, neckline: "round" as const },
    },
    {
      label: "plus 6x high row gauge",
      options: {
        row: (plusSizes as ChartRow[]).find((row) => String(row.size) === "6x"),
        audience: "plus",
        stitchesPerInch: 6,
        rowsPerInch: 8,
        neckline: "v-neck" as const,
      },
    },
  ];

  it.each(cases)("renders the shared front checklist for $label", ({ options }) => {
    const result = generateSetInSleevePattern(pattern(options));
    expect(result.frontDisplayRows.some((row) => row.kind === "section" && row.title === "FRONT NECKLINE & SHOULDERS")).toBe(true);
    expect(result.frontDisplayRows.some((row) => row.kind === "neckShoulderChartTableMount")).toBe(true);
    expect(result.frontNeckShoulderChartUsesLiveRows).toBe(true);
    const html = renderSleevelessPatternTabFrontChartTableHtml(result, {
      relocateIntro: options.neckline === "round",
    });
    expect(html).toContain("Show Completed Rows");
    expect(html).toContain("Reset Checklist");
    expect(html).toContain("Done");
    expect(html).toContain(">RC");
    expect(html).toContain("Action");
    expect(html).toContain("Edge");
    expect(html).toContain("Sts Remaining");
    expect(html).toContain('type="checkbox"');
    const map = buildSleevelessRoundNeckShapingMapData(result.frontNeckShoulderTimeline, {
      firstArmholeRc: result.debug.armholeStartRow,
    });
    if (options.neckline === "round") {
      expect(html).toContain("First Shoulder Checklist");
      expect(html).toContain("Second Shoulder Checklist");
      expect(html).toContain("ns-shaping-chart--second-shoulder");
      expect(map).not.toBeNull();
    } else {
      expect(html).toContain("First Side");
      expect(html).toContain("Second Side");
      expect(html).toContain('data-ns-shoulder-panel="first"');
      expect(html).toContain('data-ns-shoulder-panel="second"');
      expect(map).toBeNull();
    }
    const rows = buildActiveSideInstructionTableRows(result.frontNeckShoulderShapingChart, 0, {
      includeCenterNecklineSetupRow: true,
    });
    expect(rows.some((row) => row.edge === "Neck")).toBe(true);
    expect(rows.some((row) => row.edge === "Shoulder" || row.edge === "Armhole")).toBe(true);
  });
});
