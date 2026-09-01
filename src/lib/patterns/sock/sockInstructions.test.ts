import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  calculateBasicSockPattern,
  calculateShortRowShaping,
  type BasicSockCalc,
  type BasicSockCalcInput,
} from "./sockMath";
import {
  SOCK_SHORT_ROW_WRAP_WARNING,
  SOCK_TOE_FINISHING_DEFAULT,
  SOCK_TOE_UP_OPENING_SECTION_TITLE,
  SCRAP_AND_RAVEL_CAST_ON_GLOSSARY_ID,
  SCRAP_AND_RAVEL_CAST_ON_GLOSSARY_TERM,
  SOCK_ANKLE_VIDEO_PRIVACY_HASH,
  SOCK_ANKLE_VIDEO_TIP_ID,
  SOCK_ANKLE_VIDEO_TITLE,
  SOCK_ANKLE_VIDEO_VIMEO_ID,
  SOCK_CUFF_CAST_ON_VIDEO_TIP_ID,
  SOCK_CUFF_CAST_ON_VIDEO_TITLE,
  SOCK_CUFF_CAST_ON_VIDEO_VIMEO_ID,
  SOCK_HEEL_VIDEO_PRIVACY_HASH,
  SOCK_HEEL_VIDEO_TIP_ID,
  SOCK_HEEL_VIDEO_TITLE,
  SOCK_HEEL_VIDEO_VIMEO_ID,
  SOCK_TOE_FINISHING_VIDEO_PRIVACY_HASH,
  SOCK_TOE_FINISHING_VIDEO_TIP_ID,
  SOCK_TOE_FINISHING_VIDEO_TITLE,
  SOCK_TOE_FINISHING_VIDEO_VIMEO_ID,
  SOCK_TOE_VIDEO_PRIVACY_HASH,
  SOCK_TOE_VIDEO_TIP_ID,
  SOCK_TOE_VIDEO_TITLE,
  SOCK_TOE_VIDEO_VIMEO_ID,
  SOCK_WHY_STOP_ROW_COUNTER_BODY,
  SOCK_WHY_STOP_ROW_COUNTER_TIP_ID,
  SOCK_WHY_STOP_ROW_COUNTER_TITLE,
  SOCK_SECOND_SOCK_INTRO,
  sockEnsureCarriageInstruction,
  SOCK_FINISH_THE_TOE_HEADING,
  SOCK_CHOOSE_TOE_FINISHING_HEADING,
  SOCK_REHANG_AND_JOIN_LABEL,
  SOCK_GRAFT_OR_SEAM_LABEL,
  SOCK_FOLD_RIGHT_SIDES_INSTRUCTION,
  sockRehangToeInstruction,
  SOCK_GRAFT_OR_SEAM_INSTRUCTION_PREFIX,
  SOCK_GRAFT_OR_SEAM_INSTRUCTION_SUFFIX,
  buildBasicSockInstructionPair,
  buildBasicSockInstructions,
  buildSockShortRowInstructionSection,
  formatSockInstructionOutline,
  renderBasicSockInstructionsHtml,
  sockHoldOrientation,
  sockInstructionSectionIds,
  type SockInstructionDocument,
  type SockInstructionSection,
  type SockInstructionSectionId,
  type SockInstructionStep,
} from "./sockInstructions";
import {
  BICKFORD_SEAM_GLOSSARY_ID,
  BICKFORD_SEAM_GLOSSARY_TERM,
  KITCHENER_STITCH_GLOSSARY_ID,
  KITCHENER_STITCH_GLOSSARY_TERM,
} from "./sockInstructionRender";
import {
  RESET_ROW_COUNTER_TEXT,
  RESTART_ROW_COUNTER_TEXT,
  STOP_ROW_COUNTER_TEXT,
  formatRowCounterResetGarmentRcLabel,
} from "../rowCounterReset";
import glossary from "../../../data/glossary.json";
import { glossarySlugForId } from "../../glossary/glossaryTooltipHydrate";

const typicalMachine: BasicSockCalcInput = {
  footCircumferenceInches: 8.5,
  footLengthInches: 9,
  legCircumferenceInches: 8.5,
  legLengthInches: 4.5,
  stitchGaugeDisplay: 28,
  rowGaugeDisplay: 40,
  displayUnit: "inches",
  constructionDirection: "cuff-to-toe",
};

const widerLeg: BasicSockCalcInput = {
  ...typicalMachine,
  legCircumferenceInches: 10,
};

const narrowerLeg: BasicSockCalcInput = {
  ...typicalMachine,
  legCircumferenceInches: 7,
};

const baby: BasicSockCalcInput = {
  footCircumferenceInches: 4,
  footLengthInches: 3.5,
  legCircumferenceInches: 4,
  legLengthInches: 2.5,
  stitchGaugeDisplay: 28,
  rowGaugeDisplay: 40,
  displayUnit: "inches",
  constructionDirection: "cuff-to-toe",
};

const child: BasicSockCalcInput = {
  footCircumferenceInches: 6.5,
  footLengthInches: 6,
  legCircumferenceInches: 6.5,
  legLengthInches: 3.5,
  stitchGaugeDisplay: 28,
  rowGaugeDisplay: 40,
  displayUnit: "inches",
  constructionDirection: "cuff-to-toe",
};

function mustCalc(input: BasicSockCalcInput): BasicSockCalc {
  const result = calculateBasicSockPattern(input);
  expect(result.ok, result.ok ? "" : result.errors.join("; ")).toBe(true);
  if (!result.ok) throw new Error(result.errors.join("; "));
  return result.calc;
}

function section(doc: SockInstructionDocument, id: SockInstructionSectionId): SockInstructionSection {
  const found = doc.sections.find((entry) => entry.id === id);
  expect(found, `missing section ${id}`).toBeTruthy();
  return found!;
}

function sectionHtml(html: string, id: SockInstructionSectionId): string {
  const match = html.match(
    new RegExp(`<section class="sock-pattern-section" data-section-id="${id}">[\\s\\S]*?</section>`),
  );
  expect(match, `missing rendered section ${id}`).toBeTruthy();
  return match![0];
}

function stepTypes(entry: SockInstructionSection): SockInstructionStep["type"][] {
  return entry.steps.map((step) => step.type);
}

function assertStitchContinuity(doc: SockInstructionDocument): void {
  for (let i = 1; i < doc.sections.length; i++) {
    const prev = doc.sections[i - 1]!;
    const next = doc.sections[i]!;
    expect(next.startStitches, `${prev.id} → ${next.id}`).toBe(prev.endStitches);
  }
}

function assertPositiveKnitRows(doc: SockInstructionDocument): void {
  for (const entry of doc.sections) {
    if (entry.id === "cast-on" || entry.id === "finishing") {
      expect(entry.rowsToKnit).toBe(0);
      continue;
    }
    expect(entry.rowsToKnit, entry.id).toBeGreaterThan(0);
    expect(entry.rc.endRc).toBe(entry.rowsToKnit);
    const continuesFromPriorCount =
      (entry.id === "ankle" && entry.constructionDirection === "cuff-to-toe") ||
      (entry.id === "toe" && entry.constructionDirection === "cuff-to-toe");
    if (entry.id === "toe" && entry.constructionDirection === "cuff-to-toe") {
      expect(entry.rc.startRc).toBe(section(doc, "foot").rc.endRc);
    } else {
      expect(entry.rc.startRc).toBe(0);
    }
    expect(entry.rc.resetAtStart).toBe(!continuesFromPriorCount);
  }
}

function assertAnkleAndFootOnce(doc: SockInstructionDocument): void {
  expect(doc.sections.filter((entry) => entry.id === "ankle")).toHaveLength(1);
  expect(doc.sections.filter((entry) => entry.id === "foot")).toHaveLength(1);
  expect(doc.sections.filter((entry) => entry.id === "heel")).toHaveLength(1);
  expect(doc.sections.filter((entry) => entry.id === "toe")).toHaveLength(1);
}

function assertShortRowUsesApprovedCounts(
  calc: BasicSockCalc,
  doc: SockInstructionDocument,
): void {
  const heel = section(doc, "heel");
  const toe = section(doc, "toe");
  const foot = section(doc, "foot");
  expect(heel.rowsToKnit).toBe(calc.heel.shortRowKnittingRows);
  expect(toe.rowsToKnit).toBe(calc.toe.shortRowKnittingRows);
  expect(heel.physicalDepthRows).toBe(calc.heel.shortRowDepthRows);
  expect(toe.physicalDepthRows).toBe(calc.toe.shortRowDepthRows);
  expect(heel.physicalDepthRows).not.toBe(heel.rowsToKnit);
  expect(foot.rowsToKnit).toBe(calc.straightFootRows);
  expect(foot.rowsToKnit).not.toBe(
    calc.heel.shortRowKnittingRows + calc.toe.shortRowKnittingRows,
  );
  expect(foot.rowsToKnit).not.toBe(calc.heel.shortRowDepthRows + calc.toe.shortRowDepthRows);
}

