/**
 * Instructions-only neckline and shoulder prose for Set-In Sleeve.
 * Built from the same checklist rows the on-screen chart renders.
 * The chart stays on screen and in Charts / Complete pattern.
 */

import {
  armholeLocalRcActiveShoulderChecklistStart,
  buildActiveSideInstructionTableRows,
  buildHeldSideInstructionTableRows,
  buildSecondShoulderInstructionTableRows,
  isCenterNecklineSetupChecklistRow,
  type ActiveSideInstructionTableRow,
} from "./neckShoulderActiveSideChecklist";
import { CARDIGAN_FRONT_OPPOSITE_FRONT_SENTENCE } from "./neckShoulderActiveIntroCopy";
import {
  isSleevelessCardiganFrontNeckShoulderChart,
  NECK_SHOULDER_PRINT_KNIT_EVEN_LABEL,
  usesVNeckHeldSideChecklist,
  type NeckShoulderShapingChart,
} from "./neckShoulderShapingChart";
import {
  compactActiveSideInstructionRowsForPrint,
  SET_IN_HELD_NECKLINE_FINISH_SENTENCE,
} from "./neckShoulderShapingChartHtml";
import { isPatternPrintChecklistPointer } from "./patternPrintWrittenShaping";
import {
  formatRcColon,
  formatShoulderBindoffRemainingInstruction,
  type SleevelessPatternDisplayRow,
} from "./sleevelessPatternOutput";

export { SET_IN_HELD_NECKLINE_FINISH_SENTENCE };

export const SET_IN_PRINT_CARRIAGE_DEFINITION =
  "COR means carriage on the right. COL means carriage on the left.";

export const SET_IN_PRINT_INTERVENING_ROWS = "Knit the intervening rows in pattern.";

export type SetInNecklinePrintShapingOptions = {
  /** Passed to the checklist builder. The row-counter start is always computed with the center row included. */
  includeCenterNecklineSetupRow: boolean;
  hideCenterNecklineSetupRow: boolean;
  resetRowCounterForSecondShoulder: boolean;
  finishHeldNecklineAfterSecondShoulder: boolean;
  /** One piece. No mirrored shoulder list. */
  singleSide: boolean;
};

export type SetInNecklinePrintShaping = {
  paragraphs: string[];
  firstRows: ActiveSideInstructionTableRow[];
  secondRows: ActiveSideInstructionTableRow[];
};

const CENTER_SETUP_RC_OPTIONS = { includeCenterNecklineSetupRow: true as const };

export function setInBackPrintShapingOptions(args: {
  centerSeamHalf: boolean;
  shallowRound: boolean;
}): SetInNecklinePrintShapingOptions {
  if (args.centerSeamHalf) {
    return {
      includeCenterNecklineSetupRow: false,
      hideCenterNecklineSetupRow: true,
      resetRowCounterForSecondShoulder: false,
      finishHeldNecklineAfterSecondShoulder: false,
      singleSide: true,
    };
  }
  return {
    includeCenterNecklineSetupRow: true,
    hideCenterNecklineSetupRow: true,
    resetRowCounterForSecondShoulder: true,
    finishHeldNecklineAfterSecondShoulder: args.shallowRound,
    singleSide: false,
  };
}

export function setInFrontPrintShapingOptions(args: {
  splitFront: boolean;
  roundNeck: boolean;
  centerBindOff: number;
}): SetInNecklinePrintShapingOptions {
  const split = args.splitFront;
  return {
    includeCenterNecklineSetupRow: true,
    hideCenterNecklineSetupRow: false,
    resetRowCounterForSecondShoulder: !split,
    finishHeldNecklineAfterSecondShoulder: !split && args.roundNeck && args.centerBindOff > 0,
    singleSide: split,
  };
}

function checklistBuildOptions(includeCenter: boolean) {
  return includeCenter ? CENTER_SETUP_RC_OPTIONS : undefined;
}

function displayRowsForChecklist(
  rows: readonly ActiveSideInstructionTableRow[],
  invertCarriageParity: boolean,
): ActiveSideInstructionTableRow[] {
  return compactActiveSideInstructionRowsForPrint(rows, { invertCarriageParity });
}

type AtomKind = "knit" | "shaping" | "special";

type Atom = {
  index: number;
  rc: number;
  rcEnd: number;
  kind: AtomKind;
  action: string;
  edge: string;
  carriage: string;
  stitchesRemaining: number;
  passNote?: string;
  rowCounterReset?: boolean;
  rowCounterResetGarmentRc?: number;
  key: string;
};

