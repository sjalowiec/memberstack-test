import { roundUpToEvenRows } from "../patterns/hemDefaults";
import {
  calculateRoundNecklineShaping,
  type RoundNecklineShapingResult,
} from "../patterns/legoBlocks/roundNeckline";
import { inchesToRows } from "../patterns/sleevelessRowAccounting";
import {
  consolidateConsecutiveJapaneseNotationLines,
  formatShapingSegment,
} from "../patterns/shapingNotationCompress";
import { distributeTotalAcrossRows } from "../patterns/distributeTotalAcrossRows";
import {
  roundNeckPlanOneSideFullJpLines,
  roundNeckPlanOneSideNeckEdgeJpLines,
} from "../patterns/roundNeckPlanPresentation";
import {
  adjustNecklineStitchesForEvenShoulders,
  rowsPerInchFromGauge,
  stitchesPerInchFromGauge,
} from "./roundNecklinePractice";
import {
  skillBuilderVideoSlot,
  type RoundNecklineSkillBuilderVideoKey,
  type SkillBuilderVideoSlot,
} from "./roundNecklineSkillBuilderVideos";

export const ROUND_NECKLINE_SKILL_BUILDER_PRACTICE = {
  pieceWidthInches: 8,
  rowsBeforeNecklineInches: 2,
  neckOpeningWidthInches: 3.5,
  shallowNeckDepthInches: 1,
  deepNeckDepthInches: 2.5,
  minCastOn: 28,
  maxCastOn: 44,
  minFinalShoulder: 6,
  minNeckOpening: 8,
} as const;

export type RoundNecklineSkillBuilderId =
  | "round-neckline-basics"
  | "round-necklines-shaped-shoulders";

export type RoundNecklineSkillBuilderExerciseId = "shallow-back" | "deep-front";

export type RoundNecklineShoulderStyle = "straight" | "shaped";
export type RoundNecklineDepthKind = "shallow-back" | "deep-front";

export type RoundNecklineSkillBuilderGauge = {
  stitchesPerFourInches: number;
  rowsPerFourInches: number;
};

export type RoundNecklineSkillBuilderExerciseMeta = {
  id: RoundNecklineSkillBuilderExerciseId;
  slug: RoundNecklineSkillBuilderExerciseId;
  title: string;
  /** Exercise-page subtitle; omit to reuse the Skill Builder title. */
  subtitle?: string;
  description: string;
  depthKind: RoundNecklineDepthKind;
};

export type RoundNecklineSkillBuilderMeta = {
  id: RoundNecklineSkillBuilderId;
  title: string;
  purpose: string;
  path: string;
  shoulderStyle: RoundNecklineShoulderStyle;
  prerequisiteNote?: string;
  exercises: RoundNecklineSkillBuilderExerciseMeta[];
};

export const ROUND_NECKLINE_SKILL_BUILDERS: Record<
  RoundNecklineSkillBuilderId,
  RoundNecklineSkillBuilderMeta
> = {
  "round-neckline-basics": {
    id: "round-neckline-basics",
    title: "Round Neckline with Straight Shoulders",
    purpose:
      "Practice round neckline shaping for sweaters with straight shoulders, such as the Drop Shoulder pattern.",
    path: "/learn/skill-builders/round-neckline-basics",
    shoulderStyle: "straight",
    exercises: [
      {
        id: "shallow-back",
        slug: "shallow-back",
        title: "Shallow Back Neckline: Straight Shoulders",
        subtitle: "Shaping with Bind-Offs & Decreases",
        description:
          "Practice the basic round-neck sequence: center neck bind-off, neck-edge bind-offs and decreases, then straight shoulders.",
        depthKind: "shallow-back",
      },
      {
        id: "deep-front",
        slug: "deep-front",
        title: "Deep Front Neckline: Straight Shoulders",
        description:
          "Practice a deeper neckline using the same method, with a longer neck-edge shaping sequence before straight shoulders.",
        depthKind: "deep-front",
      },
    ],
  },
  "round-necklines-shaped-shoulders": {
    id: "round-necklines-shaped-shoulders",
    title: "Round Neckline with Shaped Shoulders",
    purpose:
      "Practice round neckline shaping when the sweater has shaped shoulders, such as the Sleeveless pattern.",
    path: "/learn/skill-builders/round-necklines-shaped-shoulders",
    shoulderStyle: "shaped",
    prerequisiteNote:
      "Complete Round Neckline with Straight Shoulders first if you are new to neckline shaping.",
    exercises: [
      {
        id: "shallow-back",
        slug: "shallow-back",
        title: "Shallow Back Neckline: Shaped Shoulders",
        description:
          "Practice a shallow back neckline while adding stepped bind-offs at the outside shoulder edge.",
        depthKind: "shallow-back",
      },
      {
        id: "deep-front",
        slug: "deep-front",
        title: "Deep Front Neckline: Shaped Shoulders",
        description:
          "Practice a deeper front neckline while coordinating neck-edge shaping and stepped shoulder bind-offs.",
        depthKind: "deep-front",
      },
    ],
  },
};

export const SHOULDER_WORKFLOW_HEADING = "Shape the Shoulders on the Machine";

export const SHOULDER_WORKFLOW_TEACHING_NOTE =
  "At the neckline starting point, reset the row counter to 000. The carriage and working yarn are on the right. Scrap off only the right shoulder before it is shaped. Bind off the center neck stitches loosely on the machine at RC 000; do not scrap them off or rehang them. Keep the left shoulder on the machine and shape it next, without breaking the yarn. Rehang only the right shoulder later, and reset the row counter to 000 again. Do not bind off the center neck a second time.";

export const SHOULDER_WORKFLOW_POINTER =
  "At the neckline starting point, the carriage and working yarn are on the right. Follow the Shape the Shoulders on the Machine steps above.";