function magicStep(doc: SockInstructionDocument) {
  const leg = section(doc, "leg");
  const found = leg.steps.find((step) => step.type === "magic-formula");
  expect(found, "expected Magic Formula step on leg").toBeTruthy();
  return found as Extract<SockInstructionStep, { type: "magic-formula" }>;
}

function shortRowIn(entry: SockInstructionSection) {
  const found = entry.steps.find((step) => step.type === "short-row-in");
  expect(found).toBeTruthy();
  return found as Extract<SockInstructionStep, { type: "short-row-in" }>;
}

function shortRowOut(entry: SockInstructionSection) {
  const found = entry.steps.find((step) => step.type === "short-row-out");
  expect(found).toBeTruthy();
  return found as Extract<SockInstructionStep, { type: "short-row-out" }>;
}

function placeHold(entry: SockInstructionSection) {
  const found = entry.steps.find((step) => step.type === "place-hold");
  expect(found).toBeTruthy();
  return found as Extract<SockInstructionStep, { type: "place-hold" }>;
}

describe("sockHoldOrientation", () => {
  it("puts Sock 1 heel and toe on the RIGHT side of the bed", () => {
    expect(sockHoldOrientation(1, "heel")).toMatchObject({
      holdHalf: "left",
      workHalf: "right",
      carriageStartSide: "right",
    });
    expect(sockHoldOrientation(1, "toe")).toMatchObject({
      holdHalf: "left",
      workHalf: "right",
      carriageStartSide: "right",
    });
  });

  it("puts Sock 2 heel and toe on the LEFT side of the bed", () => {
    expect(sockHoldOrientation(2, "heel")).toMatchObject({
      holdHalf: "right",
      workHalf: "left",
      carriageStartSide: "left",
    });
    expect(sockHoldOrientation(2, "toe")).toMatchObject({
      holdHalf: "right",
      workHalf: "left",
      carriageStartSide: "left",
    });
  });
});

describe("A. Woman Medium straight leg, Cuff to Toe", () => {
  const calc = mustCalc(typicalMachine);
  const sock1 = buildBasicSockInstructions(calc, 1);
  const sock2 = buildBasicSockInstructions(calc, 2);

  it("uses cuff-to-toe section order with one ankle and one foot", () => {
    expect(sockInstructionSectionIds(sock1)).toEqual([
      "cast-on",
      "leg",
      "ankle",
      "heel",
      "foot",
      "toe",
      "finishing",
    ]);
    expect(sockInstructionSectionIds(sock2)).toEqual(sockInstructionSectionIds(sock1));
    assertAnkleAndFootOnce(sock1);
    assertStitchContinuity(sock1);
    assertPositiveKnitRows(sock1);
    expect(section(sock1, "cast-on").endStitches).toBe(calc.legStitches);
    expect(section(sock1, "leg").steps.some((step) => step.type === "reset-rc")).toBe(false);
    expect(section(sock1, "leg").steps.some((step) => step.type === "knit-even")).toBe(true);
    expect(section(sock1, "leg").steps.some((step) => step.type === "magic-formula")).toBe(
      false,
    );
    expect(section(sock1, "ankle").rowsToKnit).toBe(calc.ankleStraightRows);
    expect(section(sock1, "foot").rowsToKnit).toBe(calc.straightFootRows);
  });

  it("orients Sock 1 and Sock 2 as a mirrored pair on the same bed side for heel and toe", () => {
    expect(section(sock1, "heel").orientation).toMatchObject({
      holdHalf: "left",
      workHalf: "right",
      carriageStartSide: "right",
    });
    expect(section(sock1, "toe").orientation).toMatchObject({
      holdHalf: "left",
      workHalf: "right",
      carriageStartSide: "right",
    });
    expect(section(sock2, "heel").orientation).toMatchObject({
      holdHalf: "right",
      workHalf: "left",
      carriageStartSide: "left",
    });
    expect(section(sock2, "toe").orientation).toMatchObject({
      holdHalf: "right",
      workHalf: "left",
      carriageStartSide: "left",
    });
    expect(sock1.toeFinishingVariation).toBe(SOCK_TOE_FINISHING_DEFAULT);
    expect(stepTypes(section(sock1, "finishing"))).toEqual([
      "waste-yarn",
      "drop-from-machine",
      "fold-right-sides-together",
      "rehang-toe",
      "bind-off-toe-seam",
      "seam",
      "block",
      "mirror-second-sock",
    ]);
    expect(stepTypes(section(sock2, "finishing"))).toEqual([
      "waste-yarn",
      "drop-from-machine",
      "fold-right-sides-together",
      "rehang-toe",
      "bind-off-toe-seam",
      "seam",
      "block",
    ]);
    expect(section(sock1, "finishing").steps.some((step) => step.type === "kitchener")).toBe(
      false,
    );
  });

  it("uses the shared short-row primitive without treating in+out as foot length", () => {
    assertShortRowUsesApprovedCounts(calc, sock1);
    expect(stepTypes(section(sock1, "heel"))).toEqual([
      "stop-rc",
      "ensure-carriage",
      "place-hold",
      "short-row-in",
      "short-row-wrap-warning",
      "short-row-out",
      "cancel-hold-return",
    ]);
    expect(stepTypes(section(sock1, "toe"))).toEqual([
      "stop-rc",
      "place-hold",
      "short-row-in",
      "short-row-wrap-warning",
      "short-row-out",
      "cancel-hold-return",
    ]);
    expect(calc.heel).toEqual(calc.toe);
  });
});

