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
import { type DropShoulderSleevePieceNumbers } from "./dropShoulderSleevePieceNumbers";
import {
  resolveDropShoulderSleeveInches,
} from "./dropShoulderSleeveMeasurementOverrides";
import { readEffectiveDropShoulderUserEditedSleeveFields } from "./dropShoulderUserEditedSleeveFields";
import {
  coordinatedShapingHandoffLines,
  resolveFrontVNeckShapingTimingCase,
} from "./frontArmholeNecklineComposition";
import { normalizeParentheticalRcLists } from "./parentheticalRcList";
import { resolveCuffUpSweaterSleevePiece } from "./legoBlocks/sweaterSleeveCuff";
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
import { buildPatternQuickTipInnerHtml } from "./patternQuickTip";
import {
  SWEATER_BODY_HEM_TECHNIQUE_TIP_ID,
  sweaterBodyHemChoiceDisplay,
  sweaterBodyHemTechniqueTipFields,
} from "./sweaterBodyHemInstructions";
import { withSetInSleeveConstructionAuthored } from "./setInSleeveConstructionIdentity";
import {
  attachSetInNecklinePrintShaping,
  setInBackPrintShapingOptions,
  setInFrontPrintShapingOptions,
  setInNecklinePrintShapingParagraphs,
} from "./setInSleevePrintShaping";
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
    backRightHem?: number;
    backRightBust?: number;
    backRightAfter?: number;
    frontHem?: number;
    frontBust?: number;
    frontAfter?: number;
    frontRightHem?: number;
    frontRightBust?: number;
    frontRightAfter?: number;
  };
  /**
   * Half results used to draw the retained diagrams. Present only when seams are applied.
   * The right back is not drawn again when its counts and rows match the left back.
   */
  centerSeamPieces?: {
    leftBack: SetInSleevePatternResult;
    rightBack: SetInSleevePatternResult;
    backPatternData: Record<string, unknown>;
    leftFront?: SetInSleevePatternResult;
    rightFront?: SetInSleevePatternResult;
    frontPatternData?: Record<string, unknown>;
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
  const endRc = fromRc + rows;
  const knit = rows === 1 ? `Knit 1 row even to ${formatRcColon(endRc)}.` : `Knit ${rows} rows even to ${formatRcColon(endRc)}.`;
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
  const overrides = { ...section(fit.cbMeasurementOverrides) };
  const backDepth = resolveEffectiveBackNeckDepthInches(patternData);
  if (backDepth !== undefined) {
    measurements.front_neck_depth = backDepth;
    measurements.frontNeckDepth = backDepth;
    // The neck-depth editor override replaces front neck depth. A back half must
    // use the back neck depth instead of that front override.
    delete overrides.neckDepth;
  }
  fit.selectedMeasurements = measurements;
  fit.cbMeasurementOverrides = overrides;
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
  const pieceName = `${side === "left" ? "Left" : "Right"} ${piece === "back" ? "back" : "front"}`;
  const fromPhrase = side === "left" ? "the left front" : "the right front";
  const toPhrase = piece === "back" ? (side === "left" ? "the left back" : "the right back") : fromPhrase;
  const chartPiece = `${side}-${piece}` as const;
  const labeled = rows
    .filter((row) => row.kind !== "piece")
    .map((row) => {
      if (row.kind === "neckShoulderChartTableMount") {
        return { ...row, chartPiece };
      }
      if (piece === "back" && row.kind === "section" && row.title.includes("FRONT")) {
        return { ...row, title: row.title.replaceAll("FRONT", "BACK") };
      }
      if (row.kind !== "block") return row;
      const withBodyTitle =
        row.bodyShapingChartRows && row.bodyShapingChartRows.length > 0
          ? {
              ...row,
              bodyShapingChartTitle: `${pieceName} body shaping`,
              bodyShapingChartId: `set-in-${side}-${piece}-body-shaping`,
            }
          : row;
      if (!withBodyTitle.paragraphs || piece !== "back") return withBodyTitle;
      return {
        ...withBodyTitle,
        paragraphs: withBodyTitle.paragraphs.map((paragraph) =>
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

/** Pattern Tip for a back that is split so each half fits on the needle bed. */
export const SET_IN_SPLIT_BACK_TIP_ID = "set-in-split-back-two-pieces";
export const SET_IN_SPLIT_BACK_TIP_TITLE = "Knitting the Back in Two Pieces.";
export const SET_IN_RIGHT_BACK_REVERSE_TITLE = "Right Back: Reverse the Shaping";
export const SET_IN_LEFT_FRONT_REVERSE_TITLE = "Left Front: Reverse the Shaping";

const SPLIT_BACK_RESET_CUE = "Reset the row counter. Use Armhole RC from here.";
const SPLIT_BACK_BODY_CUE =
  "Shape only at the armhole edge. Keep the center seam stitch through the body and armhole shaping.";

function normalizeHalfInstructionText(text: string): string {
  return text
    .replace(/\bleft\b/gi, "side")
    .replace(/\bright\b/gi, "side")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * True when the two halves repeat the same counts and rows, with the edges reversed.
 * Bust-dart hold steps are part of the signature, so a note can reuse them only when
 * the hold counts and row numbers match.
 */
function splitHalvesMatch(
  writtenRows: readonly SleevelessPatternDisplayRow[],
  otherRows: readonly SleevelessPatternDisplayRow[],
): boolean {
  const signature = (rows: readonly SleevelessPatternDisplayRow[]) =>
    rows
      .map((row) => {
        if (row.kind === "neckShoulderChartTableMount") return "";
        if (row.kind === "section") return `s:${row.title.replace(/^(LEFT|RIGHT)\s+/i, "")}`;
        if (row.kind === "bustDartCustomization") {
          const text = normalizeHalfInstructionText(row.instructionParagraphs.join("\n"));
          return `d:${row.active ? "1" : "0"}:${row.dartStartGarmentRc}:${text}`;
        }
        if (row.kind !== "block") return row.kind;
        const text = normalizeHalfInstructionText(
          [...(row.paragraphs ?? []), ...(row.trustedParagraphs ?? [])].join("\n"),
        );
        return `b:${row.rc ?? ""}:${row.stitchCount ?? ""}:${row.rowCounterReset === true ? "1" : "0"}:${row.tipId ?? ""}:${text}`;
      })
      .filter((part) => part.length > 0)
      .join("\n");
  return signature(writtenRows) === signature(otherRows);
}

function halfHasActiveBustDart(rows: readonly SleevelessPatternDisplayRow[]): boolean {
  return rows.some(
    (row) =>
      row.kind === "bustDartCustomization" &&
      row.active &&
      row.instructionParagraphs.some((line) => /needles in hold/i.test(line)),
  );
}

const RIGHT_FRONT_MIRROR_RE = /Work the RIGHT FRONT to match/i;

/** Each center-seam half is its own piece. Drop the full-cardigan "also work the right front" line. */
function withoutRightFrontMirror(
  rows: readonly SleevelessPatternDisplayRow[],
): SleevelessPatternDisplayRow[] {
  const out: SleevelessPatternDisplayRow[] = [];
  for (const row of rows) {
    if (row.kind !== "block" || !row.paragraphs?.some((paragraph) => RIGHT_FRONT_MIRROR_RE.test(paragraph))) {
      out.push(row);
      continue;
    }
    const paragraphs = row.paragraphs.filter((paragraph) => !RIGHT_FRONT_MIRROR_RE.test(paragraph));
    const hasOther =
      paragraphs.length > 0 ||
      (row.trustedParagraphs?.length ?? 0) > 0 ||
      Boolean(row.tipHtml) ||
      row.rc !== undefined ||
      row.stitchCount !== undefined;
    if (!hasOther) continue;
    out.push({ ...row, paragraphs });
  }
  return out;
}

/**
 * The right back is not written out again when it matches the left back.
 * This stays an ordinary instruction, so Hide Pattern Tips does not remove it.
 */
function rightBackReverseRows(): SleevelessPatternDisplayRow[] {
  return [
    { kind: "section", title: SET_IN_RIGHT_BACK_REVERSE_TITLE },
    {
      kind: "block",
      paragraphs: [
        "The right back uses the same stitch counts and row numbers as the left back.",
        "The center seam edge goes on the left and the armhole edge goes on the right.",
        "Work body shaping at the armhole edge.",
        "Bind off the armhole edge with the carriage on the right.",
        "At the start of the neckline, work the center edge with the carriage on the left, including the seam stitch. Use the same hold, bind-off, or decrease as the left back.",
        "Work the neckline and shoulder shaping with the same row numbers as the left back. Keep neckline shaping on the center edge and shoulder shaping on the armhole edge, with the carriage on the opposite side.",
        "Swap Left and Right. Carriage on the right in the left back is carriage on the left here. Carriage on the left in the left back is carriage on the right here.",
      ],
    },
  ];
}

/**
 * The left front is not written out again when it matches the right front.
 * This stays an ordinary instruction, so Hide Pattern Tips does not remove it.
 */
function leftFrontReverseRows(includeBustDart: boolean): SleevelessPatternDisplayRow[] {
  const paragraphs = [
    "The left front uses the same stitch counts and row numbers as the right front.",
    "The center seam edge goes on the right and the armhole edge goes on the left.",
    "Work body shaping at the armhole edge.",
    "Bind off the armhole edge with the carriage on the left.",
    "At the start of the neckline, work the center edge with the carriage on the right, including the seam stitch. Use the same hold, bind-off, or decrease as the right front.",
    "Work the neckline and shoulder shaping with the same row numbers as the right front. Keep neckline shaping on the center edge and shoulder shaping on the armhole edge, with the carriage on the opposite side.",
    "Swap Left and Right. Carriage on the right in the right front is carriage on the left here. Carriage on the left in the right front is carriage on the right here.",
  ];
  if (includeBustDart) {
    paragraphs.push(
      "Work the bust dart with the same hold counts and row numbers. Place the needles in hold from the armhole edge toward the center, not from the center seam edge.",
    );
  }
  return [
    { kind: "section", title: SET_IN_LEFT_FRONT_REVERSE_TITLE },
    { kind: "block", paragraphs },
  ];
}

function splitBackOverviewTipRow(): SleevelessPatternDisplayRow {
  return {
    kind: "block",
    paragraphs: [],
    tipHtml: buildPatternQuickTipInnerHtml({
      summaryLabel: SET_IN_SPLIT_BACK_TIP_TITLE,
      bodyHtml:
        "<p>This piece is half the body width. One seam stitch is included on the center edge. It stays on that edge through the body and armhole, and the first center neckline action includes it. Hold leaves it on the machine. A bind-off takes it off the needle. A decrease moves it in.</p>" +
        "<p>Body shaping is worked only on the armhole edge.</p>",
    }),
    tipHtmlIsFull: true,
    tipPresentation: "quick-tip",
    tipId: SET_IN_SPLIT_BACK_TIP_ID,
  };
}

function isSplitBackIntroParagraph(paragraph: string): boolean {
  return (
    paragraph.includes("half the body width") ||
    paragraph.includes("Work the piece from the hem up") ||
    paragraph.includes("After the armhole reset, use Armhole RC")
  );
}

function splitBackStepCues(side: "left" | "right"): {
  castOn: string;
  armhole: string;
  neck: string;
} {
  const pieceName = side === "left" ? "left back" : "right back";
  const centerBed = side === "left" ? "right" : "left";
  const armholeBed = side === "left" ? "left" : "right";
  const armholeCarriage = side === "left" ? "left" : "right";
  const neckCarriage = side === "left" ? "right" : "left";
  return {
    castOn: `The count is for the ${pieceName} only and includes one center seam stitch. Place the center edge on the ${centerBed} side of the needle bed and the armhole edge on the ${armholeBed}.`,
    armhole: `Work with the carriage on the ${armholeCarriage}.`,
    neck: `Work the first center-edge action with the carriage on the ${neckCarriage}, including the seam stitch. A decrease moves the number of stitches named in that row. A bind-off takes stitches off the needle. Hold leaves stitches on the machine.`,
  };
}

function withCue(
  row: Extract<SleevelessPatternDisplayRow, { kind: "block" }>,
  cue: string,
  where: "start" | "end",
): Extract<SleevelessPatternDisplayRow, { kind: "block" }> {
  const paragraphs = [...(row.paragraphs ?? [])];
  if (!paragraphs.includes(cue)) {
    if (where === "start") paragraphs.unshift(cue);
    else paragraphs.push(cue);
  }
  const trusted = row.trustedParagraphs ? [...row.trustedParagraphs] : undefined;
  if (trusted && !trusted.some((line) => line.includes(cue))) {
    if (where === "start") trusted.unshift(cue);
    else trusted.push(cue);
  }
  return {
    ...row,
    paragraphs,
    ...(trusted ? { trustedParagraphs: trusted } : {}),
  };
}

function isSplitBackBodyShapingBlock(
  row: Extract<SleevelessPatternDisplayRow, { kind: "block" }>,
): boolean {
  const plain = row.paragraphs ?? [];
  if (plain.some((paragraph) => /at the armhole edge/i.test(paragraph) && /decrease|increase|shaping/i.test(paragraph))) {
    return true;
  }
  return (row.trustedParagraphs ?? []).some((line) => /a-line shaping|at the armhole edge/i.test(line));
}

/**
 * The long half-back introduction becomes one Pattern Tip. Short edge and carriage
 * cues stay in the cast-on, body, armhole, and neckline steps so they still print
 * when Pattern Tips are hidden.
 */
function applySplitBackInstructionCues(
  rows: readonly SleevelessPatternDisplayRow[],
  side: "left" | "right",
): SleevelessPatternDisplayRow[] {
  const cues = splitBackStepCues(side);
  const out: SleevelessPatternDisplayRow[] = [];
  let section = "";
  let tipPlaced = false;
  let castOnPlaced = false;
  let bodyPlaced = false;
  let bodyFallback = -1;
  let armholePlaced = false;
  let resetPlaced = false;
  let neckPlaced = false;

  const placeBodyFallback = () => {
    if (bodyPlaced || bodyFallback < 0) return;
    const row = out[bodyFallback];
    if (row?.kind === "block") out[bodyFallback] = withCue(row, SPLIT_BACK_BODY_CUE, "end");
    bodyPlaced = true;
    bodyFallback = -1;
  };

  for (const row of rows) {
    if (row.kind === "section") {
      if (section === "BODY" && row.title !== "BODY") placeBodyFallback();
      section = row.title ?? "";
      out.push(row);
      continue;
    }
    if (row.kind !== "block") {
      out.push(row);
      continue;
    }

    const source = row.paragraphs ?? [];
    const intro = source.some(isSplitBackIntroParagraph);
    const paragraphs = source.filter((paragraph) => !isSplitBackIntroParagraph(paragraph));
    if (intro && !tipPlaced) {
      out.push(splitBackOverviewTipRow());
      tipPlaced = true;
    }
    const introOnly =
      intro &&
      paragraphs.length === 0 &&
      !row.rc &&
      row.rowCounterReset !== true &&
      !row.tipHtml &&
      !(row.trustedParagraphs && row.trustedParagraphs.length > 0) &&
      row.stitchCount === undefined;
    if (introOnly) continue;

    let next: Extract<SleevelessPatternDisplayRow, { kind: "block" }> = { ...row, paragraphs };
    if (!castOnPlaced && paragraphs.some((paragraph) => /^Cast on \d+ stitches\b/.test(paragraph))) {
      next = withCue(next, cues.castOn, "end");
      castOnPlaced = true;
    }
    if (section === "BODY" && !bodyPlaced) {
      if (isSplitBackBodyShapingBlock(next)) {
        next = withCue(next, SPLIT_BACK_BODY_CUE, "end");
        bodyPlaced = true;
        bodyFallback = -1;
      } else if (bodyFallback < 0 && (paragraphs.length > 0 || (next.trustedParagraphs?.length ?? 0) > 0)) {
        bodyFallback = out.length;
      }
    }
    if (section === "ARMHOLE" && row.rowCounterReset === true && !resetPlaced) {
      next = withCue(next, SPLIT_BACK_RESET_CUE, "end");
      resetPlaced = true;
    }
    if (
      section === "ARMHOLE" &&
      !armholePlaced &&
      paragraphs.some((paragraph) => /Bind off \d+ .+at the armhole edge/i.test(paragraph))
    ) {
      next = withCue(next, cues.armhole, "end");
      armholePlaced = true;
    }
    if (section.includes("NECKLINE") && !neckPlaced) {
      next = withCue(next, cues.neck, "start");
      neckPlaced = true;
    }
    out.push(next);
  }
  placeBodyFallback();
  if (!tipPlaced) out.unshift(splitBackOverviewTipRow());
  return out;
}

const SET_IN_CAST_ON_METHOD_TIP_IDS = new Set(["sleeveless-cast-on-back", "sleeveless-cast-on-front"]);

function isBackPieceHeading(title: string): boolean {
  return title === "BACK" || title === "LEFT BACK" || title === "RIGHT BACK";
}

function hemInstructionText(row: Extract<SleevelessPatternDisplayRow, { kind: "block" }>): string {
  return [...(row.paragraphs ?? []), ...(row.trustedParagraphs ?? [])].join("\n");
}

function isSetInHemInstructionBlock(row: SleevelessPatternDisplayRow): row is Extract<SleevelessPatternDisplayRow, { kind: "block" }> {
  if (row.kind !== "block") return false;
  if (row.tipId === SWEATER_BODY_HEM_TECHNIQUE_TIP_ID) return true;
  const text = hemInstructionText(row);
  return text.includes("The finished hem is") || text.includes("Finish your hem to match the back");
}

function hemRowsFromBlock(
  row: Extract<SleevelessPatternDisplayRow, { kind: "block" }>,
  fallback: number,
): number {
  const match = hemInstructionText(row).match(/row counter shows RC:\s*0*(\d+)/i);
  if (!match) return fallback;
  const rows = Number(match[1]);
  return Number.isFinite(rows) ? rows : fallback;
}

function withoutCastOnMethodTip(
  row: Extract<SleevelessPatternDisplayRow, { kind: "block" }>,
): Extract<SleevelessPatternDisplayRow, { kind: "block" }> {
  if (!row.tipId || !SET_IN_CAST_ON_METHOD_TIP_IDS.has(row.tipId)) return row;
  const next = { ...row };
  delete next.tipHtml;
  delete next.tipHtmlIsFull;
  delete next.tipPresentation;
  delete next.tipId;
  delete next.tipWrapperClass;
  return next;
}

/** Back hem choices, reusing the block already after cast-on when it is present. */
function asSetInBackHemBlock(
  row: Extract<SleevelessPatternDisplayRow, { kind: "block" }>,
  fallbackHemRows: number,
): Extract<SleevelessPatternDisplayRow, { kind: "block" }> {
  const text = hemInstructionText(row);
  const stitches = row.stitchCount ?? 0;
  const hemRows = hemRowsFromBlock(row, fallbackHemRows);
  if (text.includes("The finished hem is") && !text.includes("Finish your hem to match the back") && row.tipId === SWEATER_BODY_HEM_TECHNIQUE_TIP_ID) {
    return row;
  }
  const display = sweaterBodyHemChoiceDisplay(stitches, hemRows);
  return {
    ...row,
    paragraphs: display.paragraphs,
    trustedParagraphs: display.trustedParagraphs,
    ...sweaterBodyHemTechniqueTipFields(stitches, hemRows),
  };
}

/**
 * Set-In backs choose the hem. Drop the cast-on method tip, keep one hem block
 * immediately after cast-on, and leave bust darts on the front.
 */
function applySetInBackOpening(
  rows: readonly SleevelessPatternDisplayRow[],
  fallbackHemRows: number,
): SleevelessPatternDisplayRow[] {
  const out: SleevelessPatternDisplayRow[] = [];
  let hemPlaced = false;
  for (const row of rows) {
    if (row.kind === "bustDartCustomization") continue;
    if (row.kind === "section") {
      if (isBackPieceHeading(row.title)) hemPlaced = false;
      out.push(row);
      continue;
    }
    if (row.kind !== "block") {
      out.push(row);
      continue;
    }
    const next = withoutCastOnMethodTip(row);
    if (!isSetInHemInstructionBlock(next)) {
      out.push(next);
      continue;
    }
    if (hemPlaced) continue;
    out.push(asSetInBackHemBlock(next, fallbackHemRows));
    hemPlaced = true;
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
  if (vNeck && piece === "front") {
    rows = withoutChartMount(rows);
    rows = replaceNecklineSection(rows, vNeckHalfLines(half, side, fullNeckStitches));
  }
  if (piece === "back") {
    rows = applySetInBackOpening(rows, half.debug.hemRows);
    rows = applySplitBackInstructionCues(rows, side);
  }
  const chart = half.frontNeckShoulderShapingChart;
  const armholeStart = half.debug.armholeStartRow;
  if (piece === "back") {
    return attachSetInNecklinePrintShaping(
      rows,
      setInNecklinePrintShapingParagraphs(
        chart,
        armholeStart,
        setInBackPrintShapingOptions({
          centerSeamHalf: true,
          shallowRound: false,
          invertCarriageParity: side === "left",
        }),
      ),
    );
  }
  if (vNeck) {
    return attachSetInNecklinePrintShaping(
      rows,
      setInNecklinePrintShapingParagraphs(
        chart,
        armholeStart,
        setInFrontPrintShapingOptions({
          splitFront: true,
          roundNeck: false,
          centerBindOff: 0,
          invertCarriageParity: side === "left",
        }),
      ),
      /Decrease 1 stitch at the center edge/,
    );
  }
  return attachSetInNecklinePrintShaping(
    rows,
    setInNecklinePrintShapingParagraphs(
      chart,
      armholeStart,
      setInFrontPrintShapingOptions({
        splitFront: true,
        roundNeck: true,
        centerBindOff: Number(half.debug.frontCenterNeckBindOffStitches) || 0,
        invertCarriageParity: side === "left",
      }),
    ),
  );
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
  const leftBack = generateSetInSleevePattern(backPattern, {
    halfPiece: { side: "left", seamStitch: true, matchBackNeckPlan: true },
    omitBustDart: true,
  });
  const rightBack = generateSetInSleevePattern(backPattern, {
    halfPiece: { side: "right", seamStitch: true, matchBackNeckPlan: true },
    omitBustDart: true,
  });
  const leftBackRows = prepareCenterSeamHalf(leftBack, "back", "left", false, fullNeck);
  const rightBackRows = prepareCenterSeamHalf(rightBack, "back", "right", false, fullNeck);
  const backRows = splitHalvesMatch(leftBackRows, rightBackRows)
    ? [...leftBackRows, ...rightBackReverseRows()]
    : [...leftBackRows, ...rightBackRows];

  let frontRows = base.frontDisplayRows;
  let frontChart = base.frontNeckShoulderShapingChart;
  let frontTimeline = base.frontNeckShoulderTimeline;
  let leftFront: SetInSleevePatternResult | null = null;
  let rightFront: SetInSleevePatternResult | null = null;
  let leftFrontRows: SleevelessPatternDisplayRow[] = [];
  let rightFrontRows: SleevelessPatternDisplayRow[] = [];
  let frontPattern: Record<string, unknown> | undefined;
  if (!cardigan) {
    frontPattern = withCardiganHalfStyle(patternData);
    leftFront = generateSetInSleevePattern(frontPattern, { halfPiece: { side: "left", seamStitch: true } });
    rightFront = generateSetInSleevePattern(frontPattern, { halfPiece: { side: "right", seamStitch: true } });
    leftFrontRows = withoutRightFrontMirror(prepareCenterSeamHalf(leftFront, "front", "left", vNeck, fullNeck));
    rightFrontRows = withoutRightFrontMirror(prepareCenterSeamHalf(rightFront, "front", "right", vNeck, fullNeck));
    const frontsMatch = splitHalvesMatch(rightFrontRows, leftFrontRows);
    frontRows = frontsMatch
      ? [...rightFrontRows, ...leftFrontReverseRows(halfHasActiveBustDart(rightFrontRows))]
      : [...rightFrontRows, ...leftFrontRows];
    frontChart = rightFront.frontNeckShoulderShapingChart;
    frontTimeline = rightFront.frontNeckShoulderTimeline;
  }

  const available = capacity.availableNeedles;
  if (available !== null) {
    const piecePeaks = [
      { label: "Left back", needles: maxBlockStitches(leftBackRows) },
      { label: "Right back", needles: maxBlockStitches(rightBackRows) },
      ...(leftFront && rightFront
        ? [
            { label: "Left front", needles: maxBlockStitches(leftFrontRows) },
            { label: "Right front", needles: maxBlockStitches(rightFrontRows) },
          ]
        : [{ label: "Front", needles: maxBlockStitches(frontRows) }]),
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
      paragraphs: row.paragraphs.filter(
        (paragraph) =>
          !paragraph.includes("Panel seams are not added") &&
          !paragraph.includes("Added center seams fit on this machine"),
      ),
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
    centerSeamPieces: {
      leftBack,
      rightBack,
      backPatternData: backPattern,
      ...(leftFront && rightFront && frontPattern
        ? { leftFront, rightFront, frontPatternData: frontPattern }
        : {}),
    },
    centerSeams: {
      applied: true,
      splitFront: !cardigan,
      splitBack: true,
      backHem: leftBack.debug.cardiganHalfLeftCastOnSts,
      backBust: leftBack.debug.cardiganHalfLeftBustBodySts,
      backAfter: leftBack.debug.cardiganHalfLeftStitchesAfterArmhole,
      backRightHem: rightBack.debug.cardiganHalfLeftCastOnSts,
      backRightBust: rightBack.debug.cardiganHalfLeftBustBodySts,
      backRightAfter: rightBack.debug.cardiganHalfLeftStitchesAfterArmhole,
      ...(!cardigan && leftFront && rightFront
        ? {
            frontHem: leftFront.debug.cardiganHalfLeftCastOnSts,
            frontBust: leftFront.debug.cardiganHalfLeftBustBodySts,
            frontAfter: leftFront.debug.cardiganHalfLeftStitchesAfterArmhole,
            frontRightHem: rightFront.debug.cardiganHalfLeftCastOnSts,
            frontRightBust: rightFront.debug.cardiganHalfLeftBustBodySts,
            frontRightAfter: rightFront.debug.cardiganHalfLeftStitchesAfterArmhole,
          }
        : {}),
    },
  };
}

export function generateSetInSleevePattern(
  patternData: Record<string, unknown>,
  options?: {
    halfPiece?: { side: "left" | "right"; seamStitch: boolean; matchBackNeckPlan?: boolean };
    omitBustDart?: boolean;
  },
): SetInSleevePatternResult {
  if (readCenterSeams(section(patternData.style)) && !options?.halfPiece) {
    return generateSetInSleeveWithCenterSeams(patternData);
  }
  const style = withSetInSleeveConstructionAuthored(section(patternData.style), section(patternData.style).sleeveLength);
  const stamped: Record<string, unknown> = { ...patternData, style };
  const body = generateSleevelessBackPattern(stamped, {
    useSetInArmhole: true,
    ...(options?.omitBustDart ? { omitBustDart: true } : {}),
    ...(options?.halfPiece
      ? {
          cardiganHalfSide: options.halfPiece.side,
          centerSeamStitch: options.halfPiece.seamStitch,
          ...(options.halfPiece.matchBackNeckPlan ? { centerSeamBackHalf: true as const } : {}),
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
    sleevePiece = resolveCuffUpSweaterSleevePiece({
      patternData: stamped,
      audience: chartAudience,
      finishedUpperArmInches: cap.sleeve.finishedUpperArmInches,
      finishedWristInches: sleeveInches.wristIn,
      sleeveLengthInches: sleeveInches.sleeveLengthIn,
      stitchesPerInch: debug.stitchesPerInch,
      rowsPerInch: debug.rowsPerInch,
      keepRequestedSleeveLength: true,
    });
    const cuffInches = sleevePiece.cuffDepthInches;
    sleeveFinishedInches = {
      ...(typeof sleeveInches.wristIn === "number" ? { wristInches: sleeveInches.wristIn } : {}),
      cuffDepthInches: cuffInches,
      ...(typeof sleeveInches.sleeveLengthIn === "number"
        ? { sleeveLengthInches: sleeveInches.sleeveLengthIn }
        : {}),
    };
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
  const needleLines =
    available !== undefined && required > available
      ? [
          needleCapacity.offerSeams
            ? `This pattern needs ${required} needles at the widest piece. This machine has ${available}. Added center seams fit on this machine.`
            : `This pattern needs ${required} needles at the widest piece. This machine has ${available}. The instructions are still the full piece. Panel seams are not added.`,
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

  const backRows = rewriteSetInDisplayRows(applySetInBackOpening(displayRows, debug.hemRows));
  const frontRows = rewriteSetInDisplayRows(frontDisplayRows);
  const shapedBack = options?.halfPiece
    ? backRows
    : attachSetInNecklinePrintShaping(
        backRows,
        setInNecklinePrintShapingParagraphs(
          body.neckShoulderShapingChart,
          debug.armholeStartRow,
          setInBackPrintShapingOptions({
            centerSeamHalf: false,
            shallowRound: debug.backNeckRoundNecklineStrategy === "shallow-round",
          }),
        ),
      );
  const shapedFront = options?.halfPiece
    ? frontRows
    : attachSetInNecklinePrintShaping(
        frontRows,
        setInNecklinePrintShapingParagraphs(
          body.frontNeckShoulderShapingChart,
          debug.armholeStartRow,
          setInFrontPrintShapingOptions({
            splitFront: false,
            roundNeck: !vNeck,
            centerBindOff: Number(debug.frontCenterNeckBindOffStitches) || 0,
          }),
        ),
      );

  return {
    ...body,
    warnings,
    displayRows: shapedBack,
    frontDisplayRows: shapedFront,
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