export const PAUSE_AND_CHECK_TEXT =
  "Before you rehang the right shoulder, compare the left shoulder to the diagram. Count the remaining shoulder stitches and confirm that the neckline has been shaped at the neck edge. The right shoulder is a mirror image, not the same directions repeated on the same edge.";

export const SAVE_THIS_PRACTICE_PIECE_HEADING = "Save This Practice Piece";

export const SAVE_THIS_PRACTICE_PIECE_NOTE =
  "After each shoulder is complete, scrap off the remaining live stitches onto waste yarn instead of binding them off. Keep these samples for later shoulder-joining and neckband-finishing practice.";

export type SkillBuilderActionStep = {
  action: string;
  text: string;
  count?: string;
};

export type SkillBuilderInstructionPhase = {
  id: "knit" | "first-shoulder" | "mirror-shoulder";
  title: string;
  steps: SkillBuilderActionStep[];
};

export type SkillBuilderDiagramLegendItem = {
  label: string;
  detail: string;
};

export type RoundNecklineSkillBuilderChartRow = {
  step: string;
  rows: string;
  stitches: string;
  detail: string;
  group?: "prep";
};

/**
 * After the lower even section, reset the machine row counter.
 * Neckline and shoulder shaping use this RC (0 displays as 000).
 */
export const SHAPING_ROW_COUNTER_START = 0;

export function formatSkillBuilderRowCounter(row: number): string {
  return String(Math.max(0, Math.round(row))).padStart(3, "0");
}

export type FirstShoulderRowAction = {
  /** Shaping row-counter value after reset to 000 (0 = RC 000). */
  row: number;
  edge: "neck" | "outside" | "even";
  action: string;
  stitchesAfter: number;
};

export type RoundNecklineSkillBuilderResult = {
  builderId: RoundNecklineSkillBuilderId;
  exerciseId: RoundNecklineSkillBuilderExerciseId;
  builderTitle: string;
  exerciseTitle: string;
  purpose: string;
  whatYouArePracticing: string;
  shoulderStyle: RoundNecklineShoulderStyle;
  depthKind: RoundNecklineDepthKind;
  gauge: {
    stitchesPerFourInches: number;
    rowsPerFourInches: number;
    stitchesPerInch: number;
    rowsPerInch: number;
  };
  castOnStitches: number;
  rowsBeforeNeckline: number;
  neckDepthRows: number;
  totalRows: number;
  neckOpeningStitches: number;
  centerBindOffStitches: number;
  firstShoulderSectionStitches: number;
  secondShoulderSectionStitches: number;
  finalShoulderStitches: number;
  neckEdgeBindOffs: number[];
  neckEdgeDecreaseCount: number;
  neckEdgeDecreaseEveryRows: number;
  neckEdgeShapingSpanRows: number;
  outsideShoulderBindOffs: number[];
  outsideShoulderShapingSpanRows: number;
  neckPlan: RoundNecklineShapingResult;
  neckEdgeJpLines: string[];
  necklineJpLines: string[];
  shoulderJpLines: string[];
  firstShoulderRows: FirstShoulderRowAction[];
  prepareHeading: string;
  saveThisPracticePiece: string;
  prepareSteps: SkillBuilderActionStep[];
  instructionPhases: SkillBuilderInstructionPhase[];
  diagramLegend: SkillBuilderDiagramLegendItem[];
  separateSectionsSteps: string[];
  instructionSteps: string[];
  firstShoulderDetailSteps: string[];
  pauseAndCheck: string;
  commonMistakes: string[];
  teachingNote: string;
  shapingChart: RoundNecklineSkillBuilderChartRow[];
  video: SkillBuilderVideoSlot | null;
};

export function getRoundNecklineSkillBuilder(
  builderId: string,
): RoundNecklineSkillBuilderMeta | null {
  if (builderId === "round-neckline-basics" || builderId === "round-necklines-shaped-shoulders") {
    return ROUND_NECKLINE_SKILL_BUILDERS[builderId];
  }
  return null;
}

export function getRoundNecklineSkillBuilderExercise(
  builderId: string,
  exerciseId: string,
): { builder: RoundNecklineSkillBuilderMeta; exercise: RoundNecklineSkillBuilderExerciseMeta } | null {
  const builder = getRoundNecklineSkillBuilder(builderId);
  if (!builder) return null;
  const exercise = builder.exercises.find((item) => item.id === exerciseId);
  if (!exercise) return null;
  return { builder, exercise };
}

export function skillBuilderExercisePath(
  builderId: RoundNecklineSkillBuilderId,
  exerciseId: RoundNecklineSkillBuilderExerciseId,
): string {
  return `${ROUND_NECKLINE_SKILL_BUILDERS[builderId].path}/${exerciseId}`;
}

export type RoundNecklinePracticeChoice = {
  title: string;
  summary: string;
  image: string;
};

export const ROUND_NECKLINE_PRACTICE_CHOICES: Record<
  RoundNecklineSkillBuilderId,
  Record<RoundNecklineSkillBuilderExerciseId, RoundNecklinePracticeChoice>
> = {
  "round-neckline-basics": {
    "shallow-back": {
      title: "Shallow Back Neckline",
      summary: "Basic round-neck shaping with straight shoulders.",
      image: "/images/skill-builders/round-neckline-shallow-straight-shoulders.png",
    },
    "deep-front": {
      title: "Deep Front Neckline",
      summary: "A deeper neckline with a longer neck-edge shaping sequence.",
      image: "/images/skill-builders/round-neckline-deep-straight-shoulders.png",
    },
  },
  "round-necklines-shaped-shoulders": {
    "shallow-back": {
      title: "Shallow Back Neckline",
      summary: "Basic round-neck shaping with stepped shoulder shaping.",
      image: "/images/skill-builders/round-neckline-shallow-shaped-shoulders.png",
    },
    "deep-front": {
      title: "Deep Front Neckline",
      summary: "A deeper neckline with a longer shaping sequence and stepped shoulders.",
      image: "/images/skill-builders/round-neckline-deep-shaped-shoulders.png",
    },
  },
};