describe("carriage position is checked immediately before the first short-row section", () => {
  const emptyPassLanguage = [
    "remove the yarn from the feeder",
    "without knitting",
    "empty pass",
    "free pass",
  ];
  const firstKnitRowWording = "Begin the first knitted row with the carriage";

  function assertNoCastOnCarriageSide(html: string): void {
    const castOn = sectionHtml(html, "cast-on");
    expect(castOn).not.toContain(firstKnitRowWording);
    expect(castOn).not.toContain("carriage on the RIGHT");
    expect(castOn).not.toContain("carriage on the LEFT");
    expect(castOn).not.toContain("If necessary, knit 1 additional row");
  }

  function assertCalculatedRowsMatchPair(
    calc: BasicSockCalc,
    pair: ReturnType<typeof buildBasicSockInstructionPair>,
  ): void {
    for (const doc of [pair.sock1, pair.sock2]) {
      expect(section(doc, "cast-on").rowsToKnit).toBe(0);
      expect(section(doc, "cast-on").steps.some((step) => step.type === "knit-even")).toBe(false);
      expect(section(doc, "leg").rowsToKnit).toBe(calc.legShapingRowsAvailable);
      expect(section(doc, "ankle").rowsToKnit).toBe(calc.ankleStraightRows);
      expect(section(doc, "ankle").notes).toEqual([]);
      expect(section(doc, "foot").rowsToKnit).toBe(calc.straightFootRows);
      expect(section(doc, "heel").rowsToKnit).toBe(calc.heel.shortRowKnittingRows);
      expect(section(doc, "toe").rowsToKnit).toBe(calc.toe.shortRowKnittingRows);
      expect(section(doc, "heel").rc.endRc).toBe(calc.heel.shortRowKnittingRows);
      expect(section(doc, "toe").rc.endRc).toBe(calc.toe.shortRowKnittingRows);
    }
    expect(section(pair.sock2, "ankle").rowsToKnit).toBe(section(pair.sock1, "ankle").rowsToKnit);
    expect(section(pair.sock2, "leg").rowsToKnit).toBe(section(pair.sock1, "leg").rowsToKnit);
    expect(section(pair.sock2, "foot").rowsToKnit).toBe(section(pair.sock1, "foot").rowsToKnit);
    expect(section(pair.sock2, "heel").rowsToKnit).toBe(section(pair.sock1, "heel").rowsToKnit);
    expect(section(pair.sock2, "toe").rowsToKnit).toBe(section(pair.sock1, "toe").rowsToKnit);
  }

  it("does not assume a cast-on carriage side for either sock", () => {
    expect(sockEnsureCarriageInstruction("heel", "right")).toBe(
      "Before beginning the heel, make sure the carriage is on the RIGHT. If necessary, knit 1 additional row. Do not count this setup row on the row counter.",
    );
    expect(sockEnsureCarriageInstruction("heel", "left")).toBe(
      "Before beginning the heel, make sure the carriage is on the LEFT. If necessary, knit 1 additional row. Do not count this setup row on the row counter.",
    );
    expect(sockEnsureCarriageInstruction("toe", "right")).toBe(
      "Before beginning the toe, make sure the carriage is on the RIGHT. If necessary, knit 1 additional row. Do not count this setup row on the row counter.",
    );
    expect(sockEnsureCarriageInstruction("toe", "left")).toBe(
      "Before beginning the toe, make sure the carriage is on the LEFT. If necessary, knit 1 additional row. Do not count this setup row on the row counter.",
    );
    for (const constructionDirection of ["cuff-to-toe", "toe-up"] as const) {
      const pair = buildBasicSockInstructionPair(
        mustCalc({ ...typicalMachine, constructionDirection }),
      );
      for (const doc of [pair.sock1, pair.sock2]) {
        const html = renderBasicSockInstructionsHtml(doc);
        assertNoCastOnCarriageSide(html);
        expect(html).not.toContain(firstKnitRowWording);
        expect(html).toContain("If necessary, knit 1 additional row");
        expect(html).toContain("Do not count this setup row on the row counter");
        for (const phrase of emptyPassLanguage) {
          expect(html.toLowerCase()).not.toContain(phrase);
        }
      }
    }
  });

  it("checks cuff-to-toe carriage position immediately before the heel, not by adding a Sock 2 row", () => {
    const calc = mustCalc(typicalMachine);
    const pair = buildBasicSockInstructionPair(calc);
    const sock1Html = renderBasicSockInstructionsHtml(pair.sock1);
    const sock2Html = renderBasicSockInstructionsHtml(pair.sock2);

    assertCalculatedRowsMatchPair(calc, pair);
    expect(stepTypes(section(pair.sock1, "heel"))).toEqual([
      "stop-rc",
      "ensure-carriage",
      "place-hold",
      "short-row-in",
      "short-row-wrap-warning",
      "short-row-out",
      "cancel-hold-return",
    ]);
    expect(stepTypes(section(pair.sock2, "heel"))).toEqual(stepTypes(section(pair.sock1, "heel")));
    expect(stepTypes(section(pair.sock1, "toe"))).not.toContain("ensure-carriage");
    expect(stepTypes(section(pair.sock2, "toe"))).not.toContain("ensure-carriage");

    const sock1Check = sockEnsureCarriageInstruction("heel", "right");
    const sock2Check = sockEnsureCarriageInstruction("heel", "left");
    expect(sectionHtml(sock1Html, "heel")).toContain(sock1Check);
    expect(sectionHtml(sock2Html, "heel")).toContain(sock2Check);
    expect(sectionHtml(sock1Html, "toe")).not.toContain("Before beginning the toe");
    expect(sectionHtml(sock2Html, "toe")).not.toContain("Before beginning the toe");
    expect(sectionHtml(sock1Html, "cast-on")).not.toContain(sock1Check);
    expect(sectionHtml(sock2Html, "cast-on")).not.toContain(sock2Check);

    const sock1Heel = sectionHtml(sock1Html, "heel");
    expect(sock1Heel.indexOf(STOP_ROW_COUNTER_TEXT)).toBeGreaterThanOrEqual(0);
    expect(sock1Heel.indexOf(sock1Check)).toBeGreaterThan(sock1Heel.indexOf(STOP_ROW_COUNTER_TEXT));
    expect(sock1Heel.indexOf("Put the LEFT half of the needles")).toBeGreaterThan(
      sock1Heel.indexOf(sock1Check),
    );

    expect(section(pair.sock1, "heel").orientation?.carriageStartSide).toBe("right");
    expect(section(pair.sock2, "heel").orientation?.carriageStartSide).toBe("left");
    assertPositiveKnitRows(pair.sock1);
    assertPositiveKnitRows(pair.sock2);
    assertStitchContinuity(pair.sock1);
    assertStitchContinuity(pair.sock2);
  });

  it("checks toe-up carriage position immediately before the first short-row toe, without changing scrap-on rows", () => {
    const calc = mustCalc({ ...typicalMachine, constructionDirection: "toe-up" });
    const pair = buildBasicSockInstructionPair(calc);
    const sock1Html = renderBasicSockInstructionsHtml(pair.sock1);
    const sock2Html = renderBasicSockInstructionsHtml(pair.sock2);

    assertCalculatedRowsMatchPair(calc, pair);
    expect(stepTypes(section(pair.sock1, "toe"))).toEqual([
      "ensure-carriage",
      "reset-rc",
      "place-hold",
      "short-row-in",
      "short-row-wrap-warning",
      "short-row-out",
      "cancel-hold-return",
    ]);
    expect(stepTypes(section(pair.sock2, "toe"))).toEqual(stepTypes(section(pair.sock1, "toe")));
    expect(stepTypes(section(pair.sock1, "heel"))).not.toContain("ensure-carriage");
    expect(stepTypes(section(pair.sock2, "heel"))).not.toContain("ensure-carriage");

    const sock1Check = sockEnsureCarriageInstruction("toe", "right");
    const sock2Check = sockEnsureCarriageInstruction("toe", "left");
    expect(sectionHtml(sock1Html, "toe")).toContain(sock1Check);
    expect(sectionHtml(sock2Html, "toe")).toContain(sock2Check);
    expect(sectionHtml(sock1Html, "heel")).not.toContain("Before beginning the heel");
    expect(sectionHtml(sock2Html, "heel")).not.toContain("Before beginning the heel");

    const sock1Toe = sectionHtml(sock1Html, "toe");
    expect(sock1Toe.indexOf(sock1Check)).toBeGreaterThanOrEqual(0);
    expect(sock1Toe.indexOf(RESET_ROW_COUNTER_TEXT)).toBeGreaterThan(sock1Toe.indexOf(sock1Check));

    expect(section(pair.sock1, "toe").orientation?.carriageStartSide).toBe("right");
    expect(section(pair.sock2, "toe").orientation?.carriageStartSide).toBe("left");
    expect(sockInstructionSectionIds(pair.sock1)).toEqual(sockInstructionSectionIds(pair.sock2));
    assertPositiveKnitRows(pair.sock1);
    assertPositiveKnitRows(pair.sock2);
    assertStitchContinuity(pair.sock1);
    assertStitchContinuity(pair.sock2);
  });

  it("leaves Magic Formula and ankle row counts identical for Sock 1 and Sock 2", () => {
    const calc = mustCalc(widerLeg);
    const pair = buildBasicSockInstructionPair(calc);
    const mf1 = section(pair.sock1, "leg").steps.find((step) => step.type === "magic-formula");
    const mf2 = section(pair.sock2, "leg").steps.find((step) => step.type === "magic-formula");
    expect(mf1?.type === "magic-formula" && mf2?.type === "magic-formula").toBe(true);
    if (mf1?.type !== "magic-formula" || mf2?.type !== "magic-formula") return;
    expect(mf2.rows).toBe(mf1.rows);
    expect(mf2.rows).toBe(calc.legShapingRowsAvailable);
    expect(mf2.events).toEqual(mf1.events);
    expect(section(pair.sock2, "ankle").rowsToKnit).toBe(section(pair.sock1, "ankle").rowsToKnit);
    expect(section(pair.sock2, "ankle").rowsToKnit).toBe(calc.ankleStraightRows);
  });
});

describe("B. Wider top of leg, Cuff to Toe, Magic Formula decreases", () => {
  const calc = mustCalc(widerLeg);
  const doc = buildBasicSockInstructions(calc, 1);

  it("consumes the approved decrease schedule and lands on ankle stitches", () => {
    expect(sockInstructionSectionIds(doc)).toEqual([
      "cast-on",
      "leg",
      "ankle",
      "heel",
      "foot",
      "toe",
      "finishing",
    ]);
    assertStitchContinuity(doc);
    const mf = magicStep(doc);
    expect(mf.direction).toBe("decrease");
    expect(mf.shapingMode).toBe("both");
    expect(mf.steps).toBe(calc.legShapingSchedule.steps);
    expect(mf.events).toBe(calc.legShapingSchedule.knitOrder.events);
    expect(mf.startStitches).toBe(70);
    expect(mf.endStitches).toBe(60);
    expect(mf.rows).toBe(calc.legShapingRowsAvailable);
    expect(mf.events.at(-1)?.stitchesAfter).toBe(section(doc, "ankle").startStitches);
    expect(mf.events.at(-1)?.rowNumber).toBe(section(doc, "leg").rc.endRc);
    expect(section(doc, "cast-on").endStitches).toBe(calc.legStitches);
    expect(section(doc, "ankle").rowsToKnit).toBe(calc.ankleStraightRows);
  });
});

describe("C. Same wider geometry, Toe Up, Magic Formula increases", () => {
  const calc = mustCalc({ ...widerLeg, constructionDirection: "toe-up" });
  const sock1 = buildBasicSockInstructions(calc, 1);
  const sock2 = buildBasicSockInstructions(calc, 2);

  it("reverses section order, not physical hold sides", () => {
    expect(sockInstructionSectionIds(sock1)).toEqual([
      "cast-on",
      "toe",
      "foot",
      "heel",
      "ankle",
      "leg",
      "finishing",
    ]);
    expect(section(sock1, "cast-on").endStitches).toBe(calc.totalSockStitches);
    expect(section(sock1, "cast-on").title).toBe(SOCK_TOE_UP_OPENING_SECTION_TITLE);
    expect(section(sock1, "toe").orientation).toMatchObject({
      holdHalf: "left",
      workHalf: "right",
      carriageStartSide: "right",
    });
    expect(section(sock1, "heel").orientation).toMatchObject({
      holdHalf: "left",
      workHalf: "right",
      carriageStartSide: "right",
    });
    expect(section(sock2, "toe").orientation).toMatchObject({
      holdHalf: "right",
      workHalf: "left",
      carriageStartSide: "left",
    });
    expect(section(sock2, "heel").orientation).toMatchObject({
      holdHalf: "right",
      workHalf: "left",
      carriageStartSide: "left",
    });
    assertAnkleAndFootOnce(sock1);
    assertStitchContinuity(sock1);
    assertShortRowUsesApprovedCounts(calc, sock1);
  });

  it("consumes knitting-order increases from ankle toward the cuff", () => {
    const mf = magicStep(sock1);
    expect(mf.direction).toBe("increase");
    expect(mf.steps).toBe(calc.legShapingSchedule.steps);
    expect(mf.events).toBe(calc.legShapingSchedule.knitOrder.events);
    expect(mf.startStitches).toBe(60);
    expect(mf.endStitches).toBe(70);
    expect(mf.events.at(-1)?.stitchesAfter).toBe(section(sock1, "finishing").startStitches);
    expect(stepTypes(section(sock1, "finishing"))).toEqual([
      "bind-off",
      "seam",
      "block",
      "mirror-second-sock",
    ]);
  });
});