export type CondensedShapingGroup = {
  action: string;
  edge: string;
  carriage: string;
  times: number;
  interval: number;
  rcs: number[];
  line: string;
};

export type CondensedChecklist = {
  lines: string[];
  groups: CondensedShapingGroup[];
  /** Every non-knit checklist row, in order, once. */
  shapingRcs: number[];
  interveningKnitRcs: number[];
  plainKnitRcs: number[];
};

function carriageCode(position: string): string {
  if (/^right$/i.test(position.trim())) return "COR";
  if (/^left$/i.test(position.trim())) return "COL";
  return "";
}

function stitchWord(count: number): string {
  return count === 1 ? "1 stitch" : `${count} stitches`;
}

function writtenAction(action: string): string {
  const text = action.trim().replace(/\.$/, "");
  const shaped = text.match(/^(Hold|Decrease|Bind off OR hold|Bind off remaining|Bind off) (\d+) sts?$/i);
  if (!shaped) {
    return text.replace(/\bsts\b/gi, "stitches").replace(/\bst\b/gi, "stitch");
  }
  const count = stitchWord(Number(shaped[2]));
  const verb = shaped[1]!.toLowerCase();
  if (verb === "bind off or hold") return `bind off or hold ${count}`;
  if (verb === "bind off remaining") return `bind off the remaining ${count}`;
  if (verb === "bind off") return `bind off ${count}`;
  if (verb === "hold") return `hold ${count}`;
  return `decrease ${count}`;
}

function edgePhrase(edge: string): string {
  const value = edge.trim();
  if (!value || /^center$/i.test(value)) return "center";
  return `${value.toLowerCase()} edge`;
}

function remainText(count: number): string {
  return count === 1 ? "1 stitch remains" : `${count} stitches remain`;
}

function lowerFirst(text: string): string {
  return text ? text.charAt(0).toLowerCase() + text.slice(1) : text;
}

function atomKind(row: ActiveSideInstructionTableRow): AtomKind {
  if (row.action === NECK_SHOULDER_PRINT_KNIT_EVEN_LABEL) return "knit";
  if (row.passNote || row.rowCounterReset || row.rcEnd !== undefined) return "special";
  if (row.edge === "Center") return "special";
  if (/^Return to the held/i.test(row.action)) return "special";
  if (/^Bind off remaining\b/i.test(row.action)) return "special";
  if (/^(Hold|Decrease|Bind off)\b/.test(row.action) && carriageCode(row.carriagePosition)) return "shaping";
  return "special";
}

function atomsFromRows(rows: readonly ActiveSideInstructionTableRow[]): Atom[] {
  return rows.map((row, index) => {
    const kind = atomKind(row);
    const carriage = carriageCode(row.carriagePosition);
    return {
      index,
      rc: row.rc,
      rcEnd: row.rcEnd !== undefined && row.rcEnd > row.rc ? row.rcEnd : row.rc,
      kind,
      action: row.action,
      edge: row.edge,
      carriage,
      stitchesRemaining: Math.max(0, Math.floor(row.stitchesRemaining)),
      ...(row.passNote ? { passNote: row.passNote } : {}),
      ...(row.rowCounterReset ? { rowCounterReset: true } : {}),
      ...(row.rowCounterResetGarmentRc !== undefined
        ? { rowCounterResetGarmentRc: row.rowCounterResetGarmentRc }
        : {}),
      key: `${row.action}|${row.edge}|${carriage}`,
    };
  });
}

function rcsCoveredBy(atoms: readonly Atom[]): number[] {
  const covered: number[] = [];
  for (const atom of atoms) {
    for (let rc = atom.rc; rc <= atom.rcEnd; rc += 1) covered.push(rc);
  }
  return covered;
}

function gapAllowsRepeat(between: readonly Atom[], fromRc: number, toRc: number, edge: string): boolean {
  const expected: number[] = [];
  for (let rc = fromRc + 1; rc < toRc; rc += 1) expected.push(rc);
  if (between.some((atom) => atom.kind === "special")) return false;
  if (between.some((atom) => atom.kind === "shaping" && atom.edge === edge)) return false;
  const covered = rcsCoveredBy(between);
  if (covered.join(",") !== expected.join(",")) return false;
  const knitRows = between
    .filter((atom) => atom.kind === "knit")
    .reduce((sum, atom) => sum + (atom.rcEnd - atom.rc + 1), 0);
  const otherShaping = between.filter((atom) => atom.kind === "shaping").length;
  if (otherShaping > 0 && knitRows > 0) return false;
  return true;
}

type ShapingGroup = {
  members: Atom[];
  interval: number;
  atSameTime: boolean;
};

