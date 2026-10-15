/**
 * Set-in sleeve pattern output.
 *
 * The body, neckline, shoulders, hem, and cardigan fronts come from the sleeveless generator.
 * The armhole section is replaced with the approved set-in armhole. Sleeves are cuff-up:
 * the drop-shoulder sleeve taper through the upper arm, then the approved sleeve cap.
 */

import { buildVNecklinePlan } from "./legoBlocks/vNeckline";
import { resolveEffectiveBackNeckDepthInches } from "./customBuildEffectiveNeckDepth";
import {
  assessSetInSleeveNeedleCapacity,
  readCenterSeams,
  type CenterSeamCapacity,
} from "./centerSeamConstruction";
import {
  calculateDropShoulderSleevePieceNumbers,
  type DropShoulderSleevePieceNumbers,
} from "./dropShoulderSleevePieceNumbers";
import {
  resolveDropShoulderSleeveInches,
} from "./dropShoulderSleeveMeasurementOverrides";
import { readEffectiveDropShoulderUserEditedSleeveFields } from "./dropShoulderUserEditedSleeveFields";
import {
  coordinatedShapingHandoffLines,
  resolveFrontVNeckShapingTimingCase,
} from "./frontArmholeNecklineComposition";
import { normalizeParentheticalRcLists } from "./parentheticalRcList";
import { getDefaultCuffLengthInches } from "./hemDefaults";
import { normalizeDropShoulderSleeveLengthChoice } from "./patternConstructionIdentity";
import {
  generateSleevelessBackPattern,
  formatRcColon,
  type SleevelessBackPatternResult,
  type SleevelessPatternDisplayRow,
} from "./sleevelessPatternOutput";
import {
  isSleevelessCardiganGarmentStyle,
  isSleevelessVNeckChoice,
} from "./sleevelessFrontDiagramSrc";
import { calculateSetInSleeveCap, type SetInSleeveCapSuccess } from "./setInSleeve/sleeveCapMath";
import { setInSleeveTaperProblem } from "./setInSleeve/setInSleeveTaper";
import {
  buildSetInCuffUpSleevePresentation,
  setInArmholeInstructionBlocks,
  setInOneEdgeArmholeInstructionBlocks,
  type SetInArmholeDisplayBlock,
} from "./setInSleeve/setInSleeveInstructions";
import type { SetInArmholePlan } from "./setInSleeve/setInArmhole";
import { withSetInSleeveConstructionAuthored } from "./setInSleeveConstructionIdentity";
import {
  SET_IN_NECKLINE_ORIENTATION_TIP_ID,
  setInBackArmholeBindOffTrickTip,
  setInNecklineOrientationTipBlock,
} from "./setInSleeveLearningResources";

export type SetInSleevePatternResult = SleevelessBackPatternResult & {
  isSetInSleeve: true;
  sleeveDisplayRows: SleevelessPatternDisplayRow[];
  overviewRows: SleevelessPatternDisplayRow[];
  sleeveCap: SetInSleeveCapSuccess | null;
  /** Cuff-up sleeve counts already used for the written sleeve. Null when the cap could not be calculated. */
  sleevePiece: DropShoulderSleevePieceNumbers | null;
  /**
   * Finished inches already used to build the sleeve piece. Diagram labels only.
   * Null when the sleeve could not be calculated.
   */
  sleeveFinishedInches: {
    wristInches?: number;
    cuffDepthInches?: number;
    /** Cuff-to-upper-arm length. Sleeve-cap height is not included. */
    sleeveLengthInches?: number;
  } | null;
  /**
   * Set when the armhole, sleeve cap, or sleeve taper cannot be knitted.
   * A body/cap bind-off mismatch stays a warning and does not set this.
   */
  sleeveSaveBlocker: string | null;
  /** Per-piece needle check. Set-In Sleeve uses this instead of the shared text scan. */
  needleCapacity?: CenterSeamCapacity;
  /**
   * Present when the knitter accepted added center seams.
   * `applied` is false when a half or the sleeve still does not fit.
   */
  centerSeams?: {
    applied: boolean;
    splitFront: boolean;
    splitBack: boolean;
    backHem?: number;
    backBust?: number;
    backAfter?: number;
    frontHem?: number;
    frontBust?: number;
    frontAfter?: number;
  };
};

/**
 * Leftover sleeveless armhole copy in neckline summaries.
 * The set-in decrease sentence also says "every other row", so this must not match it.
 * Sleeveless decreases end with "removed"; sleeveless bind-offs say "bind off or hold".
 */
const SLEEVELESS_ARMHOLE_PROSE =
  /bind off or hold|decrease 1 stitch at (each |the )?armhole edge every other row,[^\n]*\bremoved\b/i;

