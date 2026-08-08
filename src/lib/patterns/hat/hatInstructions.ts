/**
 * Hat pattern instruction HTML builder (Phase A).
 * Ported from `generatePattern` in `src/pages/patterns/hat.astro`.
 */

import {
  applyHatCrownCastOnAdjustment,
  buildFourWedgeCrownSetup,
  type HatPatternCalc,
  type HatSpiralPlan,
} from "./hatMath";
import { buildHatSwirlCrownVideoTipHtml } from "./hatSwirlCrownVideoTip";
import {
  buildHatTransferStepCalloutHtml,
  buildHatTransferStepReminderHtml,
  formatHatSpiralCountNeedlesPhrase,
} from "./hatTransferStep";

export type HatInstructionFormatters = {
  convertLength: (value: number, from: string, to: string) => number;
  formatLength: (value: number, unit: string) => string;
};

export type BuildHatPatternHtmlOptions = {
  calc: HatPatternCalc;
  currentUnit: "inches" | "cm";
  scrapOffPatternTooltip: string;
  /** Tips intro control HTML (from patternTipsControlBoxHtml), or empty. */
  tipsIntroHtml: string;
  showTips: boolean;
  formatters: HatInstructionFormatters;
};

/** Escape text for use inside an HTML attribute. */
export function escapePatternTermAttr(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;");
}

/**
 * Collapsible pattern section markup (collapse state restored by the page after inject).
 */
export function wrapHatPatternSection(
  sectionId: string,
  titleHtml: string,
  contentHtml: string,
): string {
  const sid = String(sectionId).replace(/[^a-zA-Z0-9_-]/g, "");
  return `<section class="hat-pattern-section" data-section-id="${sid}">
  <div class="hat-pattern-section__header">
    <label class="hat-pattern-section__collapse-label">
      <input type="checkbox" class="hat-pattern-section__collapse" data-section-id="${sid}" aria-label="Collapse this section" />
    </label>
    <div class="hat-pattern-section__heading">${titleHtml}</div>
  </div>
  <div class="hat-pattern-section__content">${contentHtml}</div>
</section>`;
}

export function buildSpiralCrownInstructions(
  startStitches: number,
  crownStartRowNumber: number,
  spiralPlan: HatSpiralPlan,
): string {
  const buildDecreaseRowWithTransfer = (
    rowNumber: number,
    spacing: number,
    nextStitches: number,
  ) => {
    // Build the sentence in parts so the icon marks the transfer verb (not via text replace).
    const countLead = `${formatHatSpiralCountNeedlesPhrase(spacing)}, `;
    const transferAction =
      `<span class="hat-transfer-step-action">` +
      `${buildHatTransferStepReminderHtml()} transfer` +
      `</span>`;
    const transferRest =
      ` the next stitch to the needle on the left, and repeat across the row. (${nextStitches} stitches)`;
    return (
      `<div class="pattern-row-instruction pattern-row-instruction--transfer-followup pattern-print-keep-together" data-instruction-type="swirl-decrease-row">` +
      `<p class="pattern-row-instruction__line"><span class="pattern-row-check" aria-hidden="true"></span><strong class="pattern-row-label">Row ${rowNumber}:</strong> ${countLead}${transferAction}${transferRest}</p>` +
      `</div>`
    );
  };

  const stitchesRemovedPerDecreaseRow = spiralPlan.decreasePoints;
  const targetFinalStitches = spiralPlan.targetStitches;

  let currentStitches = startStitches;
  const lines: string[] = [
    `<p data-instruction-type="swirl-shaping-plan">Plan ${spiralPlan.decreaseRows} decrease rows across ${spiralPlan.crownRows} crown rows: ${spiralPlan.gradual} decreases every other row, then ${spiralPlan.rapid} decreases every row.</p>`,
    buildHatTransferStepCalloutHtml(),
  ];

  for (let i = 0; i < spiralPlan.gradual && currentStitches > targetFinalStitches; i += 1) {
    const rowNumber = crownStartRowNumber + i * 2;
    const spacing = Math.max(
      0,
      Math.floor(currentStitches / stitchesRemovedPerDecreaseRow) - 1,
    );
    const nextStitches = Math.max(
      targetFinalStitches,
      currentStitches - stitchesRemovedPerDecreaseRow,
    );
    lines.push(buildDecreaseRowWithTransfer(rowNumber, spacing, nextStitches));
    currentStitches = nextStitches;
  }
  for (let i = 0; i < spiralPlan.rapid && currentStitches > targetFinalStitches; i += 1) {
    const rowNumber = crownStartRowNumber + spiralPlan.gradualRows + i;
    const spacing = Math.max(
      0,
      Math.floor(currentStitches / stitchesRemovedPerDecreaseRow) - 1,
    );
    const nextStitches = Math.max(
      targetFinalStitches,
      currentStitches - stitchesRemovedPerDecreaseRow,
    );
    lines.push(buildDecreaseRowWithTransfer(rowNumber, spacing, nextStitches));
    currentStitches = nextStitches;
  }

  lines.push(
    '<p data-instruction-type="swirl-gather-remaining">Gather the remaining stitches and secure.</p>',
  );
  return lines.join("\n");
}