function groupShapingAtoms(atoms: readonly Atom[]): ShapingGroup[] {
  const groups: ShapingGroup[] = [];
  const used = new Set<number>();
  for (let index = 0; index < atoms.length; index += 1) {
    const start = atoms[index]!;
    if (start.kind !== "shaping" || used.has(index)) continue;
    const members = [start];
    used.add(index);
    let interval = 0;
    let last = start;
    let lastIndex = index;
    for (let cursor = index + 1; cursor < atoms.length; cursor += 1) {
      const next = atoms[cursor]!;
      if (next.kind === "special") break;
      if (next.kind === "knit") continue;
      if (next.kind === "shaping" && next.edge === start.edge && next.key !== start.key) break;
      if (next.kind !== "shaping" || next.key !== start.key || used.has(cursor)) continue;
      const gap = next.rc - last.rc;
      if (interval !== 0 && gap !== interval) break;
      const between = atoms.slice(lastIndex + 1, cursor);
      if (!gapAllowsRepeat(between, last.rc, next.rc, start.edge)) break;
      interval = gap;
      members.push(next);
      used.add(cursor);
      last = next;
      lastIndex = cursor;
    }
    if (members.length === 2 && interval > 2) {
      const between = atoms.slice(members[0]!.index + 1, members[1]!.index);
      if (between.some((atom) => atom.kind === "knit")) {
        used.delete(members[1]!.index);
        members.pop();
        interval = 0;
      }
    }
    groups.push({ members, interval, atSameTime: false });
  }
  for (const group of groups) {
    const start = group.members[0]!.rc;
    group.atSameTime = groups.some((other) => {
      if (other === group) return false;
      const otherStart = other.members[0]!.rc;
      const otherEnd = other.members[other.members.length - 1]!.rc;
      return otherStart < start && start < otherEnd;
    });
  }
  return groups;
}

function interveningKnitRcs(atoms: readonly Atom[], groups: readonly ShapingGroup[]): number[] {
  const memberRcs = new Set(groups.flatMap((group) => group.members.map((member) => member.rc)));
  const rcs: number[] = [];
  for (const group of groups) {
    for (let index = 0; index < group.members.length - 1; index += 1) {
      const from = group.members[index]!.rc;
      const to = group.members[index + 1]!.rc;
      for (const atom of atoms) {
        if (atom.kind !== "knit") continue;
        for (let rc = atom.rc; rc <= atom.rcEnd; rc += 1) {
          if (rc > from && rc < to && !memberRcs.has(rc)) rcs.push(rc);
        }
      }
    }
  }
  return [...new Set(rcs)];
}

function frequencyPhrase(interval: number, times: number): string {
  if (interval <= 1) return ` every row ${times} times`;
  if (interval === 2) return ` every other row ${times} times`;
  return ` every ${interval} rows ${times} times`;
}

function groupLine(group: ShapingGroup): string {
  const first = group.members[0]!;
  const last = group.members[group.members.length - 1]!;
  const times = group.members.length;
  const action = writtenAction(first.action);
  const edge = edgePhrase(first.edge);
  const prefix = group.atSameTime ? "At the same time, " : "";
  const remain = `${remainText(last.stitchesRemaining)} at ${formatRcColon(last.rc)}.`;
  if (times === 1) {
    const lead = group.atSameTime ? "At the same time, at" : "At";
    return `${lead} ${formatRcColon(first.rc)}, ${first.carriage}, ${action} at the ${edge}. ${remain}`;
  }
  const beginning = group.atSameTime ? "beginning" : "Beginning";
  return `${prefix}${beginning} at ${formatRcColon(first.rc)}, ${first.carriage}, ${action} at the ${edge}${frequencyPhrase(group.interval, times)}. ${remain}`;
}

function specialLine(atom: Atom): string {
  const action = lowerFirst(writtenAction(atom.action).replace(/\.$/, ""));
  const carriage = atom.carriage ? `${atom.carriage}, ` : "";
  let sentence = `At ${formatRcColon(atom.rc)}, ${carriage}${action}.`;
  if (atom.rowCounterReset) {
    const garment =
      atom.rowCounterResetGarmentRc !== undefined
        ? ` The garment row counter was ${formatRcColon(atom.rowCounterResetGarmentRc)}.`
        : "";
    sentence = `Reset the row counter to ${formatRcColon(0)}.${garment} ${sentence}`;
  }
  const remain = remainText(atom.stitchesRemaining);
  if (!sentence.includes(remain)) sentence = `${sentence} ${remain}.`;
  if (atom.passNote) {
    const note = atom.passNote.trim().replace(/\.$/, "");
    sentence = `${sentence} At the same time, ${lowerFirst(note)}.`;
  }
  return sentence.replace(/\s+/g, " ").trim();
}

