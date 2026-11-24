/**
 * Mitten instructions for a slotted thumb and a gored thumb.
 * Online and print both use {@link buildMittenPatternHtml}.
 * Fingertip steps come from the shared sock short-row builder.
 * The finished page uses the sweater instruction blocks and Garment Dimensions panel.
 */

import { buildGlossaryTooltipPlaceholderHtml } from "../../glossary/glossaryTooltipPrint";
import { inlineRcHeadingLine } from "../inlineRcHeading";
import {
  formatRowCounterResetGarmentRcLabel,
  rowCounterStopBlockHtml,
} from "../rowCounterReset";
import type { SleevelessPatternDisplayRow } from "../sleevelessPatternOutput";
import { renderPatternDisplayRowsHtml } from "../sleevelessPatternDisplayHtml";
import { sleevelessHelpVideoFromCatalog } from "../sleevelessCatalogHelpVideo";
import {
  buildSingleShortRowShapingMap,
  MITTEN_TOP_SHAPING_MAP_TITLE,
  renderHeelToeShapingMapHtml,
} from "../heelToeShapingMap";
import {
  sockHoldOrientation,
  type SockInstructionSection,
  type SockInstructionStep,
  type SockOfPair,
} from "../sock/sockInstructionModel";
import { sockEnsureCarriageInstruction } from "../sock/sockInstructionRender";
import { buildSockShortRowInstructionSection } from "../sock/sockShortRowInstructions";
import type { PatternInpageNavItem } from "../patternInpageNav";
import { buildMittenDiagramTabsHtml } from "./mittenPatternDiagramTabs";
import {
  MITTEN_INCREASE_EVENLY_GLOSSARY_ID,
  MITTEN_INCREASE_EVENLY_GLOSSARY_TERM,
} from "./mittenShapingNotation";
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
    sock: 1,
  },
  {
    id: "left-edge",
    title: "Left-edge slot",
    slotEdge: "left",
    sock: 2,
  },
];

export const MITTEN_CUFF_START_CARRIAGE =
  "At RC: 000, the carriage is on the RIGHT.";

export const MITTEN_SECOND_MITTEN_INTRO =
  "Knit the second mitten the same way, working the slot at the opposite edge and the fingertip shaping on the opposite side.";

export const MITTEN_GORED_SECOND_MITTEN_INTRO =
  "Knit the second mitten the same way, working the thumb markers at the opposite edge and the fingertip shaping on the opposite side.";

const SIDE_LABEL = { left: "LEFT", right: "RIGHT" } as const;

/** Section id produced by the shared pattern renderer for one mitten. */
export function mittenPatternSectionId(sideId: MittenInstructionSide["id"], slug: string): string {
  return `sg-${sideId}-${slug}`;
}

/** Sticky section links for the mitten currently on screen. */
export function mittenPatternInpageNavItems(
  sideId: MittenInstructionSide["id"],
  thumbStyle: MittenCalc["thumbStyle"],
): PatternInpageNavItem[] {
  const sections = [
    { label: "Cuff", slug: "cast-on-and-cuff" },
    { label: "Hand", slug: "hand-below-the-thumb" },
    { label: "Fingertips", slug: "fingertips" },
    { label: "Thumb", slug: thumbStyle === "gored" ? "gored-thumb" : "rehang-and-knit-the-thumb" },
    { label: "Finishing", slug: "seaming" },
  ];
  return sections.map((section) => ({
    label: section.label,
    ids: [mittenPatternSectionId(sideId, section.slug)],
  }));
}

type InstructionBlock = Extract<SleevelessPatternDisplayRow, { kind: "block" }>;

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

function needleWord(count: number): string {
  return count === 1 ? "needle" : "needles";
}

function blockMarker(name: string): string {
  return `<div data-block="${name}" hidden></div>`;
}

function rcLine(rows: number): string {
  return inlineRcHeadingLine(formatRowCounterResetGarmentRcLabel(rows));
}

function instructionBlock(args: {
  lines: string[];
  stitchCount?: number;
  stitchCensus?: { working: number; held: number; total: number };
  reset?: boolean;
}): InstructionBlock {
  return {
    kind: "block",
    trustedParagraphs: args.lines,
    ...(args.stitchCount !== undefined ? { stitchCount: args.stitchCount } : {}),
    ...(args.stitchCensus && args.stitchCensus.held > 0 ? { stitchCensus: args.stitchCensus } : {}),
    ...(args.reset ? { rowCounterReset: true, rowCounterResetGarmentRc: 0 } : {}),
  };
}