function section(obj: unknown): Record<string, unknown> {
  return obj && typeof obj === "object" && !Array.isArray(obj) ? (obj as Record<string, unknown>) : {};
}

function positive(value: unknown): number | undefined {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return n;
}

function measurementOverrideStrings(fit: Record<string, unknown>): Record<string, string> {
  const overrides = section(fit.cbMeasurementOverrides);
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(overrides)) {
    if (typeof value === "string" && value.trim()) out[key] = value.trim();
    else if (typeof value === "number" && Number.isFinite(value) && value > 0) out[key] = String(value);
  }
  return out;
}

function audienceOf(patternData: Record<string, unknown>): string {
  const fit = section(patternData.fit);
  const style = section(patternData.style);
  const chart = fit.sizingChart ?? fit.knitFor ?? style.recipientCategory;
  return typeof chart === "string" && chart.trim() ? chart.trim() : "misses";
}

function fitOf(patternData: Record<string, unknown>): string {
  const fit = section(patternData.fit);
  const choice = fit.easeChoice ?? fit.fitChoice ?? fit.fit;
  return typeof choice === "string" && choice.trim() ? choice.trim() : "standard";
}

function linesToBlocks(lines: readonly string[]): SleevelessPatternDisplayRow[] {
  return lines.filter((line) => line.trim().length > 0).map((line) => ({ kind: "block" as const, paragraphs: [line] }));
}

/** First back bind-off only. Front and sleeve-cap bind-offs stay plain. */
function armholeBlocksToDisplayRows(
  blocks: readonly SetInArmholeDisplayBlock[],
  garmentRc: number | undefined,
  bindOffTip: boolean,
): SleevelessPatternDisplayRow[] {
  const tip = setInBackArmholeBindOffTrickTip();
  let tipped = false;
  return blocks.map((block) => {
    const row: Extract<SleevelessPatternDisplayRow, { kind: "block" }> = {
      kind: "block",
      paragraphs: block.paragraphs,
      ...(block.rowCounterReset
        ? {
            rowCounterReset: true,
            ...(garmentRc !== undefined ? { rowCounterResetGarmentRc: garmentRc } : {}),
          }
        : {}),
      ...(block.rc !== undefined ? { rc: formatRcColon(block.rc) } : {}),
      ...(block.stitchCount !== undefined && block.stitchCount >= 0 ? { stitchCount: block.stitchCount } : {}),
    };
    if (bindOffTip && !tipped && block.paragraphs.some((paragraph) => /\bbind off\b/i.test(paragraph))) {
      tipped = true;
      return { ...row, ...tip };
    }
    return row;
  });
}

/**
 * Pullover V-necks skip the shared orientation card. Cardigan V-necks and round
 * necks already include it, so this does not add a second copy.
 */
function withSetInVNeckPulloverOrientationTip(
  rows: readonly SleevelessPatternDisplayRow[],
  patternData: Record<string, unknown>,
): SleevelessPatternDisplayRow[] {
  if (!isSleevelessVNeckChoice(patternData) || isSleevelessCardiganGarmentStyle(patternData)) {
    return [...rows];
  }
  if (rows.some((row) => row.kind === "block" && row.tipId === SET_IN_NECKLINE_ORIENTATION_TIP_ID)) {
    return [...rows];
  }
  const out: SleevelessPatternDisplayRow[] = [];
  let inserted = false;
  for (const row of rows) {
    out.push(row);
    if (!inserted && row.kind === "section" && /NECKLINE\s*&\s*SHOULDERS/i.test(row.title ?? "")) {
      out.push(setInNecklineOrientationTipBlock());
      inserted = true;
    }
  }
  return out;
}

/** Written Set-In instructions use `RC: 039`. Checklist cells and diagram `rc039` labels are left alone. */
function rewriteSetInWrittenRc(text: string): string {
  let next = text.replace(
    /Knit until Armhole RC reaches\s+(?:RC:\s*)?(\d{1,4})/gi,
    (_match, n: string) => `Knit until the armhole row counter reads ${formatRcColon(Number(n))}`,
  );
  next = next.replace(/Armhole RC:\s*(\d{1,4})/gi, (_match, n: string) => formatRcColon(Number(n)));
  next = next.replace(/\bRC:(\d{1,4})\b/g, (_match, n: string) => formatRcColon(Number(n)));
  next = next.replace(/\bRC\s+(\d{1,4})\b/g, (_match, n: string) => formatRcColon(Number(n)));
  return normalizeParentheticalRcLists(next);
}

function rewriteSetInDisplayRows(
  rows: readonly SleevelessPatternDisplayRow[],
): SleevelessPatternDisplayRow[] {
  return rows.map((row) => {
    if (row.kind !== "block") return row;
    const paragraphs = row.paragraphs?.map(rewriteSetInWrittenRc);
    const trustedParagraphs = row.trustedParagraphs?.map(rewriteSetInWrittenRc);
    if (paragraphs === row.paragraphs && trustedParagraphs === row.trustedParagraphs) return row;
    return {
      ...row,
      ...(paragraphs ? { paragraphs } : {}),
      ...(trustedParagraphs ? { trustedParagraphs } : {}),
    };
  });
}