describe("D. Baby and Child — short ankle, heel/toe counts", () => {
  it("keeps Baby ankle once and uses approved heel/toe counts", () => {
    const calc = mustCalc(baby);
    const doc = buildBasicSockInstructions(calc, 1);
    expect(section(doc, "ankle").rowsToKnit).toBe(calc.ankleStraightRows);
    expect(calc.ankleStraightRows).toBe(4);
    expect(section(doc, "heel").startStitches).toBe(calc.totalSockStitches);
    expect(section(doc, "heel").orientation?.workHalf).toBe("right");
    expect(section(doc, "toe").orientation?.workHalf).toBe("right");
    assertShortRowUsesApprovedCounts(calc, doc);
    assertAnkleAndFootOnce(doc);
    assertStitchContinuity(doc);
    expect(section(doc, "heel").steps.find((step) => step.type === "short-row-in")).toMatchObject({
      rows: calc.heel.shortRowInSteps,
      remainingStitches: calc.heel.remainingStitches,
    });
  });

  it("keeps Child ankle once and does not merge it into the leg", () => {
    const calc = mustCalc(child);
    const doc = buildBasicSockInstructions(calc, 1);
    expect(sockInstructionSectionIds(doc)).toEqual([
      "cast-on",
      "leg",
      "ankle",
      "heel",
      "foot",
      "toe",
      "finishing",
    ]);
    expect(section(doc, "ankle").rowsToKnit).toBe(calc.ankleStraightRows);
    expect(calc.ankleStraightRows).toBe(8);
    expect(section(doc, "leg").id).not.toBe("ankle");
    assertShortRowUsesApprovedCounts(calc, doc);
  });
});

describe("E. Narrower top of leg — inverse shaping", () => {
  it("consumes cuff-to-toe increases from a narrower cuff toward the ankle", () => {
    const calc = mustCalc(narrowerLeg);
    const doc = buildBasicSockInstructions(calc, 1);
    const mf = magicStep(doc);
    expect(calc.legShapingSchedule.direction).toBe("decrease");
    expect(mf.direction).toBe("increase");
    expect(mf.startStitches).toBe(50);
    expect(mf.endStitches).toBe(60);
    expect(mf.events).toBe(calc.legShapingSchedule.knitOrder.events);
    expect(mf.events.at(-1)?.stitchesAfter).toBe(section(doc, "ankle").startStitches);
    expect(section(doc, "cast-on").endStitches).toBe(50);
    assertStitchContinuity(doc);
  });

  it("consumes toe-up decreases from ankle toward a narrower cuff", () => {
    const calc = mustCalc({ ...narrowerLeg, constructionDirection: "toe-up" });
    const doc = buildBasicSockInstructions(calc, 1);
    const mf = magicStep(doc);
    expect(mf.direction).toBe("decrease");
    expect(mf.startStitches).toBe(60);
    expect(mf.endStitches).toBe(50);
    expect(section(doc, "cast-on").endStitches).toBe(calc.totalSockStitches);
    expect(stepTypes(section(doc, "finishing"))[0]).toBe("bind-off");
    expect(section(doc, "finishing").startStitches).toBe(50);
    assertStitchContinuity(doc);
  });
});

describe("pair helper, renderer, and architecture", () => {
  it("builds a mirrored pair from one calc", () => {
    const calc = mustCalc(typicalMachine);
    const pair = buildBasicSockInstructionPair(calc);
    expect(pair.sock1.sock).toBe(1);
    expect(pair.sock2.sock).toBe(2);
    expect(pair.sock1.ribbing).toBeNull();
    expect(sockInstructionSectionIds(pair.sock1)).toEqual(sockInstructionSectionIds(pair.sock2));
    expect(section(pair.sock1, "heel").orientation?.holdHalf).toBe("left");
    expect(section(pair.sock1, "toe").orientation?.holdHalf).toBe("left");
    expect(section(pair.sock2, "heel").orientation?.holdHalf).toBe("right");
    expect(section(pair.sock2, "toe").orientation?.holdHalf).toBe("right");
  });

  it("renders KIN carriage-relative short rows and default bind-off-top finishing", () => {
    const calc = mustCalc(widerLeg);
    const html = renderBasicSockInstructionsHtml(buildBasicSockInstructions(calc, 1));
    expect(html).toContain('data-section-id="heel"');
    expect(html).toContain(STOP_ROW_COUNTER_TEXT);
    expect(html).toContain("carriage on the RIGHT");
    expect(html).toContain("LEFT half of the needles");
    expect(html).toContain("opposite the carriage");
    expect(html).toContain("On the carriage side, put 1 needle into hold");
    expect(html).toContain("Opposite the carriage, return 1 needle to work");
    expect(html).toContain("Repeat every row");
    expect(html).toContain(SOCK_SHORT_ROW_WRAP_WARNING);
    expect(html).toContain("at each side");
    expect(html).toContain("contrasting waste yarn");
    expect(html).toContain("and remove the work from the machine.");
    expect(html).toContain(SOCK_FINISH_THE_TOE_HEADING);
    expect(html).toContain(SOCK_CHOOSE_TOE_FINISHING_HEADING);
    expect(html).toContain(SOCK_REHANG_AND_JOIN_LABEL);
    expect(html).toContain(SOCK_GRAFT_OR_SEAM_LABEL);
    expect(html).toContain(SOCK_GRAFT_OR_SEAM_INSTRUCTION_PREFIX);
    expect(html).toContain(BICKFORD_SEAM_GLOSSARY_TERM);
    expect(html).toContain(KITCHENER_STITCH_GLOSSARY_TERM);
    expect(html).toContain("(Grafting)");
    expect(html).not.toContain("top of the toes");
    expect(html).not.toContain("Bind off the toe seam");
    expect(html).not.toContain('type="kitchener"');
    expect(html).toContain(`data-tip-id="${SOCK_CUFF_CAST_ON_VIDEO_TIP_ID}"`);
    expect(html).toContain(SOCK_CUFF_CAST_ON_VIDEO_TITLE);
    expect(html).toContain(`player.vimeo.com/video/${SOCK_CUFF_CAST_ON_VIDEO_VIMEO_ID}`);
    expect(html).toContain(`data-tip-id="${SOCK_ANKLE_VIDEO_TIP_ID}"`);
    expect(html).toContain(SOCK_ANKLE_VIDEO_TITLE);
    expect(html).toContain(`player.vimeo.com/video/${SOCK_ANKLE_VIDEO_VIMEO_ID}`);
    expect(html).toContain(`h=${SOCK_ANKLE_VIDEO_PRIVACY_HASH}`);
    expect(html).toContain("with the method of your choice.");
    expect(html).not.toContain("(top of leg)");
    expect(html).not.toContain("Use the cast-on method of your choice.");
    const toeUp = renderBasicSockInstructionsHtml(
      buildBasicSockInstructions(mustCalc({ ...widerLeg, constructionDirection: "toe-up" }), 1),
    );
    expect(toeUp).toContain("Bind off");
    expect(toeUp).toContain("at the cuff");
    expect(toeUp).not.toContain("waste yarn");
    expect(toeUp).toContain(`<h4>${SOCK_TOE_UP_OPENING_SECTION_TITLE}</h4>`);
    expect(toeUp).toContain(`data-glossary-id="${SCRAP_AND_RAVEL_CAST_ON_GLOSSARY_ID}"`);
    expect(toeUp).toContain(`data-term="Scrap on"`);
    expect(toeUp).toContain(`data-aria-label="${SCRAP_AND_RAVEL_CAST_ON_GLOSSARY_TERM}"`);
    expect(toeUp).toMatch(/Scrap on[\s\S]*<strong>\d+ stitches<\/strong>\./);
    expect(toeUp).not.toContain("(full foot / tube)");
    expect(toeUp).not.toContain("Use the cast-on method of your choice.");
    expect(toeUp).not.toContain(`player.vimeo.com/video/${SOCK_CUFF_CAST_ON_VIDEO_VIMEO_ID}`);
    expect(toeUp).not.toContain(`data-tip-id="${SOCK_CUFF_CAST_ON_VIDEO_TIP_ID}"`);
    expect(toeUp).toContain(`player.vimeo.com/video/${SOCK_ANKLE_VIDEO_VIMEO_ID}`);
    expect(toeUp).toContain(`data-tip-id="${SOCK_ANKLE_VIDEO_TIP_ID}"`);
  });

  it("produces a compact outline for review", () => {
    const calc = mustCalc(typicalMachine);
    const outline = formatSockInstructionOutline(buildBasicSockInstructions(calc, 1));
    expect(outline).toContain("Sock 1 — Cuff to Toe");
    expect(outline).toContain("Ankle:");
    expect(outline).toContain("hold LEFT, work RIGHT, carriage RIGHT");
    expect(outline).toContain("Heel:");
    expect(outline).toContain("Toe:");
    expect(outline).toContain(SOCK_SHORT_ROW_WRAP_WARNING);
    expect(outline).toContain(SOCK_FINISH_THE_TOE_HEADING);
    expect(outline).toContain(SOCK_CHOOSE_TOE_FINISHING_HEADING);
    expect(outline).toContain(
      `${SOCK_REHANG_AND_JOIN_LABEL}: ${SOCK_FOLD_RIGHT_SIDES_INSTRUCTION} ${sockRehangToeInstruction(calc.totalSockStitches)}`,
    );
    expect(outline).toContain(
      `${SOCK_GRAFT_OR_SEAM_LABEL}: ${SOCK_GRAFT_OR_SEAM_INSTRUCTION_PREFIX} ${KITCHENER_STITCH_GLOSSARY_TERM} (Grafting) or ${BICKFORD_SEAM_GLOSSARY_TERM}${SOCK_GRAFT_OR_SEAM_INSTRUCTION_SUFFIX}`,
    );
    expect(outline).not.toContain("Drop the work from the machine.");
    expect(outline).not.toContain("top of the toes");
    expect(outline).not.toContain("Bind off the toe seam");
    const heelLine = outline.split("\n").find((line) => line.startsWith("Heel:"));
    const toeLine = outline.split("\n").find((line) => line.startsWith("Toe:"));
    expect(heelLine).toContain("hold LEFT, work RIGHT, carriage RIGHT");
    expect(toeLine).toContain("hold LEFT, work RIGHT, carriage RIGHT");
  });

  it("does not import geometry recalculation into the instruction layer", () => {
    const dir = dirname(fileURLToPath(import.meta.url));
    const sources = [
      "sockInstructionModel.ts",
      "sockInstructionBuild.ts",
      "sockInstructionRender.ts",
      "sockShortRowInstructions.ts",
      "sockInstructions.ts",
    ].map((name) => readFileSync(resolve(dir, name), "utf8"));
    const joined = sources.join("\n");
    expect(joined).not.toMatch(/magicFormulaIntervals/);
    expect(joined).not.toMatch(/remainingStitchesAtOneThird/);
    expect(joined).not.toMatch(/roundToEvenPreferUp/);
    expect(joined).not.toMatch(/computeMagicFormulaPairedShaping/);
    expect(joined).not.toMatch(/calculateShortRowShaping/);
    expect(joined).not.toMatch(/computeAutoShaping/);
  });
});

