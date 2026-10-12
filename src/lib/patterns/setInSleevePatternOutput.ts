/**
 * Set-in sleeve pattern output.
 *
 * The body, neckline, shoulders, hem, and cardigan fronts come from the sleeveless generator.
 * The armhole section is replaced with the approved set-in armhole. Sleeves are cuff-up:
 * the drop-shoulder sleeve taper through the upper arm, then the approved sleeve cap.
 */

import {
  calculateDropShoulderSleevePieceNumbers,
  type DropShoulderSleevePieceNumbers,
} from "./dropShoulderSleevePieceNumbers";
import {
  resolveDropShoulderSleeveInches,
} from "./dropShoulderSleeveMeasurementOverrides";
import { readEffectiveDropShoulderUserEditedSleeveFields } from "./dropShoulderUserEditedSleeveFields";
import {
  FRONT_VNECK_HANDOFF_DURING_ARMHOLE,
  FRONT_VNECK_HANDOFF_FOLLOW_CHECKLIST,
  FRONT_VNECK_HANDOFF_WITH_ARMHOLE,
} from "./frontArmholeNecklineComposition";
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
  setInArmholeInstructionLines,
  setInOneEdgeArmholeInstructionLines,
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
   * Set when the armhole, sleeve cap, or sleeve taper cannot be knitted.
   * A body/cap bind-off mismatch stays a warning and does not set this.
   */
  sleeveSaveBlocker: string | null;
};

const SLEEVELESS_ARMHOLE_PROSE =
  /bind off or hold|decrease 1 stitch at (each |the )?armhole edge every other row/i;

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
function backArmholeBlocksFromLines(lines: readonly string[]): SleevelessPatternDisplayRow[] {
  const tip = setInBackArmholeBindOffTrickTip();
  let tipped = false;
  return lines
    .filter((line) => line.trim().length > 0)
    .map((line) => {
      if (!tipped && /\bbind off\b/i.test(line)) {
        tipped = true;
        return { kind: "block" as const, paragraphs: [line], ...tip };
      }
      return { kind: "block" as const, paragraphs: [line] };
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
  next = next.replace(/\(RC:\s*([0-9,\s]+)\)/g, (match, list: string) => {
    const parts = list
      .split(",")
      .map((part) => part.trim())
      .filter((part) => part.length > 0);
    if (parts.length === 0 || parts.some((part) => !/^\d+$/.test(part))) return match;
    return `(${parts.map((part) => formatRcColon(Number(part))).join(", ")})`;
  });
  return next;
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
  return rows.map((row) => {
    if (row.kind !== "block") return row;
    const source = row.paragraphs ?? [];
    const paragraphs = source.filter((paragraph) => !SLEEVELESS_ARMHOLE_PROSE.test(paragraph));
    if (paragraphs.length === source.length) return row;
    if (paragraphs.length === 0) return { ...row, paragraphs: [FRONT_VNECK_HANDOFF_FOLLOW_CHECKLIST] };
    return { ...row, paragraphs };
  });
}

function localRc(line: string): number | null {
  const match = /^RC:\s*(\d+)/.exec(line.trim());
  return match ? Number(match[1]) : null;
}

function armholeLinesForPiece(
  plan: SetInArmholePlan,
  stitches: number,
  edge: "both" | "one",
  divideLocalRc: number | null,
): string[] {
  const full =
    edge === "one"
      ? setInOneEdgeArmholeInstructionLines(plan, stitches)
      : setInArmholeInstructionLines(
          {
            bindOffStitchesEachSide: plan.initialBindOffStitchesEachSide,
            stairStepBindOffsEachSide: plan.stairStepBindOffsEachSide,
            decreaseStitchesEachSide: plan.decreaseStitchesEachSide,
            decreaseRows: plan.decreaseRows,
          },
          stitches,
        );
  if (divideLocalRc === null) return full;
  const kept = full.filter((line) => {
    const rc = localRc(line);
    return rc === null || rc < divideLocalRc;
  });
  const handoff =
    divideLocalRc <= 0 ? FRONT_VNECK_HANDOFF_WITH_ARMHOLE : FRONT_VNECK_HANDOFF_DURING_ARMHOLE;
  return [...kept, handoff, FRONT_VNECK_HANDOFF_FOLLOW_CHECKLIST];
}

function styleSentence(patternData: Record<string, unknown>): string {
  const garment = isSleevelessCardiganGarmentStyle(patternData) ? "cardigan" : "pullover";
  const neck = isSleevelessVNeckChoice(patternData) ? "V-neck" : "round neckline";
  return `Set-in sleeve sweater, ${garment}, ${neck}. Sleeves are knitted cuff-up.`;
}

export function generateSetInSleevePattern(
  patternData: Record<string, unknown>,
): SetInSleevePatternResult {
  const style = withSetInSleeveConstructionAuthored(section(patternData.style), section(patternData.style).sleeveLength);
  const stamped: Record<string, unknown> = { ...patternData, style };
  const body = generateSleevelessBackPattern(stamped, { useSetInArmhole: true });
  const warnings = [...body.warnings];
  const plan = body.setInArmholePlan ?? null;
  const debug = body.debug;
  const cardigan = isSleevelessCardiganGarmentStyle(stamped);
  const overlap = debug.frontArmholeNecklineOverlap;
  const divideLocal =
    overlap && debug.armholeStartRow !== undefined
      ? overlap.divideGarmentRc - overlap.firstArmholeGarmentRc
      : null;
  const duringArmhole = divideLocal !== null && overlap && overlap.divideGarmentRc >= overlap.firstArmholeGarmentRc;

  const backArmholeBlocks = plan
    ? backArmholeBlocksFromLines(
        armholeLinesForPiece(
          plan,
          debug.bustBodyStitches && debug.bustBodyStitches > 0
            ? debug.bustBodyStitches
            : debug.backStitches,
          "both",
          null,
        ),
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
    ? linesToBlocks(
        armholeLinesForPiece(
          plan,
          frontStart,
          cardigan ? "one" : "both",
          duringArmhole ? divideLocal : null,
        ),
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
    sleeveSaveBlocker,
  };
}