function replaceArmholeSection(
  rows: readonly SleevelessPatternDisplayRow[],
  blocks: readonly SleevelessPatternDisplayRow[],
): SleevelessPatternDisplayRow[] {
  const out: SleevelessPatternDisplayRow[] = [];
  let inArmhole = false;
  let inserted = false;
  for (const row of rows) {
    if (row.kind === "section" && row.title === "ARMHOLE") {
      inArmhole = true;
      out.push(row);
      if (!inserted) {
        out.push(...blocks);
        inserted = true;
      }
      continue;
    }
    if (inArmhole) {
      if (row.kind === "section") {
        inArmhole = false;
        out.push(row);
      }
      continue;
    }
    out.push(row);
  }
  return out;
}

function stripSleevelessArmholeProse(
  rows: readonly SleevelessPatternDisplayRow[],
): SleevelessPatternDisplayRow[] {
  const out: SleevelessPatternDisplayRow[] = [];
  let inArmhole = false;
  for (const row of rows) {
    if (row.kind === "section") {
      inArmhole = row.title === "ARMHOLE";
      out.push(row);
      continue;
    }
    // The replaced armhole section owns its decrease wording, including "every other row".
    if (inArmhole || row.kind !== "block") {
      out.push(row);
      continue;
    }
    const source = row.paragraphs ?? [];
    const paragraphs = source.filter((paragraph) => !SLEEVELESS_ARMHOLE_PROSE.test(paragraph));
    if (paragraphs.length === source.length) {
      out.push(row);
      continue;
    }
    if (paragraphs.length === 0) {
      out.push({ ...row, paragraphs: ["Follow the checklist below for the exact row-by-row sequence."] });
      continue;
    }
    out.push({ ...row, paragraphs });
  }
  return out;
}

function shapingEndLocalRc(plan: SetInArmholePlan): number {
  return plan.matchedBindOffRows + plan.decreaseRows;
}

function stitchesAfterSetInShaping(start: number, plan: SetInArmholePlan, edge: "both" | "one"): number {
  const perEdge = plan.matchedBindOffStitchesEachSide + plan.decreaseStitchesEachSide;
  return Math.max(0, edge === "one" ? start - perEdge : start - perEdge * 2);
}

function knitEvenBridgeBlock(fromRc: number, untilRc: number, stitches: number): SetInArmholeDisplayBlock | null {
  const rows = untilRc - fromRc;
  if (rows <= 0) return null;
  const knit = rows === 1 ? "Knit 1 row even." : `Knit ${rows} rows even.`;
  const noun = stitches === 1 ? "stitch" : "stitches";
  return {
    rc: fromRc,
    paragraphs: [knit],
    stitchCount: stitches,
    plainText: `${formatRcColon(fromRc)} ${knit} ${stitches} ${noun} remain.`,
  };
}

function armholeBlocksForPiece(
  plan: SetInArmholePlan,
  stitches: number,
  edge: "both" | "one",
  necklineLocalRc: number | null,
  handoff: { timing: ReturnType<typeof resolveFrontVNeckShapingTimingCase>; neckline: "round" | "v-neck"; cardigan: boolean } | null,
): SetInArmholeDisplayBlock[] {
  const stopBefore =
    handoff && necklineLocalRc !== null && handoff.timing !== "after-armhole"
      ? necklineLocalRc
      : undefined;
  let blocks =
    edge === "one"
      ? setInOneEdgeArmholeInstructionBlocks(plan, stitches, stopBefore)
      : setInArmholeInstructionBlocks(
          {
            bindOffStitchesEachSide: plan.initialBindOffStitchesEachSide,
            stairStepBindOffsEachSide: plan.stairStepBindOffsEachSide,
            decreaseStitchesEachSide: plan.decreaseStitchesEachSide,
            decreaseRows: plan.decreaseRows,
          },
          stitches,
          stopBefore,
        );
  if (handoff && handoff.timing === "before-armhole") {
    blocks = blocks.filter((block) => {
      if (block.rowCounterReset || block.rc !== undefined) return false;
      const text = `${block.plainText}\n${block.paragraphs.join("\n")}`;
      return !/reset row counter/i.test(text) && !/armhole reset/i.test(text);
    });
  }
  if (handoff && handoff.timing !== "after-armhole") {
    return [
      ...blocks,
      ...coordinatedShapingHandoffLines(handoff).map((line) => ({
        paragraphs: [line],
        plainText: line,
      })),
    ];
  }
  const bridge = knitEvenBridgeBlock(
    shapingEndLocalRc(plan),
    necklineLocalRc ?? shapingEndLocalRc(plan),
    stitchesAfterSetInShaping(stitches, plan, edge),
  );
  return bridge ? [...blocks, bridge] : blocks;
}