describe("Toe-Up opening uses existing Scrap and Ravel Cast On glossary", () => {
  type GlossaryRow = { glossaryId?: number; english?: string; active?: boolean };
  const entries = glossary as GlossaryRow[];
  const entry = entries.find((row) => row.glossaryId === SCRAP_AND_RAVEL_CAST_ON_GLOSSARY_ID);
  const byEnglish = entries.find((row) => row.english === SCRAP_AND_RAVEL_CAST_ON_GLOSSARY_TERM);

  it("locates the existing glossary entry by id and English term", () => {
    expect(entry).toBeDefined();
    expect(entry?.active).toBe(true);
    expect(entry?.english).toBe(SCRAP_AND_RAVEL_CAST_ON_GLOSSARY_TERM);
    expect(byEnglish?.glossaryId).toBe(SCRAP_AND_RAVEL_CAST_ON_GLOSSARY_ID);
    expect(glossarySlugForId(SCRAP_AND_RAVEL_CAST_ON_GLOSSARY_ID)).toBe(
      "scrap-and-ravel-cast-on",
    );
    expect(entries.some((row) => row.english === "Scrap On")).toBe(false);
  });

  it("renders Scrap on N stitches with that glossary help, not a new Scrap On entry", () => {
    const calc = mustCalc({ ...typicalMachine, constructionDirection: "toe-up" });
    const doc = buildBasicSockInstructions(calc, 1);
    expect(section(doc, "cast-on").title).toBe(SOCK_TOE_UP_OPENING_SECTION_TITLE);
    const html = renderBasicSockInstructionsHtml(doc);
    expect(html).toContain(`<h4>${SOCK_TOE_UP_OPENING_SECTION_TITLE}</h4>`);
    expect(html).toContain(`data-term="Scrap on"`);
    expect(html).toContain(`<strong>${calc.totalSockStitches} stitches</strong>.`);
    expect(html).toContain(`data-glossary-id="${SCRAP_AND_RAVEL_CAST_ON_GLOSSARY_ID}"`);
    expect(html).toContain(`data-aria-label="${SCRAP_AND_RAVEL_CAST_ON_GLOSSARY_TERM}"`);
    expect(html).not.toContain("(full foot / tube)");
    expect(html).not.toContain("Use the cast-on method of your choice.");
    const outline = formatSockInstructionOutline(doc);
    expect(outline).toContain(`Scrap on ${calc.totalSockStitches} stitches.`);
    expect(outline).toContain(`${SOCK_TOE_UP_OPENING_SECTION_TITLE}:`);
  });

  it("uses method-of-your-choice copy for cuff-to-toe cast-on, without Scrap and Ravel", () => {
    const calc = mustCalc(typicalMachine);
    const html = renderBasicSockInstructionsHtml(buildBasicSockInstructions(calc, 1));
    const castOn = sectionHtml(html, "cast-on");
    expect(castOn).toContain("<h4>Cast-On</h4>");
    expect(castOn).toContain(
      `Cast on <strong>${calc.legStitches} stitches</strong> with the method of your choice.`,
    );
    expect(castOn).not.toContain(`data-glossary-id="${SCRAP_AND_RAVEL_CAST_ON_GLOSSARY_ID}"`);
    expect(castOn).not.toContain(`data-term="${SCRAP_AND_RAVEL_CAST_ON_GLOSSARY_TERM}"`);
    expect(castOn).not.toContain("Scrap and Ravel");
    expect(castOn).toContain(`data-tip-id="${SOCK_CUFF_CAST_ON_VIDEO_TIP_ID}"`);
    expect(castOn).toContain('class="pattern-tip pattern-quick-tip"');
    expect(castOn).toContain(SOCK_CUFF_CAST_ON_VIDEO_TITLE);
    expect(castOn).toContain(`player.vimeo.com/video/${SOCK_CUFF_CAST_ON_VIDEO_VIMEO_ID}`);
    expect(castOn).not.toContain(`player.vimeo.com/video/${SOCK_ANKLE_VIDEO_VIMEO_ID}`);
    expect(castOn).not.toContain("(top of leg)");
    expect(castOn).not.toContain("Use the cast-on method of your choice.");
    expect(castOn).not.toContain("(full foot / tube)");
    const outline = formatSockInstructionOutline(buildBasicSockInstructions(calc, 1));
    expect(outline).toContain(
      `Cast on ${calc.legStitches} stitches with the method of your choice.`,
    );
    expect(outline).not.toContain("(top of leg)");
    expect(outline).not.toContain("Scrap and Ravel");
  });
});

describe("Cuff-to-Toe Leg omits the redundant row-counter reset control", () => {
  it("keeps RC: 000 on Cuff-to-Toe Leg without RESET ROW COUNTER TO 000", () => {
    const html = renderBasicSockInstructionsHtml(
      buildBasicSockInstructions(mustCalc(typicalMachine), 1),
    );
    const leg = sectionHtml(html, "leg");
    expect(leg).toContain("RC: 000");
    expect(leg).not.toContain(RESET_ROW_COUNTER_TEXT);
    const ankle = sectionHtml(html, "ankle");
    expect(ankle).not.toContain("RC: 000");
    expect(ankle).not.toContain(RESET_ROW_COUNTER_TEXT);
    expect(ankle).not.toContain(RESTART_ROW_COUNTER_TEXT);
    expect(ankle).not.toContain(STOP_ROW_COUNTER_TEXT);
    const heel = sectionHtml(html, "heel");
    expect(heel).toContain(STOP_ROW_COUNTER_TEXT);
    expect(heel).not.toContain(RESET_ROW_COUNTER_TEXT);
    expect(sectionHtml(html, "toe")).toContain(STOP_ROW_COUNTER_TEXT);
    expect(sectionHtml(html, "toe")).not.toContain(RESET_ROW_COUNTER_TEXT);
    expect(sectionHtml(html, "foot")).toContain(RESTART_ROW_COUNTER_TEXT);
    expect(sectionHtml(html, "foot")).not.toContain(RESET_ROW_COUNTER_TEXT);
  });

  it("still resets the row counter on Toe-Up Leg", () => {
    const html = renderBasicSockInstructionsHtml(
      buildBasicSockInstructions(mustCalc({ ...typicalMachine, constructionDirection: "toe-up" }), 1),
    );
    expect(sectionHtml(html, "leg")).toContain(RESET_ROW_COUNTER_TEXT);
    expect(sectionHtml(html, "cast-on")).not.toContain(
      `player.vimeo.com/video/${SOCK_CUFF_CAST_ON_VIDEO_VIMEO_ID}`,
    );
    const ankle = sectionHtml(html, "ankle");
    expect(ankle).toContain(`player.vimeo.com/video/${SOCK_ANKLE_VIDEO_VIMEO_ID}`);
    expect(ankle).toContain(`data-tip-id="${SOCK_ANKLE_VIDEO_TIP_ID}"`);
    expect(ankle).toContain(SOCK_ANKLE_VIDEO_TITLE);
    expect(ankle).not.toContain(`player.vimeo.com/video/${SOCK_CUFF_CAST_ON_VIDEO_VIMEO_ID}`);
    expect(ankle).toContain("RC: 000");
    expect(ankle).not.toContain(RESET_ROW_COUNTER_TEXT);
    expect(ankle).toContain(`h=${SOCK_ANKLE_VIDEO_PRIVACY_HASH}`);
  });
});

