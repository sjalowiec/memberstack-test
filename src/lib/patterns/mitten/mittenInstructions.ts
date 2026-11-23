/**
 * Mitten instructions for a slotted thumb and a gored thumb.
 * Online and print both use {@link buildMittenPatternHtml}.
 * Fingertip steps come from the shared sock short-row builder.
 * Heel and toe wording is left unchanged.
 */

import { sockHoldOrientation, type SockInstructionStep, type SockOfPair } from "../sock/sockInstructionModel";
import { sockEnsureCarriageInstruction } from "../sock/sockInstructionRender";
import { buildSockShortRowInstructionSection } from "../sock/sockShortRowInstructions";
import {
  formatRowCounterResetGarmentRcLabel,
  rowCounterResetBlockHtml,
  rowCounterStopBlockHtml,
} from "../rowCounterReset";
import { sleevelessHelpVideoFromCatalog } from "../sleevelessCatalogHelpVideo";
import { mittenDiagramFigureHtml } from "./mittenDiagramSvg";
import {
  formatMittenLengthInches,
  mittenPhysicalLengths,
  type GoreThumbPlan,
  type MittenCalc,
} from "./mittenMath";

/** “Slotted Thumbs for Mittens”. Shown beside the slot instructions. */
export const MITTEN_SLOT_VIDEO_CONTENT_ID = 950;

/** “Gathered Top for Mittens and Hats”. Shown beside the gathered thumb finish. */
export const MITTEN_GATHERED_THUMB_VIDEO_CONTENT_ID = 587;

export type MittenSlotEdge = "right" | "left";

export type MittenInstructionSide = {
  id: "right-edge" | "left-edge";
  title: string;
  slotEdge: MittenSlotEdge;
  /** Carriage side for the first counted cuff row. Opposite the slot. */
  cuffCarriageSide: "left" | "right";
  sock: SockOfPair;
};

/**
 * Preview pairing: right-edge slot uses the sock's right working half,
 * left-edge slot uses the left working half. Which physical hand each
 * mitten fits, and which face is the palm, is not decided.
 */
export const MITTEN_INSTRUCTION_SIDES: readonly MittenInstructionSide[] = [
  {
    id: "right-edge",
    title: "Right-edge slot",
    slotEdge: "right",
    cuffCarriageSide: "left",
    sock: 1,
  },
  {
    id: "left-edge",
    title: "Left-edge slot",
    slotEdge: "left",
    cuffCarriageSide: "right",
    sock: 2,
  },
];

export const MITTEN_PREVIEW_ORIENTATION_NOTE =
  "This preview pairs the right-edge slot with fingertip shaping on the right half, and the left-edge slot with fingertip shaping on the left half. Which hand each mitten fits, and which face is the palm, is not decided.";

export const MITTEN_SECOND_MITTEN_INTRO =
  "Knit the second mitten the same way, working the slot at the opposite edge and the fingertip shaping on the opposite side.";

export const MITTEN_GORED_SECOND_MITTEN_INTRO =
  "Knit the second mitten the same way, working the thumb markers at the opposite edge and the fingertip shaping on the opposite side.";

export const MITTEN_GORED_PREVIEW_ORIENTATION_NOTE =
  "This preview pairs the right-edge thumb with fingertip shaping on the right half, and the left-edge thumb with fingertip shaping on the left half. Which hand each mitten fits, and which face is the palm, is not decided.";

const SIDE_LABEL = { left: "LEFT", right: "RIGHT" } as const;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fingertipSetupInstruction(side: "left" | "right"): string {
  return sockEnsureCarriageInstruction("heel", side).replace("the heel", "the fingertips");
}

function pointWord(count: number): string {
  return count === 1 ? "point" : "points";
}

function increaseParagraph(calc: MittenCalc): string {
  if (calc.increaseSts === 0) {
    return `<p data-block-line="increase">The cuff and hand stitch counts match. Continue on ${calc.handSts} stitches.</p>`;
  }
  return (
    `<p data-block-line="increase">Increase ${calc.increaseSts} stitches evenly across the row. ` +
    `Leave 1 needle empty at ${calc.increaseSts} ${pointWord(calc.increaseSts)} across the row, spacing them evenly. ` +
    `Put the empty needles back into work and fill each one by picking up the strand from the row below. ` +
    `(${calc.handSts} stitches)</p>`
  );
}

