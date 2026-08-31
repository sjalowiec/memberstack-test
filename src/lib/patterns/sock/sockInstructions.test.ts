import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  calculateBasicSockPattern,
  type BasicSockCalc,
  type BasicSockCalcInput,
} from "./sockMath";
import {
  SOCK_SHORT_ROW_WRAP_WARNING,
  SOCK_TOE_FINISHING_DEFAULT,
  SOCK_TOE_UP_OPENING_SECTION_TITLE,
  BICKFORD_SEAM_GLOSSARY_ID,
  BICKFORD_SEAM_GLOSSARY_TERM,
  KITCHENER_STITCH_GLOSSARY_ID,
  KITCHENER_STITCH_GLOSSARY_TERM,
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
  buildBasicSockInstructionPair,
  buildBasicSockInstructions,
  formatSockInstructionOutline,
  renderBasicSockInstructionsHtml,
  sockHoldOrientation,
  sockInstructionSectionIds,
  type SockInstructionDocument,
  type SockInstructionSection,
  type SockInstructionSectionId,
  type SockInstructionStep,
} from "./sockInstructions";
import { RESET_ROW_COUNTER_TEXT, STOP_ROW_COUNTER_TEXT } from "../rowCounterReset";
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
    expect(entry.rc.startRc).toBe(0);
    expect(entry.rc.resetAtStart).toBe(true);
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
      "place-hold",
      "short-row-in",
      "short-row-wrap-warning",
      "short-row-out",
      "cancel-hold-return",
    ]);
    expect(stepTypes(section(sock1, "toe"))).toEqual([
      "reset-rc",
      "place-hold",
      "short-row-in",
      "short-row-wrap-warning",
      "short-row-out",
      "cancel-hold-return",
    ]);
    expect(calc.heel).toEqual(calc.toe);
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
    expect(html).toContain(RESET_ROW_COUNTER_TEXT);
    expect(html).toContain("carriage on the RIGHT");
    expect(html).toContain("LEFT half of the needles");
    expect(html).toContain("opposite the carriage");
    expect(html).toContain("On the carriage side, put 1 needle into hold");
    expect(html).toContain("Opposite the carriage, return 1 needle to work");
    expect(html).toContain("Repeat every row");
    expect(html).toContain(SOCK_SHORT_ROW_WRAP_WARNING);
    expect(html).toContain("at each side");
    expect(html).toContain("contrasting waste yarn");
    expect(html).toContain("Finish the toe using");
    expect(html).toContain(BICKFORD_SEAM_GLOSSARY_TERM);
    expect(html).toContain(KITCHENER_STITCH_GLOSSARY_TERM);
    expect(html).toContain("(Grafting).");
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
    expect(toeUp).not.toContain(`player.vimeo.com/video/${SOCK_HEEL_VIDEO_VIMEO_ID}`);
    expect(toeUp).not.toContain(`player.vimeo.com/video/${SOCK_TOE_VIDEO_VIMEO_ID}`);
    expect(toeUp).not.toContain(`player.vimeo.com/video/${SOCK_TOE_FINISHING_VIDEO_VIMEO_ID}`);
    expect(toeUp).not.toContain(`data-tip-id="${SOCK_HEEL_VIDEO_TIP_ID}"`);
    expect(toeUp).not.toContain(`data-tip-id="${SOCK_TOE_VIDEO_TIP_ID}"`);
    expect(toeUp).not.toContain(`data-tip-id="${SOCK_TOE_FINISHING_VIDEO_TIP_ID}"`);
    expect(toeUp).not.toContain(`data-tip-id="${SOCK_WHY_STOP_ROW_COUNTER_TIP_ID}"`);
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
    expect(outline).toContain(
      `Finish the toe using ${BICKFORD_SEAM_GLOSSARY_TERM} or ${KITCHENER_STITCH_GLOSSARY_TERM} (Grafting).`,
    );
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
    expect(ankle).toContain("RC: 000");
    expect(ankle).not.toContain(RESET_ROW_COUNTER_TEXT);
    expect(ankle).not.toContain(STOP_ROW_COUNTER_TEXT);
    const heel = sectionHtml(html, "heel");
    expect(heel).toContain(STOP_ROW_COUNTER_TEXT);
    expect(heel).not.toContain(RESET_ROW_COUNTER_TEXT);
    expect(sectionHtml(html, "toe")).toContain(RESET_ROW_COUNTER_TEXT);
    expect(sectionHtml(html, "foot")).toContain(RESET_ROW_COUNTER_TEXT);
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
    const heel = sectionHtml(html, "heel");
    const stopIdx = heel.indexOf(STOP_ROW_COUNTER_TEXT);
    const holdIdx = heel.indexOf("Put the LEFT half of the needles");
    expect(stopIdx).toBeGreaterThanOrEqual(0);
    expect(holdIdx).toBeGreaterThan(stopIdx);
    expect(formatSockInstructionOutline(doc)).toContain(STOP_ROW_COUNTER_TEXT);
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
    expect(finishing).toContain("Finish the toe using");
    expect(finishing).toContain("(Grafting).");
    expect(finishing).not.toContain("Bind off the toe seam");
    expect(finishing).not.toContain("top of the toes");
    expect(finishing).not.toContain("under the toes");
    expect(glossarySlugForId(BICKFORD_SEAM_GLOSSARY_ID)).toBe("bickford-seam");
    expect(glossarySlugForId(KITCHENER_STITCH_GLOSSARY_ID)).toBe("kitchener-stitch");
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