describe("Ankle video hash, Ankle RC label, and Heel stop-counter", () => {
  it("embeds the ankle Vimeo ID with the official privacy hash in the same Quick Tip iframe as the cuff video", () => {
    const html = renderBasicSockInstructionsHtml(
      buildBasicSockInstructions(mustCalc(typicalMachine), 1),
    );
    const cuff = sectionHtml(html, "cast-on");
    const ankle = sectionHtml(html, "ankle");
    const iframeSrc = (block: string) =>
      (block.match(/<iframe src="([^"]+)"/)?.[1] ?? "").replaceAll("&amp;", "&");
    const cuffSrc = iframeSrc(cuff);
    const ankleSrc = iframeSrc(ankle);
    expect(cuffSrc).toBe(
      `https://player.vimeo.com/video/${SOCK_CUFF_CAST_ON_VIDEO_VIMEO_ID}?byline=0&portrait=0`,
    );
    expect(ankleSrc).toBe(
      `https://player.vimeo.com/video/${SOCK_ANKLE_VIDEO_VIMEO_ID}?byline=0&portrait=0&h=${SOCK_ANKLE_VIDEO_PRIVACY_HASH}`,
    );
    expect(ankleSrc).toContain(`/${SOCK_ANKLE_VIDEO_VIMEO_ID}?`);
    expect(ankleSrc).not.toContain("1222662401");
    expect(cuff).toContain('class="pattern-tip pattern-quick-tip"');
    expect(ankle).toContain('class="pattern-tip pattern-quick-tip"');
    expect(cuff).toContain('data-explainer-video=');
    expect(ankle).toContain('data-explainer-video=');
  });

  it("keeps Ankle knit-even values and Heel knitting steps after STOP ROW COUNTER", () => {
    const calc = mustCalc(typicalMachine);
    const doc = buildBasicSockInstructions(calc, 1);
    const html = renderBasicSockInstructionsHtml(doc);
    const ankle = sectionHtml(html, "ankle");
    expect(ankle).toContain(
      `Knit ${calc.ankleStraightRows} rows even. (${calc.totalSockStitches} stitches)`,
    );
    expect(ankle).not.toContain("RC: 000");
    const heel = sectionHtml(html, "heel");
    const stopIdx = heel.indexOf(STOP_ROW_COUNTER_TEXT);
    const carriageIdx = heel.indexOf(sockEnsureCarriageInstruction("heel", "right"));
    const holdIdx = heel.indexOf("Put the LEFT half of the needles");
    expect(stopIdx).toBeGreaterThanOrEqual(0);
    expect(carriageIdx).toBeGreaterThan(stopIdx);
    expect(holdIdx).toBeGreaterThan(carriageIdx);
    expect(formatSockInstructionOutline(doc)).toContain(STOP_ROW_COUNTER_TEXT);
  });
});

describe("Cuff-to-Toe instruction copy corrections", () => {
  const SHORT_ROW_RETURN_DEPTH_SENTENCE =
    "Short-row return rows are knitting rows only. They do not add to finished heel or toe depth.";
  const OLD_SECOND_SOCK_INTRO_FRAGMENT =
    "Knit the second sock the same way, reversing the setup";

  it("continues the Leg row counter through Ankle, stops at Heel, and restarts on Foot", () => {
    const calc = mustCalc(typicalMachine);
    const doc = buildBasicSockInstructions(calc, 1);
    const html = renderBasicSockInstructionsHtml(doc);
    const ankle = section(doc, "ankle");
    expect(ankle.rowsToKnit).toBe(calc.ankleStraightRows);
    expect(section(doc, "leg").rowsToKnit).toBe(calc.legShapingRowsAvailable);
    expect(ankle.rc.resetAtStart).toBe(false);
    expect(sectionHtml(html, "leg")).toContain("RC: 000");
    expect(sectionHtml(html, "ankle")).not.toContain("RC: 000");
    expect(sectionHtml(html, "heel")).toContain(STOP_ROW_COUNTER_TEXT);
    expect(stepTypes(section(doc, "foot"))[0]).toBe("restart-rc");
    expect(sectionHtml(html, "foot")).toContain(RESTART_ROW_COUNTER_TEXT);
    expect(sectionHtml(html, "foot")).not.toContain(RESET_ROW_COUNTER_TEXT);
  });

  it("stops the Toe row counter at the Foot ending RC instead of resetting to 000", () => {
    for (const input of [typicalMachine, baby]) {
      const calc = mustCalc(input);
      const pair = buildBasicSockInstructionPair(calc);
      const footRc = formatRowCounterResetGarmentRcLabel(calc.straightFootRows);
      expect(calc.straightFootRows).toBeGreaterThan(0);
      expect(footRc).not.toBe("RC: 000");
      for (const doc of [pair.sock1, pair.sock2]) {
        const toe = section(doc, "toe");
        const foot = section(doc, "foot");
        expect(foot.rc.endRc).toBe(calc.straightFootRows);
        expect(toe.steps[0]).toEqual({
          type: "stop-rc",
          garmentRc: calc.straightFootRows,
        });
        expect(toe.rc.startRc).toBe(foot.rc.endRc);
        expect(toe.rc.resetAtStart).toBe(false);
        expect(stepTypes(toe)).not.toContain("reset-rc");
        const html = sectionHtml(renderBasicSockInstructionsHtml(doc), "toe");
        expect(html).toContain(STOP_ROW_COUNTER_TEXT);
        expect(html).toContain(footRc);
        expect(html).not.toContain(RESET_ROW_COUNTER_TEXT);
        expect(html).not.toContain("RC: 000");
      }
    }
  });

  it("removes the short-row return-row depth sentence", () => {
    const doc = buildBasicSockInstructions(mustCalc(typicalMachine), 1);
    expect(section(doc, "heel").notes).toEqual([]);
    expect(section(doc, "toe").notes).toEqual([]);
    const html = renderBasicSockInstructionsHtml(doc);
    expect(html).not.toContain(SHORT_ROW_RETURN_DEPTH_SENTENCE);
    expect(formatSockInstructionOutline(doc)).not.toContain(SHORT_ROW_RETURN_DEPTH_SENTENCE);
  });

  it("labels heel/toe short-row halves as passes and summarizes the complete sequence", () => {
    const shaping = calculateShortRowShaping(26);
    expect(shaping).toMatchObject({
      workingStitches: 13,
      remainingStitches: 5,
      shortRowInSteps: 8,
      shortRowOutSteps: 8,
      shortRowDepthRows: 8,
      shortRowKnittingRows: 16,
    });
    const heel = buildSockShortRowInstructionSection({
      part: "heel",
      shaping: shaping!,
      orientation: sockHoldOrientation(1, "heel"),
      tubeStitches: 26,
      constructionDirection: "cuff-to-toe",
      sock: 1,
    });
    const html = renderBasicSockInstructionsHtml({
      constructionDirection: "cuff-to-toe",
      sock: 1,
      ribbing: null,
      toeFinishingVariation: SOCK_TOE_FINISHING_DEFAULT,
      sections: [heel],
    });
    expect(html).toContain(
      "On the carriage side, put 1 needle into hold and knit across. Repeat every row until 5 center stitches remain. (8 short-row passes)",
    );
    expect(html).toContain(
      "Opposite the carriage, return 1 needle to work and knit across. Repeat every row until all 13 working stitches are back in work. (8 short-row passes)",
    );
    expect(html).toContain(
      "Short-row shaping: 16 passes total — 8 decreasing and 8 increasing.",
    );
    expect(html).not.toContain("(8 rows)");
    expect(html).not.toContain(SHORT_ROW_RETURN_DEPTH_SENTENCE);

    for (const constructionDirection of ["cuff-to-toe", "toe-up"] as const) {
      const pair = buildBasicSockInstructionPair(
        mustCalc({ ...typicalMachine, constructionDirection }),
      );
      for (const doc of [pair.sock1, pair.sock2]) {
        const rendered = renderBasicSockInstructionsHtml(doc);
        const outline = formatSockInstructionOutline(doc);
        for (const id of ["heel", "toe"] as const) {
          const part = section(doc, id);
          const decrease = shortRowIn(part).rows;
          const increase = shortRowOut(part).rows;
          const total = decrease + increase;
          const halfLabel = `${decrease} short-row passes`;
          const increaseLabel = `${increase} short-row passes`;
          const summary = `Short-row shaping: ${total} passes total — ${decrease} decreasing and ${increase} increasing.`;
          const partHtml = sectionHtml(rendered, id);
          expect(partHtml).toContain(`(${halfLabel})`);
          expect(partHtml).toContain(`(${increaseLabel})`);
          expect(partHtml).toContain(summary);
          expect(partHtml).not.toContain(`(${decrease} rows)`);
          expect(partHtml).not.toContain(`(${increase} rows)`);
          expect(outline).toContain(summary);
          expect(decrease).toBe(part.physicalDepthRows);
          expect(total).toBe(part.shortRowKnittingRows);
        }
      }
    }
  });

  it("uses the updated toe rehanging and Sock 2 introduction wording", () => {
    const calc = mustCalc(typicalMachine);
    const pair = buildBasicSockInstructionPair(calc);
    const sock1Html = renderBasicSockInstructionsHtml(pair.sock1);
    const sock2Html = renderBasicSockInstructionsHtml(pair.sock2);
    const finishing = sectionHtml(sock1Html, "finishing");
    expect(finishing).toContain(SOCK_FOLD_RIGHT_SIDES_INSTRUCTION);
    expect(finishing).toContain(sockRehangToeInstruction(calc.totalSockStitches));
    expect(finishing).toContain(SOCK_CHOOSE_TOE_FINISHING_HEADING);
    expect(finishing).not.toContain(">Rehang the toe stitches.<");
    expect(finishing).not.toContain("Rehang the toe stitches with 2 stitches on each needle");
    expect(finishing).not.toContain("Drop the work from the machine.");
    expect(finishing).toContain(SOCK_SECOND_SOCK_INTRO);
    expect(finishing).not.toContain(OLD_SECOND_SOCK_INTRO_FRAGMENT);
    expect(finishing).not.toContain("carriage on the LEFT");
    expect(sock2Html).not.toContain(SOCK_SECOND_SOCK_INTRO);
    expect(sock2Html).toContain("carriage on the LEFT");
    expect(sock2Html).toContain("RIGHT half of the needles");
    expect(section(pair.sock2, "heel").orientation).toMatchObject({
      workHalf: "left",
      holdHalf: "right",
      carriageStartSide: "left",
    });
    expect(section(pair.sock2, "toe").orientation).toMatchObject({
      workHalf: "left",
      holdHalf: "right",
      carriageStartSide: "left",
    });
  });

  it("does not restart the Toe-Up Foot counter or drop Toe-Up Ankle RC: 000", () => {
    const html = renderBasicSockInstructionsHtml(
      buildBasicSockInstructions(mustCalc({ ...typicalMachine, constructionDirection: "toe-up" }), 1),
    );
    expect(sectionHtml(html, "foot")).toContain(RESET_ROW_COUNTER_TEXT);
    expect(sectionHtml(html, "foot")).not.toContain(RESTART_ROW_COUNTER_TEXT);
    expect(sectionHtml(html, "ankle")).toContain("RC: 000");
    expect(sectionHtml(html, "ankle")).not.toContain(RESTART_ROW_COUNTER_TEXT);
    expect(sectionHtml(html, "leg")).toContain(RESET_ROW_COUNTER_TEXT);
  });
});