function styleSentence(patternData: Record<string, unknown>): string {
  const garment = isSleevelessCardiganGarmentStyle(patternData) ? "cardigan" : "pullover";
  const neck = isSleevelessVNeckChoice(patternData) ? "V-neck" : "round neckline";
  return `Set-in sleeve sweater, ${garment}, ${neck}. Sleeves are knitted cuff-up.`;
}

function patternWithoutCenterSeams(patternData: Record<string, unknown>): Record<string, unknown> {
  const style = { ...section(patternData.style) };
  delete style.centerSeams;
  return { ...patternData, style };
}

function withCardiganHalfStyle(patternData: Record<string, unknown>, neckline?: "round"): Record<string, unknown> {
  const style = { ...section(patternData.style), garmentStyle: "cardigan", frontStyle: "open" };
  delete style.centerSeams;
  if (neckline) style.neckline = neckline;
  return { ...patternData, style };
}

function withBackNeckDepthOnFront(patternData: Record<string, unknown>): Record<string, unknown> {
  const next = withCardiganHalfStyle(patternData, "round");
  const fit = { ...section(next.fit) };
  const measurements = { ...section(fit.selectedMeasurements) };
  const backDepth = resolveEffectiveBackNeckDepthInches(patternData);
  if (backDepth !== undefined) {
    measurements.front_neck_depth = backDepth;
    measurements.frontNeckDepth = backDepth;
  }
  fit.selectedMeasurements = measurements;
  return { ...next, fit };
}

function needleCapacityFor(
  result: SetInSleevePatternResult,
  patternData: Record<string, unknown>,
  centerSeamsAccepted: boolean,
): CenterSeamCapacity {
  const cardigan = isSleevelessCardiganGarmentStyle(patternData);
  return assessSetInSleeveNeedleCapacity({
    availableNeedles: positive(section(patternData.yarnGaugeMachine).availableNeedles) ?? null,
    cardigan,
    centerSeamsAccepted,
    backHem: result.debug.hemCastOnStitches ?? 0,
    backBust: Math.max(result.debug.bustBodyStitches ?? 0, result.debug.backStitches ?? 0),
    cardiganFrontHem: result.debug.cardiganHalfLeftCastOnSts,
    cardiganFrontBust: result.debug.cardiganHalfLeftBustBodySts,
    sleeveNeedles: result.sleeveCap?.sleeve.upperArmStitches ?? 0,
  });
}

function maxBlockStitches(rows: readonly SleevelessPatternDisplayRow[]): number {
  let max = 0;
  for (const row of rows) {
    if (row.kind === "block" && typeof row.stitchCount === "number") {
      max = Math.max(max, row.stitchCount);
    }
  }
  return max;
}

function labelHalfRows(
  rows: readonly SleevelessPatternDisplayRow[],
  piece: "front" | "back",
  side: "left" | "right",
): SleevelessPatternDisplayRow[] {
  const title = `${side === "left" ? "LEFT" : "RIGHT"} ${piece === "back" ? "BACK" : "FRONT"}`;
  const fromPhrase = side === "left" ? "the left front" : "the right front";
  const toPhrase = piece === "back" ? (side === "left" ? "the left back" : "the right back") : fromPhrase;
  const labeled = rows
    .filter((row) => row.kind !== "piece")
    .map((row) => {
      if (piece === "back" && row.kind === "section" && row.title.includes("FRONT")) {
        return { ...row, title: row.title.replaceAll("FRONT", "BACK") };
      }
      if (row.kind !== "block" || !row.paragraphs || piece !== "back") return row;
      return {
        ...row,
        paragraphs: row.paragraphs.map((paragraph) =>
          paragraph
            .replaceAll(fromPhrase, toPhrase)
            .replaceAll("center-front", "center-back")
            .replaceAll("center front", "center back")
            .replaceAll("front neckline", "back neckline"),
        ),
      };
    });
  return [{ kind: "section", title }, ...labeled];
}

function withoutChartMount(rows: readonly SleevelessPatternDisplayRow[]): SleevelessPatternDisplayRow[] {
  return rows.filter((row) => row.kind !== "neckShoulderChartTableMount");
}