function renderFingertipStep(step: SockInstructionStep, calc: MittenCalc): string {
  switch (step.type) {
    case "stop-rc":
      return `<div data-step="stop-rc">${rowCounterStopBlockHtml(step.garmentRc ?? calc.handEndRc)}</div>`;
    case "ensure-carriage":
      return `<p data-step="ensure-carriage">${escapeHtml(fingertipSetupInstruction(step.side))}</p>`;
    case "place-hold":
      return (
        `<p data-step="place-hold">Begin with the carriage on the ${SIDE_LABEL[step.orientation.carriageStartSide]}. ` +
        `Put the ${SIDE_LABEL[step.orientation.holdHalf]} half of the needles (${step.holdStitches} stitches), opposite the carriage, into hold. ` +
        `The ${SIDE_LABEL[step.orientation.workHalf]} half (${step.workStitches} stitches) remains in work. Set the carriage to HOLD.</p>`
      );
    case "short-row-in":
      return (
        `<p data-step="short-row-in">On the carriage side, put 1 needle into hold, automatic wrap, and knit across. ` +
        `Repeat every row until ${step.remainingStitches} center stitches remain.</p>`
      );
    case "short-row-out":
      return (
        `<p data-step="short-row-out">Opposite the carriage, return 1 needle to work and knit across. ` +
        `Repeat every row until all ${step.endWorkingStitches} working stitches are back in work.</p>`
      );
    case "cancel-hold-return":
      return (
        `<p data-step="cancel-hold-return">Cancel HOLD. Return the previously held half (${step.heldStitches} stitches) to working position. ` +
        `(${step.tubeStitches} stitches)</p>`
      );
    default:
      throw new Error(`Mitten fingertips received an unexpected shared step: ${step.type}`);
  }
}

function fingertipSection(calc: MittenCalc, side: MittenInstructionSide): string {
  const orientation = sockHoldOrientation(side.sock, "heel");
  const section = buildSockShortRowInstructionSection({
    part: "heel",
    shaping: calc.fingertip,
    orientation,
    tubeStitches: calc.handSts,
    constructionDirection: "cuff-to-toe",
    sock: side.sock,
    arriveRc: calc.handEndRc,
  });
  const steps = section.steps.map((step) => renderFingertipStep(step, calc)).join("\n");
  return `<section data-block="fingertips"><h3>Fingertips</h3>\n${steps}</section>`;
}

function mittenVideoButton(contentId: number, hook: string): string {
  const video = sleevelessHelpVideoFromCatalog(contentId);
  if (!video) return "";
  return (
    `<p class="pattern-help-link no-print">` +
    `<button type="button" class="video-button kbm-kin-catalog-video pattern-help-link__button"` +
    ` data-vimeo-id="${escapeHtml(video.id)}"` +
    ` data-video-title="${escapeHtml(video.title)}"` +
    ` data-content-id="${contentId}"` +
    ` data-video-autoplay="false"` +
    ` data-vimeo-defer` +
    ` ${hook}` +
    ` aria-haspopup="dialog">` +
    `<i class="fa-solid fa-play" aria-hidden="true"></i> Watch: ${escapeHtml(video.title)}</button></p>`
  );
}

function rcEnd(name: string, rows: number): string {
  return `<p class="mitten-rc-end" data-rc-end="${name}">${formatRowCounterResetGarmentRcLabel(rows)}</p>`;
}

function needleWord(count: number): string {
  return count === 1 ? "needle" : "needles";
}

function goreMarkerSplit(calc: MittenCalc, gore: GoreThumbPlan): {
  intoHand1: number;
  lowerAt: number;
  upperInStraight: number;
  afterUpper: number;
} {
  const upperInStraight = Math.min(gore.markerRows, calc.straightRows);
  const intoHand1 = gore.markerRows - upperInStraight;
  return {
    intoHand1,
    lowerAt: calc.hand1Rows - intoHand1,
    upperInStraight,
    afterUpper: calc.straightRows - upperInStraight,
  };
}

function goredMarkerSection(calc: MittenCalc, gore: GoreThumbPlan): string {
  const split = goreMarkerSplit(calc, gore);
  const placeLower =
    split.intoHand1 === 0
      ? `<p>At the end of Hand 1, place the lower thumb marker on each edge. This marker is nearest the cuff.</p>`
      : `<p>During Hand 1, place the lower thumb marker on each edge at ${formatRowCounterResetGarmentRcLabel(split.lowerAt)}. This marker is nearest the cuff.</p>`;
  return `<section data-block="markers">
    <h3>Thumb markers</h3>
    ${placeLower}
    <p>On each hand edge, the lower and upper markers are ${gore.markerRows} rows apart. That distance is half the thumb circumference.</p>
  </section>`;
}