describe("Cuff-to-Toe heel/toe/finishing Quick Tips and finishing copy", () => {
  const iframeSrc = (block: string) =>
    (block.match(/<iframe src="([^"]+)"/)?.[1] ?? "").replaceAll("&amp;", "&");

  it("adds the why-stop Quick Tip and heel video on Cuff-to-Toe Heel only, not on Toe", () => {
    const html = renderBasicSockInstructionsHtml(
      buildBasicSockInstructions(mustCalc(typicalMachine), 1),
    );
    const heel = sectionHtml(html, "heel");
    const toe = sectionHtml(html, "toe");
    expect(heel).toContain(`data-tip-id="${SOCK_WHY_STOP_ROW_COUNTER_TIP_ID}"`);
    expect(heel).toContain(SOCK_WHY_STOP_ROW_COUNTER_TITLE);
    expect(heel).toContain(SOCK_WHY_STOP_ROW_COUNTER_BODY);
    expect(heel).toContain('class="pattern-tip pattern-quick-tip"');
    expect(heel).toContain(`data-tip-id="${SOCK_HEEL_VIDEO_TIP_ID}"`);
    expect(heel).toContain(SOCK_HEEL_VIDEO_TITLE);
    expect(iframeSrc(heel)).toBe(
      `https://player.vimeo.com/video/${SOCK_HEEL_VIDEO_VIMEO_ID}?byline=0&portrait=0&h=${SOCK_HEEL_VIDEO_PRIVACY_HASH}`,
    );
    expect(toe).not.toContain(`data-tip-id="${SOCK_WHY_STOP_ROW_COUNTER_TIP_ID}"`);
    expect(toe).not.toContain(SOCK_WHY_STOP_ROW_COUNTER_TITLE);
    expect(toe).toContain(`data-tip-id="${SOCK_TOE_VIDEO_TIP_ID}"`);
    expect(toe).toContain(SOCK_TOE_VIDEO_TITLE);
    expect(iframeSrc(toe)).toBe(
      `https://player.vimeo.com/video/${SOCK_TOE_VIDEO_VIMEO_ID}?byline=0&portrait=0&h=${SOCK_TOE_VIDEO_PRIVACY_HASH}`,
    );
    expect(html.split(`data-tip-id="${SOCK_WHY_STOP_ROW_COUNTER_TIP_ID}"`).length - 1).toBe(1);
  });

  it("adds the finishing video and glossary-linked finishing copy on Cuff-to-Toe only", () => {
    const html = renderBasicSockInstructionsHtml(
      buildBasicSockInstructions(mustCalc(typicalMachine), 1),
    );
    const finishing = sectionHtml(html, "finishing");
    expect(finishing).toContain(`data-tip-id="${SOCK_TOE_FINISHING_VIDEO_TIP_ID}"`);
    expect(finishing).toContain(SOCK_TOE_FINISHING_VIDEO_TITLE);
    expect(iframeSrc(finishing)).toBe(
      `https://player.vimeo.com/video/${SOCK_TOE_FINISHING_VIDEO_VIMEO_ID}?byline=0&portrait=0&h=${SOCK_TOE_FINISHING_VIDEO_PRIVACY_HASH}`,
    );
    expect(finishing).toContain(`data-glossary-id="${BICKFORD_SEAM_GLOSSARY_ID}"`);
    expect(finishing).toContain(`data-term="${BICKFORD_SEAM_GLOSSARY_TERM}"`);
    expect(finishing).toContain(`data-glossary-id="${KITCHENER_STITCH_GLOSSARY_ID}"`);
    expect(finishing).toContain(`data-term="${KITCHENER_STITCH_GLOSSARY_TERM}"`);
    expect(finishing).toContain(SOCK_FINISH_THE_TOE_HEADING);
    expect(finishing).toContain(SOCK_CHOOSE_TOE_FINISHING_HEADING);
    expect(finishing).toContain(SOCK_REHANG_AND_JOIN_LABEL);
    expect(finishing).toContain(SOCK_GRAFT_OR_SEAM_LABEL);
    expect(finishing).toContain(SOCK_GRAFT_OR_SEAM_INSTRUCTION_PREFIX);
    expect(finishing).toContain("(Grafting)");
    expect(finishing).not.toContain("Bind off the toe seam");
    expect(finishing).not.toContain("top of the toes");
    expect(finishing).not.toContain("under the toes");
    expect(finishing).not.toContain("Drop the work from the machine.");
    expect(finishing).not.toContain("Finish the toe using");
    expect(glossarySlugForId(BICKFORD_SEAM_GLOSSARY_ID)).toBe("bickford-seam");
    expect(glossarySlugForId(KITCHENER_STITCH_GLOSSARY_ID)).toBe("kitchener-stitch");
  });

  it("presents the same scrap-off then finishing-method choices on Sock 1 and Sock 2", () => {
    const calc = mustCalc(typicalMachine);
    const pair = buildBasicSockInstructionPair(calc);
    const rendered = [
      renderBasicSockInstructionsHtml(pair.sock1),
      renderBasicSockInstructionsHtml(pair.sock2),
    ];
    for (const html of rendered) {
      const finishing = sectionHtml(html, "finishing");
      const scrapIdx = finishing.indexOf("and remove the work from the machine.");
      const chooseIdx = finishing.indexOf(SOCK_CHOOSE_TOE_FINISHING_HEADING);
      const rehangIdx = finishing.indexOf(`<li><strong>${SOCK_REHANG_AND_JOIN_LABEL}:</strong>`);
      const graftIdx = finishing.indexOf(`<li><strong>${SOCK_GRAFT_OR_SEAM_LABEL}:</strong>`);
      expect(scrapIdx).toBeGreaterThan(-1);
      expect(chooseIdx).toBeGreaterThan(scrapIdx);
      expect(rehangIdx).toBeGreaterThan(chooseIdx);
      expect(graftIdx).toBeGreaterThan(rehangIdx);
      expect(finishing).toContain(
        `<li><strong>${SOCK_REHANG_AND_JOIN_LABEL}:</strong> ${SOCK_FOLD_RIGHT_SIDES_INSTRUCTION} ${sockRehangToeInstruction(calc.totalSockStitches)}</li>`,
      );
      expect(finishing.indexOf(SOCK_FOLD_RIGHT_SIDES_INSTRUCTION)).toBeGreaterThan(chooseIdx);
      expect(finishing.indexOf(`data-glossary-id="${KITCHENER_STITCH_GLOSSARY_ID}"`)).toBeGreaterThan(
        graftIdx,
      );
      expect(finishing.indexOf(`data-glossary-id="${BICKFORD_SEAM_GLOSSARY_ID}"`)).toBeGreaterThan(
        graftIdx,
      );
    }
  });

  it("names rehung stitch and needle counts from the even toe/tube stitch count", () => {
    expect(sockRehangToeInstruction(26)).toBe(
      "Rehang the 26 toe stitches onto 13 needles, placing 2 stitches on each needle, and complete the join on the machine.",
    );
    const woman = mustCalc(typicalMachine);
    const infant = mustCalc(baby);
    expect(woman.totalSockStitches % 2).toBe(0);
    expect(infant.totalSockStitches % 2).toBe(0);
    expect(woman.totalSockStitches).not.toBe(infant.totalSockStitches);
    const womanCopy = sockRehangToeInstruction(woman.totalSockStitches);
    const infantCopy = sockRehangToeInstruction(infant.totalSockStitches);
    expect(womanCopy).toBe(
      `Rehang the ${woman.totalSockStitches} toe stitches onto ${woman.totalSockStitches / 2} needles, placing 2 stitches on each needle, and complete the join on the machine.`,
    );
    expect(infantCopy).toBe(
      `Rehang the ${infant.totalSockStitches} toe stitches onto ${infant.totalSockStitches / 2} needles, placing 2 stitches on each needle, and complete the join on the machine.`,
    );
    expect(womanCopy).not.toBe(infantCopy);
    expect(womanCopy).not.toContain("26 toe stitches");
    for (const calc of [woman, infant]) {
      const expected = sockRehangToeInstruction(calc.totalSockStitches);
      const pair = buildBasicSockInstructionPair(calc);
      for (const doc of [pair.sock1, pair.sock2]) {
        const html = sectionHtml(renderBasicSockInstructionsHtml(doc), "finishing");
        const outline = formatSockInstructionOutline(doc);
        expect(html).toContain(expected);
        expect(outline).toContain(expected);
        expect(html).not.toContain("Rehang the toe stitches with 2 stitches on each needle");
      }
    }
  });

  it("does not add the Cuff-to-Toe heel/toe/finishing videos or why-stop tip to Toe-Up", () => {
    const html = renderBasicSockInstructionsHtml(
      buildBasicSockInstructions(mustCalc({ ...typicalMachine, constructionDirection: "toe-up" }), 1),
    );
    expect(sectionHtml(html, "heel")).not.toContain(`data-tip-id="${SOCK_WHY_STOP_ROW_COUNTER_TIP_ID}"`);
    expect(sectionHtml(html, "heel")).not.toContain(`data-tip-id="${SOCK_HEEL_VIDEO_TIP_ID}"`);
    expect(sectionHtml(html, "toe")).not.toContain(`data-tip-id="${SOCK_TOE_VIDEO_TIP_ID}"`);
    expect(sectionHtml(html, "finishing")).not.toContain(
      `data-tip-id="${SOCK_TOE_FINISHING_VIDEO_TIP_ID}"`,
    );
    expect(html).not.toContain(`player.vimeo.com/video/${SOCK_HEEL_VIDEO_VIMEO_ID}`);
    expect(html).not.toContain(`player.vimeo.com/video/${SOCK_TOE_VIDEO_VIMEO_ID}`);
    expect(html).not.toContain(`player.vimeo.com/video/${SOCK_TOE_FINISHING_VIDEO_VIMEO_ID}`);
    expect(sectionHtml(html, "finishing")).toContain("Bind off");
    expect(sectionHtml(html, "finishing")).toContain("at the cuff");
    expect(sectionHtml(html, "finishing")).not.toContain("Finish the toe using");
    expect(sectionHtml(html, "finishing")).not.toContain(SOCK_CHOOSE_TOE_FINISHING_HEADING);
    expect(sectionHtml(html, "finishing")).not.toContain(SOCK_FINISH_THE_TOE_HEADING);
  });
});