function vNeckHalfLines(
  half: SetInSleevePatternResult,
  side: "left" | "right",
  fullNeckStitches: number,
): string[] {
  const after = half.debug.cardiganHalfLeftStitchesAfterArmhole ?? 0;
  const remove = Math.max(1, Math.round(fullNeckStitches / 2)) + 1;
  const start = Math.floor(half.debug.frontNecklineStartRC ?? 0);
  const depth = Math.max(1, Math.floor(half.debug.frontNeckDepthRows ?? 1));
  const plan = buildVNecklinePlan({
    stitchesAfterArmhole: after,
    neckWidthSts: remove * 2,
    neckDepthRows: depth,
    side,
    firstShapingRow: start,
    lastShapingRow: start + depth - 1,
  });
  const rows = plan.decreaseRows;
  const shoulder = Math.max(0, after - remove);
  return [
    "Decrease at the center edge only. The armhole edge is the shoulder.",
    "The center edge includes 1 seam stitch. The first center-edge decrease removes that seam stitch.",
    rows.length > 0
      ? `Decrease 1 stitch at the center edge on row ${rows.join(", ")}.`
      : "The V-neck decreases could not be scheduled for this half.",
    shoulder > 0
      ? `${shoulder} shoulder stitches remain at the armhole edge. Bind them off on the armhole edge.`
      : "No shoulder stitches remain after the center-edge decreases.",
    ...plan.warnings,
  ];
}

function replaceNecklineSection(
  rows: readonly SleevelessPatternDisplayRow[],
  lines: readonly string[],
): SleevelessPatternDisplayRow[] {
  const out: SleevelessPatternDisplayRow[] = [];
  let skipping = false;
  let inserted = false;
  for (const row of rows) {
    if (row.kind === "section" && /NECKLINE/i.test(row.title)) {
      skipping = true;
      if (!inserted) {
        out.push(row, { kind: "block", paragraphs: [...lines] });
        inserted = true;
      }
      continue;
    }
    if (skipping) {
      if (row.kind === "section") {
        skipping = false;
        out.push(row);
      }
      continue;
    }
    out.push(row);
  }
  if (!inserted) {
    out.push({ kind: "section", title: "NECKLINE" }, { kind: "block", paragraphs: [...lines] });
  }
  return out;
}

function prepareCenterSeamHalf(
  half: SetInSleevePatternResult,
  piece: "front" | "back",
  side: "left" | "right",
  vNeck: boolean,
  fullNeckStitches: number,
): SleevelessPatternDisplayRow[] {
  let rows = labelHalfRows(half.frontDisplayRows, piece, side);
  if (side === "right" || vNeck) rows = withoutChartMount(rows);
  if (vNeck && piece === "front") {
    rows = replaceNecklineSection(rows, vNeckHalfLines(half, side, fullNeckStitches));
  }
  return rows;
}