function plainSpans(atoms: readonly Atom[], intervening: readonly number[]): { rc: number; rcEnd: number }[] {
  const skip = new Set(intervening);
  const rcs: number[] = [];
  for (const atom of atoms) {
    if (atom.kind !== "knit") continue;
    for (let rc = atom.rc; rc <= atom.rcEnd; rc += 1) {
      if (!skip.has(rc)) rcs.push(rc);
    }
  }
  const spans: { rc: number; rcEnd: number }[] = [];
  for (const rc of rcs) {
    const last = spans[spans.length - 1];
    if (last && last.rcEnd + 1 === rc) last.rcEnd = rc;
    else spans.push({ rc, rcEnd: rc });
  }
  return spans;
}

export function condenseChecklistRows(rows: readonly ActiveSideInstructionTableRow[]): CondensedChecklist {
  const atoms = atomsFromRows(rows);
  const groups = groupShapingAtoms(atoms);
  const intervening = interveningKnitRcs(atoms, groups);
  const plains = plainSpans(atoms, intervening);
  const described: CondensedShapingGroup[] = groups.map((group) => ({
    action: group.members[0]!.action,
    edge: group.members[0]!.edge,
    carriage: group.members[0]!.carriage,
    times: group.members.length,
    interval: group.interval,
    rcs: group.members.map((member) => member.rc),
    line: groupLine(group),
  }));
  const events: { rc: number; line: string }[] = [
    ...plains.map((span) => ({
      rc: span.rc,
      line: `Knit in pattern to ${formatRcColon(span.rcEnd)}.`,
    })),
    ...described.map((group) => ({ rc: group.rcs[0]!, line: group.line })),
    ...atoms
      .filter((atom) => atom.kind === "special")
      .map((atom) => ({ rc: atom.rc, line: specialLine(atom) })),
  ];
  events.sort((a, b) => a.rc - b.rc);
  const shapingRcs = [
    ...described.flatMap((group) => group.rcs),
    ...atoms.filter((atom) => atom.kind === "special").map((atom) => atom.rc),
  ].sort((a, b) => a - b);
  return {
    lines: events.map((event) => event.line),
    groups: described,
    shapingRcs,
    interveningKnitRcs: intervening,
    plainKnitRcs: plains.flatMap((span) => {
      const rcs: number[] = [];
      for (let rc = span.rc; rc <= span.rcEnd; rc += 1) rcs.push(rc);
      return rcs;
    }),
  };
}

export function writtenLinesFromChecklistRows(rows: readonly ActiveSideInstructionTableRow[]): string[] {
  return condenseChecklistRows(rows).lines;
}

function heldShoulderStitches(chart: NeckShoulderShapingChart, heldSide: boolean): number {
  const fromComposition = heldSide ? chart.frontVNeckArmholeComposition?.heldAfterDivideRow : undefined;
  const count = fromComposition ?? chart.rows[0]?.leftStitchCount ?? 0;
  return Math.max(0, Math.floor(Number(count) || 0));
}

function secondShoulderLead(
  chart: NeckShoulderShapingChart,
  startRc: number | undefined,
  options: SetInNecklinePrintShapingOptions,
  heldSide: boolean,
): string {
  if (heldSide) {
    const reset =
      options.resetRowCounterForSecondShoulder && startRc !== undefined
        ? `Free Pass the carriage to the side with the working yarn. This does not add a knitted row. Set the row counter to ${formatRcColon(startRc)} before beginning the Second Side. `
        : "";
    return `${reset}Neckline shaping remains at the neck edge and shoulder shaping remains at the shoulder edge.`;
  }
  const held = heldShoulderStitches(chart, false);
  const reset =
    options.resetRowCounterForSecondShoulder && startRc !== undefined
      ? ` Free Pass the carriage to the side with the working yarn. This does not add a knitted row. Set the row counter to ${formatRcColon(startRc)} before beginning the Second Shoulder.`
      : "";
  return `Once this side is complete, cut yarn and return the ${held} held stitches for the second shoulder to working position.${reset} Work the second shoulder with the steps below. Neckline shaping stays on the neck edge and shoulder shaping stays on the shoulder edge.`;
}

function bindOffLine(rows: readonly ActiveSideInstructionTableRow[]): string | null {
  const last = rows.length > 0 ? rows[rows.length - 1] : undefined;
  if (!last) return null;
  return formatShoulderBindoffRemainingInstruction(last.stitchesRemaining);
}