describe("KIN automatic-wrap short-row primitive", () => {
  const calc = mustCalc(typicalMachine);
  const sock1 = buildBasicSockInstructions(calc, 1);
  const sock2 = buildBasicSockInstructions(calc, 2);

  it("starts Sock 1 with carriage RIGHT and the LEFT half held", () => {
    for (const id of ["heel", "toe"] as const) {
      const hold = placeHold(section(sock1, id));
      expect(hold.orientation.carriageStartSide).toBe("right");
      expect(hold.orientation.holdHalf).toBe("left");
      expect(hold.orientation.workHalf).toBe("right");
      expect(hold.holdStitches).toBe(calc.heel.heldStitches);
      expect(hold.workStitches).toBe(calc.heel.workingStitches);
    }
  });

  it("mirrors Sock 2 setup onto the LEFT side of the bed", () => {
    for (const id of ["heel", "toe"] as const) {
      const hold = placeHold(section(sock2, id));
      expect(hold.orientation.carriageStartSide).toBe("left");
      expect(hold.orientation.holdHalf).toBe("right");
      expect(hold.orientation.workHalf).toBe("left");
    }
    const html = renderBasicSockInstructionsHtml(sock2);
    expect(html).toContain("carriage on the LEFT");
    expect(html).toContain("RIGHT half of the needles");
  });

  it("uses carriage-side decrease and opposite-carriage increase every row", () => {
    const heel = section(sock1, "heel");
    const decrease = shortRowIn(heel);
    const increase = shortRowOut(heel);
    expect(decrease.needleRelative).toBe("carriage-side");
    expect(decrease.everyRow).toBe(true);
    expect(decrease.rows).toBe(calc.heel.shortRowInSteps);
    expect(decrease.remainingStitches).toBe(calc.heel.remainingStitches);
    expect(increase.needleRelative).toBe("opposite-carriage");
    expect(increase.everyRow).toBe(true);
    expect(increase.rows).toBe(calc.heel.shortRowOutSteps);
    expect(increase.endWorkingStitches).toBe(calc.heel.workingStitches);
    const html = renderBasicSockInstructionsHtml(sock1);
    expect(html).toContain("On the carriage side, put 1 needle into hold and knit across");
    expect(html).toContain("Opposite the carriage, return 1 needle to work and knit across");
    expect(html).toContain("Repeat every row until");
    expect(html).not.toMatch(/RC 001:.*left needle/i);
  });

  it("warns to wrap the last short-row needle", () => {
    expect(section(sock1, "heel").steps).toContainEqual({ type: "short-row-wrap-warning" });
    expect(section(sock1, "toe").steps).toContainEqual({ type: "short-row-wrap-warning" });
    expect(renderBasicSockInstructionsHtml(sock1)).toContain(SOCK_SHORT_ROW_WRAP_WARNING);
  });
});

describe("future Kitchener-under variation stays a separate path", () => {
  it("does not use Kitchener in the v1 default Cuff-to-Toe document", () => {
    const calc = mustCalc(typicalMachine);
    const doc = buildBasicSockInstructions(calc, 1);
    expect(doc.toeFinishingVariation).toBe("bind-off-top");
    expect(stepTypes(section(doc, "finishing"))).not.toContain("kitchener");
    expect(stepTypes(section(doc, "finishing"))).toContain("bind-off-toe-seam");
  });

  it("keeps Kitchener-under as a distinct unused method, not a collapsed hybrid", () => {
    const calc = mustCalc(typicalMachine);
    const alternate = buildBasicSockInstructions(calc, 1, {
      toeFinishingVariation: "kitchener-under",
    });
    expect(alternate.toeFinishingVariation).toBe("kitchener-under");
    expect(stepTypes(section(alternate, "finishing"))).toEqual([
      "waste-yarn",
      "drop-from-machine",
      "kitchener",
      "seam",
      "block",
      "mirror-second-sock",
    ]);
    expect(stepTypes(section(alternate, "finishing"))).not.toContain("bind-off-toe-seam");
    expect(stepTypes(section(alternate, "finishing"))).not.toContain("rehang-toe");
    const kitchener = section(alternate, "finishing").steps.find((step) => step.type === "kitchener");
    expect(kitchener).toMatchObject({ placement: "under-toes" });
  });
});