function generateSetInSleeveWithCenterSeams(patternData: Record<string, unknown>): SetInSleevePatternResult {
  const base = generateSetInSleevePattern(patternWithoutCenterSeams(patternData));
  const cardigan = isSleevelessCardiganGarmentStyle(patternData);
  const vNeck = isSleevelessVNeckChoice(patternData);
  const capacity = needleCapacityFor(base, patternData, true);
  const blocked = (reason: string): SetInSleevePatternResult => ({
    ...base,
    displayRows: linesToBlocks([reason]),
    frontDisplayRows: [],
    sleeveDisplayRows: [],
    overviewRows: linesToBlocks([reason]),
    needleCapacity: { ...capacity, shouldBlock: true, seamsFit: false, offerSeams: false, seamBlockReason: reason },
    centerSeams: { applied: false, splitFront: false, splitBack: false },
  });
  if (base.sleeveSaveBlocker) {
    return blocked(base.sleeveSaveBlocker);
  }
  if (!capacity.seamsFit) {
    return blocked(capacity.seamBlockReason ?? "Added center seams still do not fit on this machine.");
  }

  const fullNeck = base.debug.necklineStitches ?? 0;
  const backPattern = withBackNeckDepthOnFront(patternData);
  const leftBack = generateSetInSleevePattern(backPattern, { halfPiece: { side: "left", seamStitch: true } });
  const rightBack = generateSetInSleevePattern(backPattern, { halfPiece: { side: "right", seamStitch: true } });
  const backRows = [
    ...prepareCenterSeamHalf(leftBack, "back", "left", false, fullNeck),
    ...prepareCenterSeamHalf(rightBack, "back", "right", false, fullNeck),
  ];

  let frontRows = base.frontDisplayRows;
  let frontChart = base.frontNeckShoulderShapingChart;
  let frontTimeline = base.frontNeckShoulderTimeline;
  let leftFront: SetInSleevePatternResult | null = null;
  if (!cardigan) {
    const frontPattern = withCardiganHalfStyle(patternData);
    leftFront = generateSetInSleevePattern(frontPattern, { halfPiece: { side: "left", seamStitch: true } });
    const rightFront = generateSetInSleevePattern(frontPattern, { halfPiece: { side: "right", seamStitch: true } });
    frontRows = [
      ...prepareCenterSeamHalf(leftFront, "front", "left", vNeck, fullNeck),
      ...prepareCenterSeamHalf(rightFront, "front", "right", vNeck, fullNeck),
    ];
    frontChart = leftFront.frontNeckShoulderShapingChart;
    frontTimeline = leftFront.frontNeckShoulderTimeline;
  }

  const available = capacity.availableNeedles;
  if (available !== null) {
    const piecePeaks = [
      { label: "Left back", needles: maxBlockStitches(backRows) },
      { label: "Right back", needles: maxBlockStitches(backRows.slice(backRows.findIndex((row, index) => index > 0 && row.kind === "section" && row.title === "RIGHT BACK"))) },
      { label: "Front", needles: maxBlockStitches(frontRows) },
      { label: "Sleeve", needles: maxBlockStitches(base.sleeveDisplayRows) },
    ];
    const over = piecePeaks.filter((piece) => piece.needles > available);
    if (over.length > 0) {
      const list = over.map((piece) => `${piece.label} requires ${piece.needles} needles`).join("; ");
      return blocked(`${list}. This machine has ${available} available, so this pattern is not rendered.`);
    }
  }

  const overviewRows = base.overviewRows.map((row) => {
    if (row.kind !== "block" || !row.paragraphs) return row;
    return {
      ...row,
      paragraphs: row.paragraphs.filter((paragraph) => !paragraph.includes("Panel seams are not added")),
    };
  });
  overviewRows.push({
    kind: "block",
    paragraphs: [
      cardigan
        ? "The back is knitted as a left half and a right half with one seam stitch on each center edge. The fronts stay as written."
        : "The front and the back are each knitted as a left half and a right half with one seam stitch on each center edge.",
    ],
  });

  return {
    ...base,
    displayRows: backRows,
    frontDisplayRows: frontRows,
    neckShoulderShapingChart: leftBack.frontNeckShoulderShapingChart,
    frontNeckShoulderShapingChart: frontChart,
    backNeckShoulderTimeline: leftBack.frontNeckShoulderTimeline,
    frontNeckShoulderTimeline: frontTimeline,
    overviewRows,
    needleCapacity: capacity,
    centerSeams: {
      applied: true,
      splitFront: !cardigan,
      splitBack: true,
      backHem: leftBack.debug.cardiganHalfLeftCastOnSts,
      backBust: leftBack.debug.cardiganHalfLeftBustBodySts,
      backAfter: leftBack.debug.cardiganHalfLeftStitchesAfterArmhole,
      ...(!cardigan && leftFront
        ? {
            frontHem: leftFront.debug.cardiganHalfLeftCastOnSts,
            frontBust: leftFront.debug.cardiganHalfLeftBustBodySts,
            frontAfter: leftFront.debug.cardiganHalfLeftStitchesAfterArmhole,
          }
        : {}),
    },
  };
}