function section(title: string, blocks: InstructionBlock[]): SleevelessPatternDisplayRow[] {
  return [{ kind: "section", title }, ...blocks];
}

function increaseLines(calc: MittenCalc): string[] {
  if (calc.increaseSts === 0) {
    return [`The cuff and hand stitch counts match. Continue on ${calc.handSts} stitches.`];
  }
  const increaseEvenly = buildGlossaryTooltipPlaceholderHtml(
    MITTEN_INCREASE_EVENLY_GLOSSARY_ID,
    "Increase evenly",
    escapeHtml,
    escapeHtml,
    { ariaLabel: MITTEN_INCREASE_EVENLY_GLOSSARY_TERM },
  );
  return [
    `${increaseEvenly} ${calc.increaseSts} stitches across the row. ` +
      `Leave 1 needle empty at ${calc.increaseSts} ${pointWord(calc.increaseSts)} across the row, spacing them evenly. ` +
      `Put the empty needles back into work and fill each one by picking up the strand from the row below. ` +
      `(${calc.handSts} stitches)`,
  ];
}

function stepWrap(step: string, inner: string): string {
  return `<div data-step="${step}">${inner}</div>`;
}

function stepLine(step: string, text: string): string {
  return stepWrap(step, `<p class="sleeveless-pattern-line">${escapeHtml(text)}</p>`);
}