export function setInNecklinePrintShaping(
  chart: NeckShoulderShapingChart | null | undefined,
  armholeStartRow: number | null | undefined,
  options: SetInNecklinePrintShapingOptions,
): SetInNecklinePrintShaping {
  if (!chart?.rows?.length) return { paragraphs: [], firstRows: [], secondRows: [] };
  const rcStart = armholeLocalRcActiveShoulderChecklistStart(chart, armholeStartRow, CENTER_SETUP_RC_OPTIONS);
  const buildOptions = checklistBuildOptions(options.includeCenterNecklineSetupRow);
  let active = buildActiveSideInstructionTableRows(chart, rcStart, buildOptions);
  if (options.hideCenterNecklineSetupRow) {
    active = active.filter((row) => !isCenterNecklineSetupChecklistRow(row));
  }
  const firstRows = displayRowsForChecklist(active, false);
  const cardigan = isSleevelessCardiganFrontNeckShoulderChart(chart);
  const singleSide = options.singleSide || cardigan;
  const heldSide = !singleSide && usesVNeckHeldSideChecklist(chart);
  let opposite: ActiveSideInstructionTableRow[] = [];
  if (!singleSide) {
    opposite = heldSide
      ? buildHeldSideInstructionTableRows(chart, rcStart, buildOptions)
      : buildSecondShoulderInstructionTableRows(active);
    if (options.hideCenterNecklineSetupRow) {
      opposite = opposite.filter((row) => !isCenterNecklineSetupChecklistRow(row));
    }
  }
  const secondRows = singleSide ? [] : displayRowsForChecklist(opposite, !heldSide);
  const firstCondensed = condenseChecklistRows(firstRows);
  const secondCondensed = condenseChecklistRows(secondRows);
  const paragraphs = [SET_IN_PRINT_CARRIAGE_DEFINITION];
  if (firstCondensed.interveningKnitRcs.length > 0 || secondCondensed.interveningKnitRcs.length > 0) {
    paragraphs.push(SET_IN_PRINT_INTERVENING_ROWS);
  }
  if (!singleSide) paragraphs.push("First shoulder.");
  paragraphs.push(...firstCondensed.lines);
  const firstBindOff = bindOffLine(active);
  if (firstBindOff) paragraphs.push(firstBindOff);

  if (singleSide) {
    if (cardigan && !options.singleSide) {
      paragraphs.push(
        `${CARDIGAN_FRONT_OPPOSITE_FRONT_SENTENCE} Use the same row numbers. Keep neckline shaping on the neck edge and shoulder shaping on the shoulder edge, with the carriage on the opposite side.`,
      );
    }
    return { paragraphs, firstRows, secondRows: [] };
  }

  if (secondRows.length === 0) return { paragraphs, firstRows, secondRows };
  const startRc = options.resetRowCounterForSecondShoulder ? secondRows[0]?.rc : undefined;
  paragraphs.push(secondShoulderLead(chart, startRc, options, heldSide));
  paragraphs.push(heldSide ? "Second side." : "Second shoulder.");
  paragraphs.push(...secondCondensed.lines);
  const secondBindOff = bindOffLine(opposite);
  if (secondBindOff) paragraphs.push(secondBindOff);
  if (options.finishHeldNecklineAfterSecondShoulder) paragraphs.push(SET_IN_HELD_NECKLINE_FINISH_SENTENCE);
  return { paragraphs, firstRows, secondRows };
}

export function setInNecklinePrintShapingParagraphs(
  chart: NeckShoulderShapingChart | null | undefined,
  armholeStartRow: number | null | undefined,
  options: SetInNecklinePrintShapingOptions,
): string[] {
  return setInNecklinePrintShaping(chart, armholeStartRow, options).paragraphs;
}

/**
 * Put the written shaping on the neckline block that points at the checklist.
 * Pass `match` when that block has no checklist sentence, such as a V-neck half.
 */
export function attachSetInNecklinePrintShaping(
  rows: readonly SleevelessPatternDisplayRow[],
  paragraphs: readonly string[],
  match?: RegExp,
): SleevelessPatternDisplayRow[] {
  if (paragraphs.length === 0) return [...rows];
  let section = "";
  let attached = false;
  return rows.map((row) => {
    if (row.kind === "section") {
      section = row.title ?? "";
      return row;
    }
    if (attached || row.kind !== "block" || !/neckline|shoulder/i.test(section)) return row;
    const text = [...(row.paragraphs ?? []), ...(row.trustedParagraphs ?? [])].join("\n");
    const hits = match ? match.test(text) : isPatternPrintChecklistPointer(text);
    if (!hits) return row;
    attached = true;
    return { ...row, printInstructionParagraphs: [...paragraphs] };
  });
}