export function generateSetInSleevePattern(
  patternData: Record<string, unknown>,
  options?: { halfPiece?: { side: "left" | "right"; seamStitch: boolean } },
): SetInSleevePatternResult {
  if (readCenterSeams(section(patternData.style)) && !options?.halfPiece) {
    return generateSetInSleeveWithCenterSeams(patternData);
  }
  const style = withSetInSleeveConstructionAuthored(section(patternData.style), section(patternData.style).sleeveLength);
  const stamped: Record<string, unknown> = { ...patternData, style };
  const body = generateSleevelessBackPattern(stamped, {
    useSetInArmhole: true,
    ...(options?.halfPiece
      ? {
          cardiganHalfSide: options.halfPiece.side,
          centerSeamStitch: options.halfPiece.seamStitch,
        }
      : {}),
  });
  const warnings = [...body.warnings];
  const plan = body.setInArmholePlan ?? null;
  const debug = body.debug;
  const cardigan = isSleevelessCardiganGarmentStyle(stamped);
  const vNeck = isSleevelessVNeckChoice(stamped);
  const overlap = debug.frontArmholeNecklineOverlap;
  const frontTiming = overlap ? resolveFrontVNeckShapingTimingCase(overlap) : null;
  const backNeckLocal =
    debug.backNecklineStartLocalRC !== undefined ? Math.floor(debug.backNecklineStartLocalRC) : null;
  const frontNeckLocal =
    debug.frontNecklineStartLocalRC !== undefined ? Math.floor(debug.frontNecklineStartLocalRC) : null;
  const backHandoff =
    plan && backNeckLocal !== null && backNeckLocal < shapingEndLocalRc(plan)
      ? {
          timing: (backNeckLocal < 0
            ? "before-armhole"
            : backNeckLocal === 0
              ? "with-armhole"
              : "during-armhole") as "before-armhole" | "with-armhole" | "during-armhole",
          neckline: "round" as const,
          cardigan: false,
        }
      : null;

  const garmentArmholeRc =
    typeof debug.armholeStartRow === "number" && Number.isFinite(debug.armholeStartRow)
      ? Math.max(0, Math.floor(debug.armholeStartRow))
      : undefined;
  const backArmholeBlocks = plan
    ? armholeBlocksToDisplayRows(
        armholeBlocksForPiece(
          plan,
          debug.bustBodyStitches && debug.bustBodyStitches > 0
            ? debug.bustBodyStitches
            : debug.backStitches,
          "both",
          backNeckLocal,
          backHandoff,
        ),
        garmentArmholeRc,
        true,
      )
    : linesToBlocks([
        warnings.find((warning) => /armhole/i.test(warning)) ??
          "The set-in armhole could not be calculated from these measurements.",
      ]);

  const frontStart =
    cardigan && debug.cardiganHalfLeftBustBodySts && debug.cardiganHalfLeftBustBodySts > 0
      ? debug.cardiganHalfLeftBustBodySts
      : debug.bustBodyStitches && debug.bustBodyStitches > 0
        ? debug.bustBodyStitches
        : debug.backStitches;
  const frontArmholeBlocks = plan
    ? armholeBlocksToDisplayRows(
        armholeBlocksForPiece(
          plan,
          frontStart,
          cardigan ? "one" : "both",
          frontNeckLocal,
          frontTiming && frontTiming !== "after-armhole"
            ? { timing: frontTiming, neckline: vNeck ? "v-neck" : "round", cardigan }
            : null,
        ),
        garmentArmholeRc,
        false,
      )
    : backArmholeBlocks;

  const displayRows = replaceArmholeSection(body.displayRows, backArmholeBlocks);
  const frontDisplayRows = withSetInVNeckPulloverOrientationTip(
    stripSleevelessArmholeProse(replaceArmholeSection(body.frontDisplayRows, frontArmholeBlocks)),
    stamped,
  );

  const fitSection = section(stamped.fit);
  const measurements = section(fitSection.selectedMeasurements);
  const chartAudience = audienceOf(stamped);
  const fit = fitOf(stamped);
  const bodyUpperArm = positive(measurements.upper_arm);
  const userEdited = readEffectiveDropShoulderUserEditedSleeveFields(fitSection);
  const sleeveInches =
    bodyUpperArm !== undefined
      ? resolveDropShoulderSleeveInches({
          overrides: measurementOverrideStrings(fitSection),
          chartRow: {
            upper_arm: bodyUpperArm,
            wrist: positive(measurements.wrist),
            sleeve_length: positive(measurements.sleeve_length),
          },
          fitPreference: fit,
          chartAudience,
          bodyShape: typeof style.bodyShape === "string" ? style.bodyShape : "straight",
          sleeveLengthChoice: normalizeDropShoulderSleeveLengthChoice(style.sleeveLength),
          userEdited,
        })
      : {};
  const cap =
    debug.finishedBustChest &&
    debug.shoulderWidthInches &&
    debug.armholeDepth &&
    bodyUpperArm &&
    debug.stitchesPerInch > 0 &&
    debug.rowsPerInch > 0
      ? calculateSetInSleeveCap({
          finishedBustInches: debug.finishedBustChest,
          shoulderWidthInches: debug.shoulderWidthInches,
          armholeDepthInches: debug.armholeDepth,
          bodyUpperArmInches: bodyUpperArm,
          ...(userEdited.upperArm === true && sleeveInches.upperArmIn
            ? { finishedUpperArmInches: sleeveInches.upperArmIn }
            : {}),
          chartAudience,
          fit,
          stitchesPerInch: debug.stitchesPerInch,
          rowsPerInch: debug.rowsPerInch,
        })
      : null;

  let sleeveCap: SetInSleeveCapSuccess | null = null;
  let sleevePiece: DropShoulderSleevePieceNumbers | null = null;
  let sleeveFinishedInches: SetInSleevePatternResult["sleeveFinishedInches"] = null;
  let sleeveDisplayRows: SleevelessPatternDisplayRow[] = [];
  let sleeveSaveBlocker: string | null = plan
    ? null
    : (warnings.find((warning) => /armhole/i.test(warning)) ??
      "The set-in armhole could not be calculated from these measurements.");
  if (!cap || !cap.ok) {
    const message = cap && !cap.ok ? cap.message : "Sleeve cap could not be calculated.";
    warnings.push(message);
    sleeveSaveBlocker = message;
    sleeveDisplayRows = linesToBlocks([message]);
  } else {
    sleeveCap = cap;
    if (plan) {
      const sameBindOff =
        plan.initialBindOffStitchesEachSide === cap.armhole.bindOffStitchesEachSide &&
        plan.stairStepBindOffsEachSide.join(",") === cap.armhole.stairStepBindOffsEachSide.join(",") &&
        plan.decreaseStitchesEachSide === cap.armhole.decreaseStitchesEachSide;
      if (!sameBindOff) {
        warnings.push(
          "The sleeve-cap bind-off does not match the body armhole. Check bust, shoulder, and upper-arm measurements before knitting.",
        );
      }
    }
    const cuffInches = getDefaultCuffLengthInches(chartAudience);
    sleeveFinishedInches = {
      ...(typeof sleeveInches.wristIn === "number" ? { wristInches: sleeveInches.wristIn } : {}),
      cuffDepthInches: cuffInches,
      ...(typeof sleeveInches.sleeveLengthIn === "number"
        ? { sleeveLengthInches: sleeveInches.sleeveLengthIn }
        : {}),
    };
    sleevePiece = calculateDropShoulderSleevePieceNumbers({
      finishedUpperArmInches: cap.sleeve.finishedUpperArmInches,
      finishedWristInches: sleeveInches.wristIn,
      sleeveLengthInches: sleeveInches.sleeveLengthIn,
      stitchesPerInch: debug.stitchesPerInch,
      rowsPerInch: debug.rowsPerInch,
      cuffDepthInches: cuffInches,
    });
    const piece = sleevePiece;
    if (piece.topSts !== cap.sleeve.upperArmStitches) {
      const message = "Sleeve stitches at the upper arm do not match the sleeve-cap starting stitches.";
      warnings.push(message);
      sleeveSaveBlocker = message;
    }
    const taperProblem = setInSleeveTaperProblem({
      topStitches: piece.topSts,
      cuffStitches: piece.wristSts,
      sleeveBodyRows: piece.sleeveBodyRows,
    });
    if (taperProblem) {
      warnings.push(taperProblem);
      sleeveSaveBlocker = taperProblem;
      sleeveDisplayRows = linesToBlocks([taperProblem]);
    } else if (sleeveSaveBlocker) {
      sleeveDisplayRows = linesToBlocks([sleeveSaveBlocker]);
    } else {
      sleeveDisplayRows = buildSetInCuffUpSleevePresentation({
        wristStitches: piece.wristSts,
        upperArmStitches: piece.topSts,
        cuffRows: piece.cuffRows,
        cuffInches,
        rowsCuffToUpperArm: piece.sleeveBodyRows,
        cap,
      }).displayRows;
    }
  }

  const available = positive(section(stamped.yarnGaugeMachine).availableNeedles);
  const bodyNeedles = Math.max(debug.hemCastOnStitches ?? 0, debug.bustBodyStitches ?? 0, debug.backStitches ?? 0);
  const sleeveNeedles = sleeveCap?.sleeve.upperArmStitches ?? 0;
  const required = Math.max(bodyNeedles, sleeveNeedles);
  const needleLines =
    available !== undefined && required > available
      ? [
          `This pattern needs ${required} needles at the widest piece. This machine has ${available}. The instructions are still the full piece. Panel seams are not added.`,
        ]
      : [];

  const overviewRows: SleevelessPatternDisplayRow[] = linesToBlocks([
    styleSentence(stamped),
    `Finished bust ${debug.finishedBustChest ?? "—"} in. Hip ${positive(measurements.finished_hip) ?? debug.finishedBustChest ?? "—"} in. Length ${debug.backNeckToHem ?? "—"} in.`,
    `Shoulder width ${debug.shoulderWidthInches ?? "—"} in. Armhole depth ${debug.armholeDepth ?? "—"} in.`,
    sleeveCap
      ? `Finished upper arm ${sleeveCap.sleeve.finishedUpperArmInches.toFixed(2)} in. Sleeve-cap height ${sleeveCap.totals.capHeightInches.toFixed(2)} in is separate from the cuff-to-upper-arm length.`
      : "Sleeve measurements could not be finished.",
    plan ? `Armhole method: ${plan.method}. The same armhole plan is used on the front and the back.` : "",
    ...needleLines,
  ]);

  const needleCapacity = needleCapacityFor(
    {
      ...body,
      isSetInSleeve: true,
      sleeveDisplayRows,
      overviewRows: [],
      sleeveCap,
      sleevePiece,
      sleeveFinishedInches,
      sleeveSaveBlocker,
    },
    stamped,
    false,
  );

  return {
    ...body,
    warnings,
    displayRows: rewriteSetInDisplayRows(displayRows),
    frontDisplayRows: rewriteSetInDisplayRows(frontDisplayRows),
    isSetInSleeve: true,
    sleeveDisplayRows: rewriteSetInDisplayRows(sleeveDisplayRows),
    overviewRows,
    sleeveCap,
    sleevePiece,
    sleeveFinishedInches,
    sleeveSaveBlocker,
    needleCapacity,
  };
}