export function parseRoundNecklinePracticeId(
  raw: string | null | undefined,
): RoundNecklineSkillBuilderExerciseId | null {
  return raw === "shallow-back" || raw === "deep-front" ? raw : null;
}

export function roundNecklineWorkspaceHref(
  builderId: RoundNecklineSkillBuilderId,
  exerciseId?: RoundNecklineSkillBuilderExerciseId,
): string {
  const path = ROUND_NECKLINE_SKILL_BUILDERS[builderId].path;
  return exerciseId ? `${path}?practice=${exerciseId}` : path;
}

/** Round Neckline Basics stays public; Shaped Shoulders is members only. */
export function roundNecklineSkillBuilderIsMemberOnly(
  builderId: RoundNecklineSkillBuilderId,
): boolean {
  return builderId === "round-necklines-shaped-shoulders";
}

/** Email capture applies only to the free Round Neckline Basics builder. */
export function roundNecklineSkillBuilderRequiresLeadCapture(
  builderId: RoundNecklineSkillBuilderId,
): boolean {
  return !roundNecklineSkillBuilderIsMemberOnly(builderId);
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function plural(n: number, word: string, pluralWord = `${word}s`): string {
  return n === 1 ? word : pluralWord;
}

function compressConsecutiveAmounts(amounts: readonly number[]): { amount: number; times: number }[] {
  const out: { amount: number; times: number }[] = [];
  for (const raw of amounts) {
    const amount = Math.max(0, Math.round(raw));
    if (amount <= 0) continue;
    const last = out[out.length - 1];
    if (last && last.amount === amount) last.times += 1;
    else out.push({ amount, times: 1 });
  }
  return out;
}

function bindOffAtEdgePhrase(
  amounts: readonly number[],
  edge: "neck" | "outside",
): string | null {
  const groups = compressConsecutiveAmounts(amounts);
  if (groups.length === 0) return null;
  const edgeName = edge === "neck" ? "neck edge" : "outside shoulder edge";
  const rowEdgeName = edge === "neck" ? "neck-edge" : "outside-edge";
  return groups
    .map((group, index) => {
      const lead = index === 0 ? `At the ${edgeName}, bind off` : "Then bind off";
      return `${lead} ${group.amount} ${plural(group.amount, "stitch", "stitches")} at the beginning of the next ${group.times} ${rowEdgeName} ${plural(group.times, "row")}.`;
    })
    .join(" ");
}

function decreasePhrase(count: number, everyRows: number): string | null {
  if (count <= 0) return null;
  return `Then decrease 1 stitch at the neck edge every ${everyRows} ${plural(everyRows, "row")} ${count} ${plural(count, "time")}.`;
}

function chunksToJpLines(chunks: readonly number[]): string[] {
  const lines = chunks.filter((n) => n > 0).map((amount) => formatShapingSegment(amount, 2, 1));
  return consolidateConsecutiveJapaneseNotationLines(lines);
}

function countNeckEdgeShapingSpanRows(stairCount: number, decreaseCount: number): number {
  const actions = Math.max(0, stairCount) + Math.max(0, decreaseCount);
  if (actions <= 0) return 1;
  // First neck-edge action at RC 000; then every 2 rows.
  return 2 * actions - 1;
}

function splitNeckEdgeActions(
  stairSteps: readonly number[],
  singleDecreaseCount: number,
): { neckEdgeBindOffs: number[]; neckEdgeDecreaseCount: number } {
  const neckEdgeBindOffs: number[] = [];
  let extraDecreases = 0;
  for (const amount of stairSteps) {
    if (amount <= 1) extraDecreases += Math.max(0, amount);
    else neckEdgeBindOffs.push(amount);
  }
  return {
    neckEdgeBindOffs,
    neckEdgeDecreaseCount: Math.max(0, singleDecreaseCount) + extraDecreases,
  };
}

function neckEdgeActionPhrase(amount: number, kind: "bindOff" | "decrease"): string {
  if (kind === "decrease" || amount <= 1) return "Decrease 1 stitch";
  return `Bind off ${amount} ${plural(amount, "stitch", "stitches")}`;
}

function steppedShoulderBindOffs(shoulderStitches: number, neckDepthRows: number): number[] {
  const sts = Math.max(0, Math.round(shoulderStitches));
  if (sts <= 0) return [];
  const maxSlots = Math.max(2, Math.floor(neckDepthRows / 2));
  let slots = Math.min(4, maxSlots, sts);
  while (slots > 2 && sts / slots < 2) slots -= 1;
  if (sts >= 6) slots = Math.min(slots, 3);
  slots = Math.max(2, slots);
  return distributeTotalAcrossRows(sts, slots).filter((n) => n > 0);
}

function commonMistakesFor(style: RoundNecklineShoulderStyle): string[] {
  const mistakes = [
    "I scrapped off the left shoulder before I shaped it.",
    "I scrapped off or rehung the center neck stitches instead of binding them off on the machine.",
    "I shaped the right shoulder while it was still on the machine. Only the right shoulder is scrapped off first and rehung later.",
    "I bound off the remaining shoulder stitches instead of scrapping them off onto waste yarn.",
    "My two shoulders do not match.",
    "I forgot which edge is the neck edge.",
  ];
  if (style === "shaped") {
    mistakes.splice(
      4,
      0,
      "I finished the neckline first, then shaped the shoulder. Both happen during the same rows.",
    );
  } else {
    mistakes.splice(
      4,
      0,
      "I shaped the outside shoulder edge when I meant to shape the neck edge. This exercise keeps the outside shoulder edge straight.",
    );
  }
  return mistakes;
}

function buildFirstShoulderRows(input: {
  startRow: number;
  sectionStitches: number;
  neckDepthRows: number;
  neckEdgeBindOffs: readonly number[];
  neckEdgeDecreaseCount: number;
  outsideShoulderBindOffs: readonly number[];
}): FirstShoulderRowAction[] {
  const rows: FirstShoulderRowAction[] = [];
  let stitches = input.sectionStitches;
  const neckActions: string[] = [
    ...input.neckEdgeBindOffs.map((amount) => neckEdgeActionPhrase(amount, "bindOff")),
    ...Array.from({ length: input.neckEdgeDecreaseCount }, () =>
      neckEdgeActionPhrase(1, "decrease"),
    ),
  ];
  const outsideActions = input.outsideShoulderBindOffs.map(
    (amount) => `Bind off ${amount} ${plural(amount, "stitch", "stitches")}`,
  );
  const outsideStartLocal =
    outsideActions.length > 0
      ? input.neckDepthRows - (2 * outsideActions.length - 1) + 1
      : Number.POSITIVE_INFINITY;

  let neckActionIndex = 0;
  let outsideActionIndex = 0;

  for (let local = 1; local <= input.neckDepthRows; local += 1) {
    const rc = input.startRow + local - 1;
    const isNeckEdgeRow = local % 2 === 1;
    if (isNeckEdgeRow) {
      const action = neckActions[neckActionIndex];
      if (action) {
        const amount = action.startsWith("Decrease")
          ? 1
          : Number.parseInt(action.replace(/\D+/g, ""), 10) || 0;
        stitches = Math.max(0, stitches - amount);
        neckActionIndex += 1;
        rows.push({
          row: rc,
          edge: "neck",
          action: `${action} at the neck edge.`,
          stitchesAfter: stitches,
        });
      } else {
        rows.push({
          row: rc,
          edge: "even",
          action: "Knit even. Do not shape the neck edge on this row.",
          stitchesAfter: stitches,
        });
      }
    } else {
      const shoulderIsActive = local >= outsideStartLocal;
      const action = shoulderIsActive ? outsideActions[outsideActionIndex] : undefined;
      if (action) {
        const amount = Number.parseInt(action.replace(/\D+/g, ""), 10) || 0;
        stitches = Math.max(0, stitches - amount);
        outsideActionIndex += 1;
        rows.push({
          row: rc,
          edge: "outside",
          action: `${action} at the outside shoulder edge.`,
          stitchesAfter: stitches,
        });
      } else {
        rows.push({
          row: rc,
          edge: "even",
          action: "Knit even. The outside shoulder edge stays straight on this row.",
          stitchesAfter: stitches,
        });
      }
    }
  }

  return rows;
}

function stsLabel(count: number): string {
  return `${count} sts`;
}

function flattenActionStep(step: SkillBuilderActionStep): string {
  const lead = step.action ? `${step.action} ${step.text}` : step.text;
  return step.count ? `${lead} ${step.count}` : lead;
}

function bothEdgesDuringRowsPhrase(input: {
  neckDepthRows: number;
  neckEdgeBindOffs: readonly number[];
  neckEdgeDecreaseCount: number;
  outsideShoulderBindOffs: readonly number[];
}): string {
  const neck = [
    bindOffAtEdgePhrase(input.neckEdgeBindOffs, "neck"),
    decreasePhrase(input.neckEdgeDecreaseCount, 2),
  ]
    .filter(Boolean)
    .join(" ");
  const outside = bindOffAtEdgePhrase(input.outsideShoulderBindOffs, "outside") ?? "";
  return `During the next ${input.neckDepthRows} rows, shape both edges of this shoulder section. ${neck} ${outside}`.replace(
    /\s+/g,
    " ",
  ).trim();
}

function scrapOffCompletedShoulderStep(which: "left" | "right", remainingStitches: number): SkillBuilderActionStep {
  return {
    action: "Scrap off",
    text: `the completed ${which} shoulder stitches onto waste yarn. Do not bind off remaining live stitches.`,
    count: stsLabel(remainingStitches),
  };
}

function edgeOrientationSteps(): SkillBuilderActionStep[] {
  return [
    {
      action: "",
      text: "The inner edge (toward the center) is the neck edge. The outer edge is the outside shoulder edge.",
    },
  ];
}

function neckAndOutsideShapingSteps(input: {
  shoulderStyle: RoundNecklineShoulderStyle;
  neckDepthRows: number;
  neckEdgeBindOffs: readonly number[];
  neckEdgeDecreaseCount: number;
  outsideShoulderBindOffs: readonly number[];
}): SkillBuilderActionStep[] {
  const steps: SkillBuilderActionStep[] = [];
  if (input.shoulderStyle === "shaped") {
    steps.push({
      action: "",
      text: bothEdgesDuringRowsPhrase(input),
    });
    steps.push({
      action: "",
      text: "Neck-edge actions happen when the carriage starts at the neck edge. Outside-shoulder bind-offs happen when the carriage starts at the outside shoulder edge.",
    });
    return steps;
  }

  const bindOffs = bindOffAtEdgePhrase(input.neckEdgeBindOffs, "neck");
  if (bindOffs) steps.push({ action: "", text: bindOffs });
  const decreases = decreasePhrase(input.neckEdgeDecreaseCount, 2);
  if (decreases) steps.push({ action: "", text: decreases });
  steps.push({
    action: "Work even",
    text: "until the shoulder is complete. Do not shape the outside shoulder edge.",
  });
  return steps;
}

function buildPrepareSteps(input: {
  firstShoulderSectionStitches: number;
  centerBindOffStitches: number;
  secondShoulderSectionStitches: number;
}): SkillBuilderActionStep[] {
  const right = input.firstShoulderSectionStitches;
  const left = input.secondShoulderSectionStitches;
  const center = input.centerBindOffStitches;

  return [
    {
      action: "Break",
      text: "the working yarn.",
    },
    {
      action: "Scrap off",
      text: "the right shoulder stitches and remove that shoulder section from the machine.",
      count: stsLabel(right),
    },
    {
      action: "Join",
      text: "working yarn at the center neck edge.",
      count: stsLabel(center),
    },
    {
      action: "Bind off",
      text: "the center neck stitches loosely on the machine at RC 000. Do not scrap off or rehang the center neck. Bind off the center once only; do not repeat it on the second shoulder.",
      count: stsLabel(center),
    },
    {
      action: "",
      text: `The left shoulder stays on the machine (${stsLabel(left)}). Do not scrap it off or rehang it.`,
    },
  ];
}

function buildFirstShoulderPhaseSteps(input: {
  shoulderStyle: RoundNecklineShoulderStyle;
  secondShoulderSectionStitches: number;
  finalShoulderStitches: number;
  neckDepthRows: number;
  neckEdgeBindOffs: readonly number[];
  neckEdgeDecreaseCount: number;
  outsideShoulderBindOffs: readonly number[];
}): SkillBuilderActionStep[] {
  const lastRc = formatSkillBuilderRowCounter(
    SHAPING_ROW_COUNTER_START + Math.max(1, input.neckDepthRows) - 1,
  );
  const steps: SkillBuilderActionStep[] = [
    {
      action: "",
      text: `The row counter is at 000. Shape the left shoulder from RC 000 through RC ${lastRc}. The center neck stitches are already bound off; do not bind them off again.`,
    },
    {
      action: "",
      text: "Without breaking this yarn, shape the left shoulder directly on the machine. The working yarn is at the right-hand neck edge of the left shoulder, where shaping begins.",
      count: stsLabel(input.secondShoulderSectionStitches),
    },
    {
      action: "",
      text: "Do not scrap off or rehang the left shoulder before it is shaped.",
    },
    ...edgeOrientationSteps(),
    ...neckAndOutsideShapingSteps(input),
    scrapOffCompletedShoulderStep("left", input.finalShoulderStitches),
  ];
  return steps;
}

function buildFirstShoulderDetailSteps(input: {
  shoulderStyle: RoundNecklineShoulderStyle;
  secondShoulderSectionStitches: number;
  finalShoulderStitches: number;
  neckDepthRows: number;
  neckEdgeBindOffs: readonly number[];
  neckEdgeDecreaseCount: number;
  outsideShoulderBindOffs: readonly number[];
  firstShoulderRows: readonly FirstShoulderRowAction[];
}): string[] {
  const steps = buildFirstShoulderPhaseSteps(input).map(flattenActionStep);
  if (input.shoulderStyle === "shaped" && input.firstShoulderRows.length > 0) {
    steps.push(
      "Left-shoulder row sequence (both edges): " +
        input.firstShoulderRows
          .map(
            (row) =>
              `RC ${formatSkillBuilderRowCounter(row.row)}: ${row.action} ${row.stitchesAfter} stitches remain.`,
          )
          .join(" "),
    );
  }
  return steps;
}

function buildMirrorShoulderPhaseSteps(input: {
  shoulderStyle: RoundNecklineShoulderStyle;
  firstShoulderSectionStitches: number;
  finalShoulderStitches: number;
  neckDepthRows: number;
}): SkillBuilderActionStep[] {
  const steps: SkillBuilderActionStep[] = [
    {
      action: "Rehang",
      text: "the right shoulder stitches.",
      count: stsLabel(input.firstShoulderSectionStitches),
    },
    {
      action: "Reset",
      text: `the row counter to 000. Follow RC 000 through RC ${formatSkillBuilderRowCounter(SHAPING_ROW_COUNTER_START + Math.max(1, input.neckDepthRows) - 1)} as a reverse of the left shoulder. Do not bind off the center neck stitches again.`,
    },
    {
      action: "Attach",
      text: "working yarn at the neck edge so shaping begins at the neck edge.",
    },
    ...edgeOrientationSteps(),
  ];

  if (input.shoulderStyle === "shaped") {
    steps.push({
      action: "",
      text: `During the same ${input.neckDepthRows} rows, shape both edges as a mirror image of the left shoulder. Neck-edge shaping happens on the inner edge (toward the center). Stepped shoulder bind-offs happen on the outer edge (away from the center). Do not repeat the left shoulder directions on the same physical edge.`,
    });
    steps.push({
      action: "",
      text: "Neck-edge actions happen when the carriage starts at the neck edge. Outside-shoulder bind-offs happen when the carriage starts at the outside shoulder edge.",
    });
  } else {
    steps.push({
      action: "Shape",
      text: "it as a mirror image of the left shoulder. Do not repeat the left shoulder directions on the same physical edge.",
    });
    steps.push({
      action: "Work even",
      text: "until the shoulder is complete. Do not shape the outside shoulder edge.",
    });
  }

  steps.push(scrapOffCompletedShoulderStep("right", input.finalShoulderStitches));
  return steps;
}

function buildInstructionPhases(input: {
  castOnStitches: number;
  rowsBeforeNeckline: number;
  firstShoulderPhaseSteps: readonly SkillBuilderActionStep[];
  mirrorShoulderPhaseSteps: readonly SkillBuilderActionStep[];
}): SkillBuilderInstructionPhase[] {
  return [
    {
      id: "knit",
      title: "1. Knit the Practice Piece",
      steps: [
        {
          action: "Cast on",
          text: "the practice piece.",
          count: stsLabel(input.castOnStitches),
        },
        {
          action: "Knit",
          text: `${input.rowsBeforeNeckline} rows even.`,
        },
        {
          action: "Reset",
          text: "the row counter to 000.",
        },
        {
          action: "",
          text: SHOULDER_WORKFLOW_POINTER,
        },
      ],
    },
    {
      id: "first-shoulder",
      title: "2. Shape the Left Shoulder",
      steps: [...input.firstShoulderPhaseSteps],
    },
    {
      id: "mirror-shoulder",
      title: "3. Shape the Right Shoulder",
      steps: [...input.mirrorShoulderPhaseSteps],
    },
  ];
}

function buildInstructionSteps(phases: readonly SkillBuilderInstructionPhase[]): string[] {
  return phases.flatMap((phase) => phase.steps.map(flattenActionStep));
}

function chartKeyDetail(input: {
  centerBindOffStitches: number;
  neckEdgeBindOffs: readonly number[];
  neckEdgeDecreaseCount: number;
  finalShoulderStitches: number;
  shoulderStyle: RoundNecklineShoulderStyle;
  outsideShoulderBindOffs: readonly number[];
}): string {
  const parts = [`Bind off center ${input.centerBindOffStitches} sts`];
  for (const amount of input.neckEdgeBindOffs) {
    parts.push(`BO ${amount}`);
  }
  if (input.neckEdgeDecreaseCount > 0) {
    parts.push(
      input.neckEdgeDecreaseCount === 1
        ? "Dec 1"
        : `Dec 1 × ${input.neckEdgeDecreaseCount}`,
    );
  }
  if (input.shoulderStyle === "shaped") {
    for (const amount of input.outsideShoulderBindOffs) {
      parts.push(`BO ${amount} outside`);
    }
  } else {
    parts.push(`${input.finalShoulderStitches} sts remain at the shoulder`);
  }
  return parts.join(" · ");
}

function buildDiagramLegend(input: {
  neckDepthRows: number;
  shoulderStyle: RoundNecklineShoulderStyle;
  depthKind: RoundNecklineDepthKind;
  centerBindOffStitches: number;
  neckEdgeBindOffs: readonly number[];
  neckEdgeDecreaseCount: number;
  finalShoulderStitches: number;
  outsideShoulderBindOffs: readonly number[];
}): SkillBuilderDiagramLegendItem[] {
  const items: SkillBuilderDiagramLegendItem[] = [
    {
      label: "Right shoulder",
      detail: "scrap off first, then rehang to shape",
    },
    {
      label: "Center neck",
      detail: "bind off loosely on the machine; never scrap off or rehang",
    },
    {
      label: "Left shoulder",
      detail: "stays on the machine and is shaped after the center bind-off",
    },
  ];
  items.push({
    label: "Chart key",
    detail: chartKeyDetail(input),
  });
  if (input.shoulderStyle === "shaped") {
    items.push({
      label: "Neckline depth & shoulder slope",
      detail:
        input.depthKind === "shallow-back"
          ? `same ${input.neckDepthRows} rows (1 inch)`
          : `both edges are shaped during these ${input.neckDepthRows} neckline rows`,
    });
  }
  return items;
}

function buildShapingChart(input: {
  castOnStitches: number;
  rowsBeforeNeckline: number;
  firstShoulderSectionStitches: number;
  centerBindOffStitches: number;
  secondShoulderSectionStitches: number;
  neckDepthRows: number;
  neckEdgeBindOffs: readonly number[];
  neckEdgeDecreaseCount: number;
  neckEdgeShapingSpanRows: number;
  finalShoulderStitches: number;
  shoulderStyle: RoundNecklineShoulderStyle;
  outsideShoulderBindOffs: readonly number[];
}): RoundNecklineSkillBuilderChartRow[] {
  const neckBindOffDetail = bindOffAtEdgePhrase(input.neckEdgeBindOffs, "neck") ?? "None";
  const decreaseDetail =
    decreasePhrase(input.neckEdgeDecreaseCount, 2) ?? "No neck-edge decreases";
  const rows: RoundNecklineSkillBuilderChartRow[] = [
    {
      step: "Cast on",
      rows: "-",
      stitches: String(input.castOnStitches),
      detail: "Full practice piece width",
    },
    {
      step: "Knit even",
      rows: String(input.rowsBeforeNeckline),
      stitches: String(input.castOnStitches),
      detail: "Lower practice piece before neckline shaping. Not shown on the shaping-chart row axis.",
    },
    {
      step: "Reset row counter",
      rows: formatSkillBuilderRowCounter(SHAPING_ROW_COUNTER_START),
      stitches: "-",
      detail:
        "Reset to 000 before neckline shaping. Use this RC for the first shoulder, then reset to 000 again for the second shoulder.",
    },
    {
      step: "Right shoulder",
      rows: "-",
      stitches: String(input.firstShoulderSectionStitches),
      detail:
        "Scrap off unshaped, then rehang later to shape as a mirror image. Scrap off completed stitches onto waste yarn.",
      group: "prep",
    },
    {
      step: "Center neck",
      rows: formatSkillBuilderRowCounter(SHAPING_ROW_COUNTER_START),
      stitches: String(input.centerBindOffStitches),
      detail:
        "Bind off loosely on the machine at RC 000, once, before the first shoulder. Do not scrap off or rehang. Do not repeat for the second shoulder.",
      group: "prep",
    },
    {
      step: "Left shoulder",
      rows: "-",
      stitches: String(input.secondShoulderSectionStitches),
      detail:
        "Keep on the machine. Shape immediately after the center bind-off, then scrap off completed stitches onto waste yarn.",
      group: "prep",
    },
    {
      step: "Neck-edge bind-offs",
      rows:
        input.neckEdgeBindOffs.length > 0
          ? formatSkillBuilderRowCounter(SHAPING_ROW_COUNTER_START)
          : "-",
      stitches: String(input.neckEdgeBindOffs.reduce((sum, n) => sum + n, 0)),
      detail:
        input.neckEdgeBindOffs.length > 0
          ? `${neckBindOffDetail} First neck-edge bind-off is at RC 000, at the start of first-shoulder shaping.`
          : neckBindOffDetail,
    },
    {
      step: "Neck-edge decreases",
      rows:
        input.neckEdgeDecreaseCount > 0
          ? formatSkillBuilderRowCounter(
              SHAPING_ROW_COUNTER_START + 2 * input.neckEdgeBindOffs.length,
            )
          : "-",
      stitches: String(input.neckEdgeDecreaseCount),
      detail: decreaseDetail,
    },
    {
      step: "Neckline depth",
      rows: String(input.neckDepthRows),
      stitches: "-",
      detail:
        input.shoulderStyle === "shaped"
          ? "Shape both edges during these rows. Neck-edge bind-offs/decreases at the neck edge; stepped shoulder bind-offs at the outside edge."
          : "Rows in the neckline area on each shoulder",
    },
  ];

  if (input.shoulderStyle === "shaped") {
    rows.push({
      step: "Outside shoulder bind-offs",
      rows: String(input.outsideShoulderBindOffs.length * 2 - 1),
      stitches: String(input.finalShoulderStitches),
      detail: `${bindOffAtEdgePhrase(input.outsideShoulderBindOffs, "outside") ?? "Stepped bind-offs at the outside shoulder edge"} Worked during the same rows as the neckline depth, not after it.`,
    });
  } else {
    rows.push({
      step: "Straight shoulder",
      rows: "1",
      stitches: String(input.finalShoulderStitches),
      detail: `Work even, then scrap off the remaining ${input.finalShoulderStitches} live shoulder stitches onto waste yarn. Do not bind them off. Outside edge stays straight.`,
    });
  }

  return rows;
}

export function calculateRoundNecklineSkillBuilder(
  gauge: RoundNecklineSkillBuilderGauge,
  builderId: RoundNecklineSkillBuilderId,
  exerciseId: RoundNecklineSkillBuilderExerciseId,
): RoundNecklineSkillBuilderResult | null {
  const spec = getRoundNecklineSkillBuilderExercise(builderId, exerciseId);
  if (!spec) return null;

  const spi = stitchesPerInchFromGauge(gauge.stitchesPerFourInches);
  const rpi = rowsPerInchFromGauge(gauge.rowsPerFourInches);
  if (spi <= 0 || rpi <= 0) return null;

  const { builder, exercise } = spec;
  const dims = ROUND_NECKLINE_SKILL_BUILDER_PRACTICE;
  const shoulderStyle = builder.shoulderStyle;

  let castOnStitches = clamp(
    Math.round(dims.pieceWidthInches * spi),
    dims.minCastOn,
    dims.maxCastOn,
  );
  if (castOnStitches % 2 !== 0) castOnStitches += 1;

  let neckOpeningStitches = adjustNecklineStitchesForEvenShoulders(
    castOnStitches,
    Math.round(dims.neckOpeningWidthInches * spi),
  );
  neckOpeningStitches = clamp(
    neckOpeningStitches,
    dims.minNeckOpening,
    castOnStitches - 2 * dims.minFinalShoulder,
  );
  neckOpeningStitches = adjustNecklineStitchesForEvenShoulders(castOnStitches, neckOpeningStitches);

  let finalShoulderStitches = Math.floor((castOnStitches - neckOpeningStitches) / 2);
  if (finalShoulderStitches < dims.minFinalShoulder) {
    neckOpeningStitches = adjustNecklineStitchesForEvenShoulders(
      castOnStitches,
      castOnStitches - 2 * dims.minFinalShoulder,
    );
    finalShoulderStitches = Math.floor((castOnStitches - neckOpeningStitches) / 2);
  }

  const neckPlan = calculateRoundNecklineShaping({ necklineStitches: neckOpeningStitches });
  const centerBindOffStitches = neckPlan.centerBindOff;
  const { neckEdgeBindOffs, neckEdgeDecreaseCount } = splitNeckEdgeActions(
    neckPlan.right.stairSteps,
    neckPlan.right.singleDecreaseCount,
  );
  const neckEdgeShapingSpanRows = countNeckEdgeShapingSpanRows(
    neckEdgeBindOffs.length,
    neckEdgeDecreaseCount,
  );
  const neckEdgeRemovals =
    neckEdgeBindOffs.reduce((sum, n) => sum + n, 0) + neckEdgeDecreaseCount;
  const firstShoulderSectionStitches = finalShoulderStitches + neckEdgeRemovals;
  const secondShoulderSectionStitches = firstShoulderSectionStitches;

  if (
    firstShoulderSectionStitches + centerBindOffStitches + secondShoulderSectionStitches !==
    castOnStitches
  ) {
    return null;
  }

  const rowsBeforeNeckline = roundUpToEvenRows(
    Math.max(8, inchesToRows(dims.rowsBeforeNecklineInches, rpi)),
  );
  const targetDepthInches =
    exercise.depthKind === "shallow-back" ? dims.shallowNeckDepthInches : dims.deepNeckDepthInches;
  let neckDepthRows = roundUpToEvenRows(Math.max(6, inchesToRows(targetDepthInches, rpi)));

  const outsideShoulderBindOffs =
    shoulderStyle === "shaped" ? steppedShoulderBindOffs(finalShoulderStitches, neckDepthRows) : [];
  const outsideShoulderShapingSpanRows =
    outsideShoulderBindOffs.length > 0 ? 2 * outsideShoulderBindOffs.length - 1 : 0;

  const neededRows = Math.max(neckEdgeShapingSpanRows, outsideShoulderShapingSpanRows);
  neckDepthRows = roundUpToEvenRows(Math.max(neckDepthRows, neededRows, 6));

  if (exercise.depthKind === "shallow-back") {
    const deepFloor = roundUpToEvenRows(
      Math.max(6, inchesToRows(dims.deepNeckDepthInches, rpi), neededRows + 4),
    );
    if (neckDepthRows >= deepFloor) {
      neckDepthRows = Math.max(6, deepFloor - 4);
      neckDepthRows = roundUpToEvenRows(neckDepthRows);
    }
  }

  const firstShoulderRows = buildFirstShoulderRows({
    startRow: SHAPING_ROW_COUNTER_START,
    sectionStitches: firstShoulderSectionStitches,
    neckDepthRows,
    neckEdgeBindOffs,
    neckEdgeDecreaseCount,
    outsideShoulderBindOffs,
  });

  const prepareHeading = SHOULDER_WORKFLOW_HEADING;
  const teachingNote = SHOULDER_WORKFLOW_TEACHING_NOTE;
  const pauseAndCheck = PAUSE_AND_CHECK_TEXT;

  const prepareSteps = buildPrepareSteps({
    firstShoulderSectionStitches,
    centerBindOffStitches,
    secondShoulderSectionStitches,
  });
  const separateSectionsSteps = prepareSteps.map(flattenActionStep);
  const firstShoulderPhaseSteps = buildFirstShoulderPhaseSteps({
    shoulderStyle,
    secondShoulderSectionStitches,
    finalShoulderStitches,
    neckDepthRows,
    neckEdgeBindOffs,
    neckEdgeDecreaseCount,
    outsideShoulderBindOffs,
  });
  const firstShoulderDetailSteps = buildFirstShoulderDetailSteps({
    shoulderStyle,
    secondShoulderSectionStitches,
    finalShoulderStitches,
    neckDepthRows,
    neckEdgeBindOffs,
    neckEdgeDecreaseCount,
    outsideShoulderBindOffs,
    firstShoulderRows,
  });
  const mirrorShoulderPhaseSteps = buildMirrorShoulderPhaseSteps({
    shoulderStyle,
    firstShoulderSectionStitches,
    finalShoulderStitches,
    neckDepthRows,
  });
  const instructionPhases = buildInstructionPhases({
    castOnStitches,
    rowsBeforeNeckline,
    firstShoulderPhaseSteps,
    mirrorShoulderPhaseSteps,
  });
  const instructionSteps = buildInstructionSteps(instructionPhases);
  const necklineJpLines = roundNeckPlanOneSideFullJpLines(neckPlan, "right");
  const neckEdgeJpLines = roundNeckPlanOneSideNeckEdgeJpLines(neckPlan, "right");
  const shoulderJpLines = chunksToJpLines(outsideShoulderBindOffs);
  const diagramLegend = buildDiagramLegend({
    neckDepthRows,
    shoulderStyle,
    depthKind: exercise.depthKind,
    centerBindOffStitches,
    neckEdgeBindOffs,
    neckEdgeDecreaseCount,
    finalShoulderStitches,
    outsideShoulderBindOffs,
  });

  const videoKey = `${builderId}/${exerciseId}` as RoundNecklineSkillBuilderVideoKey;

  return {
    builderId,
    exerciseId,
    builderTitle: builder.title,
    exerciseTitle: exercise.title,
    purpose: builder.purpose,
    whatYouArePracticing: exercise.description,
    shoulderStyle,
    depthKind: exercise.depthKind,
    gauge: {
      stitchesPerFourInches: gauge.stitchesPerFourInches,
      rowsPerFourInches: gauge.rowsPerFourInches,
      stitchesPerInch: spi,
      rowsPerInch: rpi,
    },
    castOnStitches,
    rowsBeforeNeckline,
    neckDepthRows,
    totalRows: rowsBeforeNeckline + neckDepthRows,
    neckOpeningStitches,
    centerBindOffStitches,
    firstShoulderSectionStitches,
    secondShoulderSectionStitches,
    finalShoulderStitches,
    neckEdgeBindOffs,
    neckEdgeDecreaseCount,
    neckEdgeDecreaseEveryRows: 2,
    neckEdgeShapingSpanRows,
    outsideShoulderBindOffs,
    outsideShoulderShapingSpanRows,
    neckPlan,
    neckEdgeJpLines,
    necklineJpLines,
    shoulderJpLines,
    firstShoulderRows,
    prepareHeading,
    prepareSteps,
    instructionPhases,
    diagramLegend,
    separateSectionsSteps,
    instructionSteps,
    firstShoulderDetailSteps,
    pauseAndCheck,
    commonMistakes: commonMistakesFor(shoulderStyle),
    teachingNote,
    saveThisPracticePiece: SAVE_THIS_PRACTICE_PIECE_NOTE,
    shapingChart: buildShapingChart({
      castOnStitches,
      rowsBeforeNeckline,
      firstShoulderSectionStitches,
      centerBindOffStitches,
      secondShoulderSectionStitches,
      neckDepthRows,
      neckEdgeBindOffs,
      neckEdgeDecreaseCount,
      neckEdgeShapingSpanRows,
      finalShoulderStitches,
      shoulderStyle,
      outsideShoulderBindOffs,
    }),
    video: skillBuilderVideoSlot(videoKey),
  };
}