function mittenVideoButton(contentId: number, hook: string): string {
  const video = sleevelessHelpVideoFromCatalog(contentId);
  if (!video) return "";
  return (
    `<div class="pattern-help-link no-print">` +
    `<button type="button" class="video-button kbm-kin-catalog-video pattern-help-link__button"` +
    ` data-vimeo-id="${escapeHtml(video.id)}"` +
    ` data-video-title="${escapeHtml(video.title)}"` +
    ` data-content-id="${contentId}"` +
    ` data-video-autoplay="false"` +
    ` data-vimeo-defer` +
    ` ${hook}` +
    ` aria-haspopup="dialog">` +
    `<i class="fa-solid fa-play" aria-hidden="true"></i> Watch: ${escapeHtml(video.title)}</button></div>`
  );
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

function fingertipBlock(step: SockInstructionStep, calc: MittenCalc, lead: string[]): InstructionBlock {
  switch (step.type) {
    case "stop-rc":
      return instructionBlock({
        lines: [...lead, stepWrap("stop-rc", rowCounterStopBlockHtml(step.garmentRc ?? calc.handEndRc))],
        stitchCount: calc.handSts,
      });
    case "ensure-carriage":
      return instructionBlock({
        lines: [...lead, stepLine("ensure-carriage", fingertipSetupInstruction(step.side))],
        stitchCount: calc.handSts,
      });
    case "place-hold":
      return instructionBlock({
        lines: [
          ...lead,
          stepLine(
            "place-hold",
            `Begin with the carriage on the ${SIDE_LABEL[step.orientation.carriageStartSide]}. ` +
              `Put the ${SIDE_LABEL[step.orientation.holdHalf]} half of the needles (${step.holdStitches} stitches), opposite the carriage, into hold. ` +
              `The ${SIDE_LABEL[step.orientation.workHalf]} half (${step.workStitches} stitches) remains in work. Set the carriage to HOLD.`,
          ),
        ],
        stitchCensus: {
          working: step.workStitches,
          held: step.holdStitches,
          total: step.workStitches + step.holdStitches,
        },
      });
    case "short-row-in":
      return instructionBlock({
        lines: [
          ...lead,
          stepLine(
            "short-row-in",
            `On the carriage side, put 1 needle into hold, automatic wrap, and knit across. ` +
              `Repeat every row until ${step.remainingStitches} center stitches remain.`,
          ),
        ],
        stitchCensus: {
          working: step.remainingStitches,
          held: calc.handSts - step.remainingStitches,
          total: calc.handSts,
        },
      });
    case "short-row-out":
      return instructionBlock({
        lines: [
          ...lead,
          stepLine(
            "short-row-out",
            `Opposite the carriage, return 1 needle to work and knit across. ` +
              `Repeat every row until all ${step.endWorkingStitches} working stitches are back in work.`,
          ),
        ],
        stitchCensus: {
          working: step.endWorkingStitches,
          held: calc.handSts - step.endWorkingStitches,
          total: calc.handSts,
        },
      });
    case "cancel-hold-return":
      return instructionBlock({
        lines: [
          ...lead,
          stepLine(
            "cancel-hold-return",
            `Cancel HOLD. Return the previously held half (${step.heldStitches} stitches) to working position. ` +
              `(${step.tubeStitches} stitches)`,
          ),
        ],
        stitchCount: step.tubeStitches,
      });
    default:
      throw new Error(`Mitten fingertips received an unexpected shared step: ${step.type}`);
  }
}

function fingertipSection(calc: MittenCalc, side: MittenInstructionSide): SockInstructionSection {
  return buildSockShortRowInstructionSection({
    part: "heel",
    shaping: calc.fingertip,
    orientation: sockHoldOrientation(side.sock, "heel"),
    tubeStitches: calc.handSts,
    constructionDirection: "cuff-to-toe",
    sock: side.sock,
    arriveRc: calc.handEndRc,
  });
}

function mittenTopShapingMapHtml(section: SockInstructionSection): string {
  const built = buildSingleShortRowShapingMap(section, {
    title: MITTEN_TOP_SHAPING_MAP_TITLE,
    marker: "mitten-top",
  });
  return built.ok ? renderHeelToeShapingMapHtml(built.map) : "";
}

function fingertipRows(calc: MittenCalc, side: MittenInstructionSide): SleevelessPatternDisplayRow[] {
  const sectionSteps = fingertipSection(calc, side);
  const mapHtml = mittenTopShapingMapHtml(sectionSteps);
  const blocks: InstructionBlock[] = [];
  sectionSteps.steps.forEach((step, index) => {
    blocks.push(fingertipBlock(step, calc, index === 0 ? [blockMarker("fingertips")] : []));
    if (step.type === "ensure-carriage" && mapHtml) {
      blocks.push(instructionBlock({ lines: [mapHtml] }));
    }
  });
  return section("Fingertips", blocks);
}

function markerRows(calc: MittenCalc, gore: GoreThumbPlan): SleevelessPatternDisplayRow[] {
  const split = goreMarkerSplit(calc, gore);
  const placeLower =
    split.intoHand1 === 0
      ? "At the end of Hand 1, place the lower thumb marker on each edge. This marker is nearest the cuff."
      : `During Hand 1, place the lower thumb marker on each edge at ${formatRowCounterResetGarmentRcLabel(split.lowerAt)}. This marker is nearest the cuff.`;
  return section("Thumb markers", [
    instructionBlock({
      lines: [
        blockMarker("markers"),
        placeLower,
        `On each hand edge, the lower and upper markers are ${gore.markerRows} rows apart. That distance is half the thumb circumference.`,
      ],
      stitchCount: calc.handSts,
    }),
  ]);
}

function straightRows(calc: MittenCalc, gore: GoreThumbPlan | null): SleevelessPatternDisplayRow[] {
  if (!gore) {
    return section("Hand above the thumb", [
      instructionBlock({
        lines: [
          blockMarker("straight"),
          `Knit ${calc.straightRows} rows across all ${calc.handSts} stitches with the main yarn. Row 1 is the full-width row immediately after the slot.`,
          rcLine(calc.handEndRc),
        ],
        stitchCount: calc.handSts,
      }),
    ]);
  }
  const split = goreMarkerSplit(calc, gore);
  const lines = [blockMarker("straight")];
  lines.push(
    split.upperInStraight > 0
      ? `Knit ${split.upperInStraight} rows across all ${calc.handSts} stitches, then place the upper thumb marker on each edge.`
      : "Place the upper thumb marker on each edge at the start of this section.",
  );
  if (split.afterUpper > 0) {
    lines.push(`Knit ${split.afterUpper} more rows across all ${calc.handSts} stitches.`);
  }
  lines.push(rcLine(calc.handEndRc));
  return section("Hand above the thumb", [
    instructionBlock({ lines, stitchCount: calc.handSts }),
  ]);
}

function goredThumbRows(calc: MittenCalc, gore: GoreThumbPlan): SleevelessPatternDisplayRow[] {
  const lines = [
    blockMarker("thumb"),
    "With the wrong side facing, rehang the first edge between the markers on the left needles. Position the marker nearest the cuff at machine zero. Rehang " +
      `${gore.firstEdgeStitches} stitches from this edge.`,
    `Fold the mitten, push the cuff away, and rehang the other edge on the right needles. Rehang ${gore.otherEdgeStitches} stitches from this edge. Double up on the center needle to prevent a hole. This does not add another needle. (${gore.pickupNeedles} needles)`,
    `The ${gore.pickupNeedles} stitches rehung from both edges are the thumb circumference times the stitch gauge, plus 2 seam stitches. Spread them between the markers. Do not pick up one stitch for every row.`,
    "Put all needles into hold and set the carriage to HOLD.",
  ];
  if (gore.heldEachSide === 0) {
    lines.push(
      `Return ${gore.startWorkingNeedles} center ${needleWord(gore.startWorkingNeedles)} to working position. All ${gore.pickupNeedles} needles are working.`,
    );
  } else {
    lines.push(
      `Return ${gore.startWorkingNeedles} center needles to working position. Arrange the starting group in the center. ${gore.heldEachSide} needles stay in hold on each side.`,
      "Knit across and wrap the first held needle.",
      "Opposite the carriage, return 2 needles to working position. Knit across and wrap the first held needle at that edge if one remains. Repeat, alternating sides, until all needles are working. When fewer than 2 needles remain in hold at that edge, return only those needles.",
    );
  }
  lines.push(
    `Cancel HOLD and knit ${calc.thumbRows} rows. This is the thumb length from the web to the tip. The gore is below the web, so these rows do not include the gore short rows.`,
    rcLine(calc.thumbRows),
    "Before the final closing row, transfer every other stitch to its neighbor and knit one row.",
    "Break the yarn, thread the tail through the remaining stitches, gather the tip, and use the tail to seam.",
  );
  const video = mittenVideoButton(MITTEN_GATHERED_THUMB_VIDEO_CONTENT_ID, "data-mitten-gathered-thumb-video");
  if (video) lines.push(video);
  return section("Gored thumb", [
    instructionBlock({ lines, stitchCount: gore.pickupNeedles }),
  ]);
}

function slottedThumbRows(calc: MittenCalc): SleevelessPatternDisplayRow[] {
  const video = mittenVideoButton(MITTEN_GATHERED_THUMB_VIDEO_CONTENT_ID, "data-mitten-gathered-thumb-video");
  return section("Rehang and knit the thumb", [
    instructionBlock({
      lines: [
        blockMarker("thumb"),
        `Remove the ravel cord and rehang the waste yarn stitches with the wrong side facing. Leave one empty needle in the center, with ${calc.slotSts} stitches on each side of it.`,
        "Unknit the waste yarn.",
        `Pick up two purl bumps from the row below and place both on the center needle. (${calc.thumbSts} stitches)`,
        "Continue knitting the thumb.",
      ],
      stitchCount: calc.thumbSts,
    }),
    instructionBlock({
      lines: [
        `Knit ${calc.thumbRows} rows.`,
        rcLine(calc.thumbRows),
        `Break the yarn, leaving a 12" tail. Thread the tail through the remaining ${calc.thumbSts} stitches and remove the stitches from the machine. Pull the tail firmly to gather the top of the thumb and secure.`,
        ...(video ? [video] : []),
      ],
      stitchCount: calc.thumbSts,
      reset: true,
    }),
  ]);
}

function seamRows(calc: MittenCalc): SleevelessPatternDisplayRow[] {
  const items = calc.gore
    ? `<ol class="sleeveless-pattern-line">
      <li>Seam from the cast-on edge through the cuff and Hand 1 to the lower thumb marker.</li>
      <li>The gore joins the edges between the markers as those stitches are rehung.</li>
      <li>Use the thumb tail to seam the thumb.</li>
      <li>Seam from the upper thumb marker to the closed fingertips.</li>
    </ol>`
    : `<ol class="sleeveless-pattern-line">
      <li>Seam from the cast-on edge through the cuff and the hand below the thumb to the thumb opening.</li>
      <li>Seam the thumb edges.</li>
      <li>Seam the hand above the thumb from the thumb opening to the closed fingertips.</li>
    </ol>`;
  return section("Seaming", [
    instructionBlock({
      lines: [blockMarker("seam"), "Using mattress stitch or your preferred method:", items],
    }),
  ]);
}

function mittenRows(calc: MittenCalc, side: MittenInstructionSide): SleevelessPatternDisplayRow[] {
  const slotLabel = SIDE_LABEL[side.slotEdge];
  const gore = calc.gore;
  const title = gore ? (side.slotEdge === "right" ? "Right-edge thumb" : "Left-edge thumb") : side.title;
  const slotVideo = mittenVideoButton(MITTEN_SLOT_VIDEO_CONTENT_ID, "data-mitten-slot-video");
  const handAbove = gore
    ? [...markerRows(calc, gore), ...straightRows(calc, gore)]
    : [
        ...section("Thumb slot", [
          instructionBlock({
            lines: [
              blockMarker("slot"),
              `Starting at the outermost needle on the ${slotLabel}, work the ${calc.slotSts} slot stitches by hand: knit 1 row with waste yarn, 1 row with ravel cord, then 1 row with waste yarn.`,
              "These hand-worked rows do not count on the row counter.",
              ...(slotVideo ? [slotVideo] : []),
            ],
            stitchCount: calc.slotSts,
          }),
        ]),
        ...straightRows(calc, null),
      ];
  return [
    { kind: "piece", title },
    ...section("Cast on and cuff", [
      instructionBlock({
        lines: [
          blockMarker("cast-on"),
          `Cast on ${calc.cuffSts} stitches.`,
          "Complete cast-on setup before the counted cuff rows.",
        ],
        stitchCount: calc.cuffSts,
      }),
      instructionBlock({
        lines: [
          MITTEN_CUFF_START_CARRIAGE,
          `Knit ${calc.cuffRows} rows in your choice of cuff pattern.`,
          rcLine(calc.cuffRows),
        ],
        stitchCount: calc.cuffSts,
        reset: true,
      }),
    ]),
    ...section("Transfer", [
      instructionBlock({
        lines: [blockMarker("transfer"), "If needed, transfer the ribber stitches to the main bed."],
        stitchCount: calc.cuffSts,
      }),
    ]),
    ...section("Increase to hand width", [
      instructionBlock({
        lines: [blockMarker("increase"), ...increaseLines(calc)],
        stitchCount: calc.handSts,
      }),
    ]),
    ...section("Hand below the thumb", [
      instructionBlock({
        lines: [
          blockMarker("hand-1"),
          `Knit ${calc.hand1Rows} rows. (${calc.handSts} stitches)`,
          rcLine(calc.hand1Rows),
        ],
        stitchCount: calc.handSts,
        reset: true,
      }),
    ]),
    ...handAbove,
    ...fingertipRows(calc, side),
    ...section("Close the top", [
      instructionBlock({
        lines: [
          blockMarker("close"),
          `Scrap all ${calc.handSts} stitches off the machine with contrasting waste yarn and remove the work from the machine.`,
          `Join the ${calc.fingertip.workingStitches} stitches of the shaped half to the ${calc.fingertip.heldStitches} stitches of the other half using Kitchener stitch, by hand or on the machine.`,
        ],
        stitchCount: calc.handSts,
      }),
    ]),
    ...(gore ? goredThumbRows(calc, gore) : slottedThumbRows(calc)),
    ...seamRows(calc),
  ];
}

function readingLayout(instructionsHtml: string, diagramHtml: string): string {
  return `<div class="sleeveless-piece-layout">
  <div class="pattern-layout pattern-layout--garment-columns sleeveless-piece-split sleeveless-pattern-reading-layout" data-sleeveless-pattern-reading-layout>
  <div class="pattern-layout__content sleeveless-piece-split__text sleeveless-pattern-reading-layout__instructions">${instructionsHtml}</div>
  <aside class="pattern-layout__sidebar sleeveless-piece-split__diagram sleeveless-pattern-reading-layout__diagram" aria-label="Garment dimensions">
    <div class="sleeveless-piece-split__diagram-inner sleeveless-pattern-diagram-panel sleeveless-piece-split__diagram-inner--back-panel">
      <h3 class="sleeveless-pattern-diagram-panel__title no-print">Garment Dimensions</h3>
      ${diagramHtml}
    </div>
  </aside>
</div>
</div>`;
}

function oneMittenHtml(
  calc: MittenCalc,
  side: MittenInstructionSide,
  intro: string,
  hidden: boolean,
): string {
  const introHtml = intro
    ? `<p class="sleeveless-pattern-line" data-block-line="second-mitten">${escapeHtml(intro)}</p>`
    : "";
  const instructions = renderPatternDisplayRowsHtml(mittenRows(calc, side), {
    pieceSectionId: side.id,
  });
  return `<section class="mitten-panel" data-mitten="${side.id}" data-testid="mitten-${side.id}"${hidden ? " hidden" : ""}>
  ${readingLayout(`${introHtml}${instructions}`, buildMittenDiagramTabsHtml(calc, side.slotEdge))}
</section>`;
}

/** One instruction document for the screen and for print. */
export function buildMittenPatternHtml(calc: MittenCalc): string {
  const secondIntro = calc.gore ? MITTEN_GORED_SECOND_MITTEN_INTRO : MITTEN_SECOND_MITTEN_INTRO;
  const panels = MITTEN_INSTRUCTION_SIDES.map((side, index) =>
    oneMittenHtml(calc, side, index === 1 ? secondIntro : "", index > 0),
  ).join("\n");
  return `<div class="mitten-instructions" data-testid="mitten-instructions" data-print-source="mitten-instructions" data-thumb-style="${calc.thumbStyle}">
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