function goredStraightSection(calc: MittenCalc, gore: GoreThumbPlan): string {
  const split = goreMarkerSplit(calc, gore);
  const placeUpper =
    split.upperInStraight > 0
      ? `<p>Knit ${split.upperInStraight} rows across all ${calc.handSts} stitches, then place the upper thumb marker on each edge.</p>`
      : `<p>Place the upper thumb marker on each edge at the start of this section.</p>`;
  const rest =
    split.afterUpper > 0
      ? `<p>Knit ${split.afterUpper} more rows across all ${calc.handSts} stitches.</p>`
      : "";
  return `<section data-block="straight">
    <h3>Hand above the thumb</h3>
    ${placeUpper}
    ${rest}
    ${rcEnd("straight", calc.handEndRc)}
  </section>`;
}

function goredThumbSection(calc: MittenCalc, gore: GoreThumbPlan): string {
  const start =
    gore.heldEachSide === 0
      ? `<p>Return ${gore.startWorkingNeedles} center ${needleWord(gore.startWorkingNeedles)} to working position. All ${gore.pickupNeedles} needles are working.</p>`
      : `<p>Return ${gore.startWorkingNeedles} center needles to working position. Arrange the starting group in the center. ${gore.heldEachSide} needles stay in hold on each side.</p>
    <p>Knit across and wrap the first held needle.</p>
    <p>Opposite the carriage, return 2 needles to working position. Knit across and wrap the first held needle at that edge if one remains. Repeat, alternating sides, until all needles are working. When fewer than 2 needles remain in hold at that edge, return only those needles.</p>`;
  return `<section data-block="thumb">
    <h3>Gored thumb</h3>
    <p>With the wrong side facing, rehang the first edge between the markers on the left needles. Position the marker nearest the cuff at machine zero. Rehang ${gore.firstEdgeStitches} stitches from this edge.</p>
    <p>Fold the mitten, push the cuff away, and rehang the other edge on the right needles. Rehang ${gore.otherEdgeStitches} stitches from this edge. Double up on the center needle to prevent a hole. This does not add another needle. (${gore.pickupNeedles} needles)</p>
    <p>The ${gore.pickupNeedles} stitches rehung from both edges are the thumb circumference times the stitch gauge, plus 2 seam stitches. Spread them between the markers. Do not pick up one stitch for every row.</p>
    <p>Put all needles into hold and set the carriage to HOLD.</p>
    ${start}
    <p>Cancel HOLD and knit ${calc.thumbRows} rows. This is the thumb length from the web to the tip. The gore is below the web, so these rows do not include the gore short rows.</p>
    ${rcEnd("thumb", calc.thumbRows)}
    <p>Before the final closing row, transfer every other stitch to its neighbor and knit one row.</p>
    <p>Break the yarn, thread the tail through the remaining stitches, gather the tip, and use the tail to seam.</p>
    ${mittenVideoButton(MITTEN_GATHERED_THUMB_VIDEO_CONTENT_ID, 'data-mitten-gathered-thumb-video')}
  </section>`;
}