/**
 * Build the full pattern instructions HTML and attach four-wedge setup onto `calc` when needed.
 * Mutates `calc.fourWedgeCrownSetup` for diagram/debug parity with the prior page.
 */
export function buildHatPatternHtml(options: BuildHatPatternHtmlOptions): string {
  const {
    calc,
    currentUnit,
    scrapOffPatternTooltip,
    tipsIntroHtml,
    formatters: { convertLength, formatLength },
  } = options;

  const {
    targetWidth,
    castOnSts,
    hatHeight,
    brimDepth,
    brimRows,
    brimType,
    bodyRows,
    crownRowCount,
    crown,
    stitchGaugeRaw,
    rowGaugeRaw,
    crownPlan,
  } = calc;

  const displayWidth =
    currentUnit === "inches"
      ? formatLength(targetWidth, "inches")
      : formatLength(convertLength(targetWidth, "inches", "cm"), "cm");

  const displayHeight =
    currentUnit === "inches"
      ? formatLength(hatHeight, "inches")
      : formatLength(convertLength(hatHeight, "inches", "cm"), "cm");

  const displayBrimDepth =
    currentUnit === "inches"
      ? formatLength(brimDepth, "inches")
      : formatLength(convertLength(brimDepth, "inches", "cm"), "cm");
  const displayCrownDepth =
    currentUnit === "inches"
      ? formatLength(crownPlan.crownDepth, "inches")
      : formatLength(convertLength(crownPlan.crownDepth, "inches", "cm"), "cm");
  const displayCrownStartLength =
    currentUnit === "inches"
      ? formatLength(crownPlan.bodyLength, "inches")
      : formatLength(convertLength(crownPlan.bodyLength, "inches", "cm"), "cm");

  const crownStartRow = brimRows + bodyRows;
  const unit = currentUnit === "inches" ? "inches" : "cm";

  const brimInstructionHtml =
    'Work even in your chosen brim treatment — for example 1x1 or 2x2 ribbing or <span class="pattern-term" data-tooltip="Stitch pattern that copies knit and purl ribbing by having needles out of work. A favorite for knitters without a ribber.">mock ribbing</span>, a rolled stockinette edge, a fold-up band, or a <span class="pattern-term" data-tooltip="A folded, double-layer hem formed by hanging the cast-on stitches back onto the needles.">hung hem</span> — for the depth shown.';

  const patternCastOnSts = applyHatCrownCastOnAdjustment(castOnSts, crown);

  calc.fourWedgeCrownSetup = buildFourWedgeCrownSetup({
    castOnSts,
    crown,
    brimRows,
    bodyRows,
  });

  const crownHeading =
    crown === "wedge-4-decrease" && calc.fourWedgeCrownSetup
      ? "Crown Setup"
      : "Crown Decrease";
  const breakYarnTailPhrase =
    currentUnit === "inches"
      ? 'a 12" tail'
      : `a ${Math.round(convertLength(12, "inches", "cm"))} cm tail`;

  let crownInstructions = "";
  let crownSectionsHtml = "";

  if (crown === "wedge-4-decrease" && calc.fourWedgeCrownSetup) {
    const fws = calc.fourWedgeCrownSetup;
    const {
      wedgeStitchCount,
      scrapOffStitchCount,
      scrapOffDisplayRange,
      firstWedgeDisplayRange,
      castOnAdjustedFromBase,
      wedgeNeedleRanges,
    } = fws;
    const adjustNote = castOnAdjustedFromBase
      ? "<p>The stitch count was adjusted so the crown can be divided evenly into 4 wedges.</p>"
      : "";
    const finalWedgeStitchCount = wedgeStitchCount % 2 === 1 ? 1 : 2;
    const decreaseCount = (wedgeStitchCount - finalWedgeStitchCount) / 2;
    const rowFrequency =
      decreaseCount > 0 ? Math.max(1, Math.round(crownRowCount / decreaseCount)) : 1;
    const rowFrequencyPhrase =
      rowFrequency === 1 ? "every 1 row" : `every ${rowFrequency} rows`;
    const wedgeFinishLine = `<p>When ${finalWedgeStitchCount} ${finalWedgeStitchCount === 1 ? "stitch remains" : "stitches remain"}, break yarn and secure.</p>`;
    const wedgeShapingBlock =
      decreaseCount > 0
        ? `<p>Decrease 1 stitch at each edge ${rowFrequencyPhrase}, ${decreaseCount} times.</p>
      ${wedgeFinishLine}`
        : wedgeFinishLine;
    const [, w2r, w3r, w4r] = wedgeNeedleRanges;
    const wedgeCrownBody = (html: string) =>
      `<div class="pattern-wedge-crown-body">${html}</div>`;
    const scrapOffFirstUseHtml = `<span class="pattern-term" data-tooltip="${escapePatternTermAttr(scrapOffPatternTooltip)}">Scrap off</span>`;
    const introHtml = `
      <p>The stitches are divided into 4 equal wedges of ${wedgeStitchCount} stitches each.</p>
      ${adjustNote}
      <p>${scrapOffFirstUseHtml} ${scrapOffStitchCount} stitches from needles ${scrapOffDisplayRange}.</p>`;
    const wedge1Html = wedgeCrownBody(`<p>Knit Wedge 1 over ${wedgeStitchCount} stitches on needles ${firstWedgeDisplayRange}.</p>
      ${wedgeShapingBlock}`);
    const wedge2Html = wedgeCrownBody(`<p>Pick up and rehang ${wedgeStitchCount} stitches from needles ${w2r.displayRange} back onto those same needles.</p>
      ${wedgeShapingBlock}`);
    const wedge3Html = wedgeCrownBody(`<p>Pick up and rehang ${wedgeStitchCount} stitches from needles ${w3r.displayRange} back onto those same needles.</p>
      ${wedgeShapingBlock}`);
    const wedge4Html = wedgeCrownBody(`<p>Pick up and rehang ${wedgeStitchCount} stitches from needles ${w4r.displayRange} back onto those same needles.</p>
      ${wedgeShapingBlock}`);
    crownSectionsHtml = [
      wrapHatPatternSection("crown-intro", "<h4>Crown setup</h4>", introHtml),
      wrapHatPatternSection("crown-wedge-1", "<h4>Wedge 1</h4>", wedge1Html),
      wrapHatPatternSection("crown-wedge-2", "<h4>Wedge 2</h4>", wedge2Html),
      wrapHatPatternSection("crown-wedge-3", "<h4>Wedge 3</h4>", wedge3Html),
      wrapHatPatternSection("crown-wedge-4", "<h4>Wedge 4</h4>", wedge4Html),
    ].join("\n");
  } else if (crown === "spiral") {
    const spiralPlan = crownPlan.spiral || {
      decreasePoints: 6,
      targetStitches: 6,
      decreaseRows: 0,
      gradual: 0,
      rapid: 0,
      gradualRows: 0,
      rapidRows: 0,
      crownRows: 0,
    };
    crownInstructions = `
      ${buildHatSwirlCrownVideoTipHtml()}
      <figure class="pattern-diagram">
        <img src="/images/hats/spiral_shaping.jpg" alt="Spiral crown shaping with 6 evenly spaced decrease points forming wedges" />
        <figcaption>Spiral crown shaping: 6 evenly spaced decrease points worked across the row.</figcaption>
      </figure>
      ${buildSpiralCrownInstructions(patternCastOnSts, crownStartRow, spiralPlan)}`;
  } else if (crown === "gathered") {
    crownInstructions = `
      <p>Transfer every other needle to its neighbor, leaving emptied needles out of work.</p>
      <div class="pattern-tip" data-tip data-tip-id="hat-crown-seaming-edges"><strong>Tip:</strong> Keep 2 stitches in work on each edge for seaming.</div>
      <p>After knitting the full hat length, break the yarn, leaving ${breakYarnTailPhrase}.</p>
      <p>Use a darning needle to run the yarn tail through the remaining live stitches and draw closed.</p>
    `;
  } else {
    crownInstructions = `
      <p>Transfer every other needle to its neighbor, leaving emptied needles out of work.</p>
      <div class="pattern-tip" data-tip data-tip-id="hat-crown-seaming-edges"><strong>Tip:</strong> Keep 2 stitches in work on each edge for seaming.</div>
      <p>Knit ${crownRowCount} rows.</p>
      <p>Break yarn, leaving ${breakYarnTailPhrase}.</p>
    `;
  }

  if (!crownSectionsHtml) {
    crownSectionsHtml = wrapHatPatternSection(
      "crown",
      `<h4>${crownHeading}</h4>`,
      crownInstructions,
    );
  }

  const finishingGathered = `
        <p>Block the hat to set the shape.</p>
      <p>Pull the tail tight to gather the top of the hat.</p>
      <p>Use the tail to seam the body.</p>
      <p>Work in yarn ends.</p>`;
  const finishingSpiral = `
      <p>Run the end of the yarn through the remaining stitches, tighten and tie off, leaving a tail to sew the seam. Finish with a pompom or tassel if you choose.</p>
      <p>Seam the body using <span class="pattern-term" data-tooltip="An invisible, right-side seaming method that joins two edges neatly.">mattress stitch</span> or your preferred method. <span class="pattern-term" data-tooltip="Wet or steam to set the finished shape.">Block</span> if desired and weave in all ends.</p>`;
  const finishingWedgeSeamed = `
      <p>Seam each crown wedge first, then seam the body using <span class="pattern-term" data-tooltip="An invisible, right-side seaming method that joins two edges neatly.">mattress stitch</span> or your preferred method. <span class="pattern-term" data-tooltip="Wet or steam to set the finished shape.">Block</span> if desired and weave in all ends.</p>`;
  const finishingHtml =
    crown === "gathered"
      ? finishingGathered
      : crown === "spiral"
        ? finishingSpiral
        : finishingWedgeSeamed;

  const tipsIntroSlotHtml = `<div class="pattern-tips-intro-slot">${tipsIntroHtml}</div>`;
  const brimDeeperBodyTipHtml =
    bodyRows > 0
      ? `<div class="pattern-tip" data-tip data-tip-id="hat-deeper-brim"><strong>Tip:</strong> Want a deeper brim? Knit extra brim rows before continuing to the body.</div>`
      : "";
  const bodySectionWrapped =
    bodyRows > 0
      ? wrapHatPatternSection(
          "body",
          "<h4>Body</h4>",
          `<p>Work ${bodyRows} rows in pattern after the brim.</p>`,
        )
      : "";

  return `
      ${tipsIntroSlotHtml}
      ${wrapHatPatternSection(
        "measurements",
        "<h4>Finished measurements</h4>",
        `<div class="highlight-box">
        <p>Finished hat circumference (body): ${displayWidth} ${unit}</p>
        <p>Finished Hat Length: ${displayHeight} ${unit} | Visible Brim Height: ${displayBrimDepth} ${unit}</p>
      </div>`,
      )}
      ${wrapHatPatternSection(
        "gauge",
        "<h4>Gauge (from your swatch)</h4>",
        `<p>${stitchGaugeRaw} stitches & ${rowGaugeRaw} rows per ${currentUnit === "inches" ? '4"' : "10 cm"}</p>`,
      )}
      ${wrapHatPatternSection(
        "cast-on",
        "<h4>Cast-On</h4>",
        `<p>Cast on <strong>${patternCastOnSts} stitches</strong>.</p>
      <div class="pattern-tip" data-tip data-tip-id="hat-cast-on-method"><strong>Tip:</strong> Use the cast-on method of your choice.</div>`,
      )}
      ${wrapHatPatternSection(
        "brim",
        `<h4>Visible Brim Height (${displayBrimDepth} ${unit})</h4>`,
        `<p>Work ${brimRows} rows:</p>
      ${brimType === "folded" ? '<div class="pattern-tip" data-tip data-tip-id="hat-folded-brim-length"><strong>Tip:</strong> This length includes extra rows for folding.</div>' : ""}
      <p>${brimInstructionHtml}</p>
      ${brimDeeperBodyTipHtml}`,
      )}
      ${bodySectionWrapped}
      ${wrapHatPatternSection(
        "crown-timing",
        "<h4>Crown depth &amp; start</h4>",
        `<p><strong>Calculated crown depth: ${displayCrownDepth} ${unit}.</strong></p>
      <p><strong>Begin crown shaping when hat measures ${displayCrownStartLength} ${unit} from the cast-on edge.</strong></p>
      <p>${crownPlan.note}</p>`,
      )}
      ${crownSectionsHtml}
      ${wrapHatPatternSection("finishing", "<h4>Finishing</h4>", finishingHtml)}
    `;
}