function oneMittenHtml(
  calc: MittenCalc,
  side: MittenInstructionSide,
  intro: string,
  hidden: boolean,
): string {
  const slotLabel = SIDE_LABEL[side.slotEdge];
  const carriageLabel = SIDE_LABEL[side.cuffCarriageSide];
  const shaped = calc.fingertip.workingStitches;
  const held = calc.fingertip.heldStitches;
  const gore = calc.gore;
  const title = gore
    ? side.slotEdge === "right"
      ? "Right-edge thumb"
      : "Left-edge thumb"
    : side.title;
  const introHtml = intro ? `<p data-block-line="second-mitten">${escapeHtml(intro)}</p>` : "";
  const handAbove = gore
    ? `${goredMarkerSection(calc, gore)}
  ${goredStraightSection(calc, gore)}`
    : `<section data-block="slot">
    <h3>Thumb slot</h3>
    <p>Starting at the outermost needle on the ${slotLabel}, work the ${calc.slotSts} slot stitches by hand: knit 1 row with waste yarn, 1 row with ravel cord, then 1 row with waste yarn.</p>
    <p>These hand-worked rows do not count on the row counter.</p>
    ${mittenVideoButton(MITTEN_SLOT_VIDEO_CONTENT_ID, 'data-mitten-slot-video')}
  </section>
  <section data-block="straight">
    <h3>Hand above the thumb</h3>
    <p>Knit ${calc.straightRows} rows across all ${calc.handSts} stitches with the main yarn. Row 1 is the full-width row immediately after the slot.</p>
    ${rcEnd("straight", calc.handEndRc)}
  </section>`;
  const thumb = gore
    ? goredThumbSection(calc, gore)
    : `<section data-block="thumb">
    <h3>Rehang and knit the thumb</h3>
    <p>Remove the ravel cord and rehang the waste yarn stitches with the wrong side facing. Leave one empty needle in the center, with ${calc.slotSts} stitches on each side of it.</p>
    <p>Unknit the waste yarn.</p>
    <p>Pick up two purl bumps from the row below and place both on the center needle. (${calc.thumbSts} stitches)</p>
    <p>Continue knitting the mitten.</p>
    <div data-step="thumb-reset">${rowCounterResetBlockHtml(0)}</div>
    <p>Knit ${calc.thumbRows} rows.</p>
    ${rcEnd("thumb", calc.thumbRows)}
    <p>Break the yarn, leaving a 12" tail. Thread the tail through the remaining ${calc.thumbSts} stitches and remove the stitches from the machine. Pull the tail firmly to gather the top of the thumb and secure.</p>
    ${mittenVideoButton(MITTEN_GATHERED_THUMB_VIDEO_CONTENT_ID, 'data-mitten-gathered-thumb-video')}
  </section>`;
  const seam = gore
    ? `<ol>
      <li>Seam from the cast-on edge through the cuff and Hand 1 to the lower thumb marker.</li>
      <li>The gore joins the edges between the markers as those stitches are rehung.</li>
      <li>Use the thumb tail to seam the thumb.</li>
      <li>Seam from the upper thumb marker to the closed fingertips.</li>
    </ol>`
    : `<ol>
      <li>Seam from the cast-on edge through the cuff and Hand 1 to the thumb opening.</li>
      <li>Seam the thumb edges.</li>
      <li>Seam Hand 2 from the thumb opening to the closed fingertips.</li>
    </ol>`;
  return `<section class="mitten-panel" data-mitten="${side.id}" data-testid="mitten-${side.id}"${hidden ? " hidden" : ""}>
  <h2>${escapeHtml(title)}</h2>
  <div class="mitten-pattern-split">
  ${mittenDiagramFigureHtml(calc, side.slotEdge)}
  <div class="mitten-instruction-copy">
  ${introHtml}
  <section data-block="cast-on">
    <h3>Cast on and cuff</h3>
    <p>Cast on ${calc.cuffSts} stitches.</p>
    <p>Complete cast-on setup before the counted cuff rows.</p>
    <p data-carriage="cuff">Begin the counted cuff rows with the carriage on the ${carriageLabel}.</p>
    <div data-step="cuff-reset">${rowCounterResetBlockHtml(0)}</div>
    <p>Knit ${calc.cuffRows} rows in your choice of cuff pattern.</p>
    ${rcEnd("cuff", calc.cuffRows)}
  </section>
  <section data-block="transfer">
    <p>If needed, transfer the ribber stitches to the main bed.</p>
  </section>
  <section data-block="increase">
    <h3>Increase to hand width</h3>
    ${increaseParagraph(calc)}
  </section>
  <section data-block="hand-1">
    <h3>Hand below the thumb</h3>
    <div data-step="hand-reset">${rowCounterResetBlockHtml(0)}</div>
    <p>Knit ${calc.hand1Rows} rows. (${calc.handSts} stitches)</p>
    ${rcEnd("hand-1", calc.hand1Rows)}
  </section>
  ${handAbove}
  ${fingertipSection(calc, side)}
  <section data-block="close">
    <h3>Close the top</h3>
    <p>Scrap all ${calc.handSts} stitches off the machine with contrasting waste yarn and remove the work from the machine.</p>
    <p>Join the ${shaped} stitches of the shaped half to the ${held} stitches of the other half using Kitchener stitch, by hand or on the machine.</p>
  </section>
  ${thumb}
  <section data-block="seam">
    <h3>Seaming</h3>
    <p>Using mattress stitch or your preferred method:</p>
    ${seam}
  </section>
  </div>
  </div>
</section>`;
}

/** One instruction document for the screen and for print. */
export function buildMittenPatternHtml(calc: MittenCalc): string {
  const secondIntro = calc.gore ? MITTEN_GORED_SECOND_MITTEN_INTRO : MITTEN_SECOND_MITTEN_INTRO;
  const previewNote = calc.gore ? MITTEN_GORED_PREVIEW_ORIENTATION_NOTE : MITTEN_PREVIEW_ORIENTATION_NOTE;
  const panels = MITTEN_INSTRUCTION_SIDES.map((side, index) =>
    oneMittenHtml(calc, side, index === 1 ? secondIntro : "", index > 0),
  ).join("\n");
  return `<div class="mitten-instructions" data-testid="mitten-instructions" data-print-source="mitten-instructions" data-thumb-style="${calc.thumbStyle}">
  <style>
    .mitten-pattern-split { display: grid; grid-template-columns: minmax(260px, 46%) minmax(0, 1fr); gap: 1.25rem; align-items: start; }
    .mitten-diagrams { margin: 0; }
    .mitten-diagrams svg { width: 100%; height: auto; display: block; }
    .mitten-diagram-note { margin: 0.75rem 0 0; font-size: 0.95rem; line-height: 1.45; color: #1a1a1a; }
    @media (max-width: 860px) {
      .mitten-pattern-split { grid-template-columns: 1fr; }
    }
    @media print {
      .mitten-panel[hidden] { display: block !important; }
      .mitten-pattern-split { grid-template-columns: 1fr; }
      .mitten-diagrams, .mitten-diagram-note { break-inside: avoid; }
    }
  </style>
  <p class="mitten-preview-note">${escapeHtml(previewNote)}</p>
  ${panels}
</div>`;
}

export function mittenCountSummary(calc: MittenCalc): Array<{ label: string; value: string }> {
  const gauge = calc.stitchGaugePerInch;
  const knittedThumbInches = calc.thumbSts / gauge;
  const seamedThumbInches = (calc.thumbSts - 2) / gauge;
  const formatInches = (inches: number) => `${Math.round(inches * 100) / 100} in`;
  const lengths = mittenPhysicalLengths(calc);
  const length = (inches: number) => `${formatMittenLengthInches(inches)} in`;
  return [
    { label: "Calculated cuff length", value: length(lengths.cuffLengthIn) },
    { label: "Calculated Hand 1 length", value: length(lengths.hand1LengthIn) },
    { label: "Calculated Hand 2 length", value: length(lengths.hand2LengthIn) },
    { label: "Calculated mitten length", value: length(lengths.totalLengthIn) },
    { label: "Fingertip setup row", value: length(lengths.setupRowIn) },
    { label: "Cuff stitches", value: String(calc.cuffSts) },
    { label: "Cuff rows", value: String(calc.cuffRows) },
    { label: "Hand stitches", value: String(calc.handSts) },
    { label: "Increases", value: String(calc.increaseSts) },
    { label: "Hand 1 rows", value: String(calc.hand1Rows) },
    { label: "Straight rows", value: String(calc.straightRows) },
    { label: "Fingertip depth rows", value: String(calc.fingertip.shortRowDepthRows) },
    { label: "Fingertip knitted rows", value: String(calc.fingertip.shortRowKnittingRows) },
    ...(calc.gore
      ? [
          { label: "Thumb pickup needles", value: String(calc.gore.pickupNeedles) },
          {
            label: "Stitches from each edge",
            value: `${calc.gore.firstEdgeStitches} and ${calc.gore.otherEdgeStitches}`,
          },
          { label: "Marker rows on each edge", value: String(calc.gore.markerRows) },
          { label: "Gored thumb starting needles", value: String(calc.gore.startWorkingNeedles) },
          { label: "Held needles on each side", value: String(calc.gore.heldEachSide) },
        ]
      : [{ label: "Slot stitches", value: String(calc.slotSts) }]),
    { label: "Thumb stitches", value: String(calc.thumbSts) },
    { label: "Thumb rows", value: String(calc.thumbRows) },
    {
      label: "Target knitted thumb stitches",
      value: String(Math.round(calc.targetKnittedThumbStitches * 100) / 100),
    },
    { label: "Thumb knitted width", value: formatInches(knittedThumbInches) },
    { label: "Thumb width after 2-stitch seam", value: formatInches(seamedThumbInches) },
  ];
}
