/**
 * Hat pattern instruction HTML builder (Phase A).
 * Ported from `generatePattern` in `src/pages/patterns/hat.astro`.
 */

import {
  applyHatCrownCastOnAdjustment,
  buildFourWedgeCrownSetup,
  buildFourWedgeDecreaseSchedule,
  gatheredCrownRemainingStitches,
  hatCrownCastOnWasAdjusted,
  hatCrownEndingRow,
  hatCrownStartRow,
  hatKnittedFinishedCircumferenceInches,
  type HatPatternCalc,
  type HatSpiralPlan,
} from "./hatMath";
import { buildHatFourGoreCrownVideoTipHtml } from "./hatFourGoreCrownVideoTip";
import { buildHatGatheredTopVideoHtml } from "./hatGatheredTopVideoTip";
import { buildHatMattressStitchVideoHtml } from "./hatMattressStitchVideoTip";
import { buildHatPlanningRibbingBrimTipHtml } from "./hatPlanningRibbingVideoTip";
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

  const knittedCircumferenceInches = hatKnittedFinishedCircumferenceInches(calc);
  const displayWidth =
    currentUnit === "inches"
      ? formatLength(knittedCircumferenceInches, "inches")
      : formatLength(convertLength(knittedCircumferenceInches, "inches", "cm"), "cm");

  const displayHeight =
    currentUnit === "inches"
      ? formatLength(hatHeight, "inches")
      : formatLength(convertLength(hatHeight, "inches", "cm"), "cm");

  const displayBrimDepth =
    currentUnit === "inches"
      ? formatLength(brimDepth, "inches")
      : formatLength(convertLength(brimDepth, "inches", "cm"), "cm");

  // Continuous RC from cast-on (matches swirl crown Row N labels and four-wedge crownStartRow).
  const crownStartRow = hatCrownStartRow({ brimRows, bodyRows });
  const crownEndingRow = hatCrownEndingRow({
    brimRows,
    bodyRows,
    crownRowCount,
  });
  const unit = currentUnit === "inches" ? "inches" : "cm";

  const patternCastOnSts = applyHatCrownCastOnAdjustment(castOnSts, crown);
  const swirlCastOnAdjustNote =
    crown === "spiral" && hatCrownCastOnWasAdjusted(calc)
      ? "<p>The stitch count was adjusted slightly so the Swirl crown divides evenly into 6 sections.</p>"
      : "";

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
    const {
      finalWedgeStitchCount,
      decreaseCount,
    } = buildFourWedgeDecreaseSchedule(wedgeStitchCount);
    const wedgeFinishLine = `<p>When ${finalWedgeStitchCount} ${finalWedgeStitchCount === 1 ? "stitch remains" : "stitches remain"}, break yarn and secure.</p>`;
    const wedgeShapingBlock =
      decreaseCount > 0
        ? `<p>Decrease 1 stitch two stitches in from each edge every row, ${decreaseCount} times.</p>
      ${wedgeFinishLine}`
        : wedgeFinishLine;
    const [, w2r, w3r, w4r] = wedgeNeedleRanges;
    const wedgeCrownBody = (html: string) =>
      `<div class="pattern-wedge-crown-body">${html}</div>`;
    const scrapOffFirstUseHtml = `<span class="pattern-term" data-tooltip="${escapePatternTermAttr(scrapOffPatternTooltip)}">Scrap off</span>`;
    const fourGoreDecreaseTipHtml = buildHatFourGoreCrownVideoTipHtml();
    const introHtml = `
      <p>The stitches are divided into 4 equal wedges of ${wedgeStitchCount} stitches each.</p>
      ${adjustNote}
      <p>${scrapOffFirstUseHtml} ${scrapOffStitchCount} stitches from needles ${scrapOffDisplayRange}.</p>`;
    // Tip once in Wedge 1 only — immediately before decrease instructions (not repeated per wedge).
    const wedge1Html = wedgeCrownBody(`<p>Knit Wedge 1 over ${wedgeStitchCount} stitches on needles ${firstWedgeDisplayRange}.</p>
      ${fourGoreDecreaseTipHtml}
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
    const remainingStitches = gatheredCrownRemainingStitches(patternCastOnSts);
    // Inline gather video once (gathered crown only) on the break-and-gather step.
    const gatherRemainingStitchesVideoHtml = buildHatGatheredTopVideoHtml(
      undefined,
      remainingStitches,
    );
    crownInstructions = `
      <p>Transfer every other stitch to its neighboring needle, leaving the emptied needles out of work. ${remainingStitches} stitches remain.</p>
      <div class="pattern-tip" data-tip data-tip-id="hat-crown-seaming-edges"><strong>Tip:</strong> Keep 2 stitches in work on each edge for seaming.</div>
      <p>Knit ${crownRowCount} rows. RC is now ${crownEndingRow}.</p>
      <p>Break the yarn, leaving ${breakYarnTailPhrase}, and ${gatherRemainingStitchesVideoHtml}.</p>
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

  // Shared finishing inline video link (once per pattern) on the words “mattress stitch”.
  const mattressStitchVideoHtml = buildHatMattressStitchVideoHtml();
  // Planning Ribbing tip — relevant when the brim may still be worked in ribbing
  // (Single Layer / Folded Hem). Rolled Brim is stockinette-only construction.
  const planningRibbingTipHtml =
    brimType === "rolled" ? "" : buildHatPlanningRibbingBrimTipHtml();

  const finishingGathered = `
        <p>Block the hat to set the shape.</p>
      <p>Pull the tail tight to gather the top of the hat.</p>
      <p>Use the tail to seam the body using ${mattressStitchVideoHtml} or your preferred method.</p>
      <p>Work in yarn ends.</p>`;
  const finishingSpiral = `
      <p>Run the end of the yarn through the remaining stitches, tighten and tie off, leaving a tail to sew the seam. Finish with a pompom or tassel if you choose.</p>
      <p>Seam the body using ${mattressStitchVideoHtml} or your preferred method. <span class="pattern-term" data-tooltip="Wet or steam to set the finished shape.">Block</span> if desired and weave in all ends.</p>`;
  const finishingWedgeSeamed = `
      <p>Seam each crown wedge first, then seam the body using ${mattressStitchVideoHtml} or your preferred method. <span class="pattern-term" data-tooltip="Wet or steam to set the finished shape.">Block</span> if desired and weave in all ends.</p>`;
  const finishingHtml =
    crown === "gathered"
      ? finishingGathered
      : crown === "spiral"
        ? finishingSpiral
        : finishingWedgeSeamed;

  const tipsIntroSlotHtml = `<div class="pattern-tips-intro-slot">${tipsIntroHtml}</div>`;
  const brimDeeperBodyTipHtml =
    bodyRows > 0 && brimType !== "rolled"
      ? `<div class="pattern-tip" data-tip data-tip-id="hat-deeper-brim"><strong>Tip:</strong> Want a deeper brim? Knit extra brim rows before continuing to the body.</div>`
      : "";
  const bodySectionWrapped =
    bodyRows > 0
      ? wrapHatPatternSection(
          "body",
          "<h4>Body</h4>",
          brimType === "rolled"
            ? `<p>Work ${bodyRows} rows in pattern after the rolled brim.</p>`
            : `<p>Work ${bodyRows} rows in pattern after the brim.</p>`,
        )
      : "";

  const brimSectionBody =
    brimType === "rolled"
      ? `<p>Work ${brimRows} rows in stockinette. The lower edge will roll naturally to form a ${displayBrimDepth} ${unit} rolled brim.</p>`
      : `<p>Work ${brimRows} rows in your chosen brim finish.</p>
      ${brimType === "folded" ? '<div class="pattern-tip" data-tip data-tip-id="hat-folded-brim-length"><strong>Tip:</strong> This length includes extra rows for folding.</div>' : ""}
      ${brimDeeperBodyTipHtml}`;

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
      ${planningRibbingTipHtml}
      ${wrapHatPatternSection(
        "cast-on",
        "<h4>Cast-On</h4>",
        brimType === "rolled"
          ? `<p>Cast on <strong>${patternCastOnSts} stitches</strong>.</p>
      ${swirlCastOnAdjustNote}
      <div class="pattern-tip" data-tip data-tip-id="hat-cast-on-method"><strong>Tip:</strong> An E-wrap cast-on works well for a rolled brim.</div>`
          : `<p>Cast on <strong>${patternCastOnSts} stitches</strong>.</p>
      ${swirlCastOnAdjustNote}
      <div class="pattern-tip" data-tip data-tip-id="hat-cast-on-method"><strong>Tip:</strong> Use the cast-on method of your choice, unless your chosen brim finish specifies one (for example, E-wrap for a rolled edge).</div>`,
      )}
      ${wrapHatPatternSection(
        "brim",
        brimType === "rolled"
          ? `<h4>Rolled Brim (${displayBrimDepth} ${unit})</h4>`
          : `<h4>Visible Brim Height (${displayBrimDepth} ${unit})</h4>`,
        brimSectionBody,
      )}
      ${bodySectionWrapped}
      ${wrapHatPatternSection(
        "crown-timing",
        "<h4>Crown start</h4>",
        `<p>Knit ${crownStartRow} rows.</p>
      <p><strong>Begin crown shaping at RC ${crownStartRow}.</strong></p>`,
      )}
      ${crownSectionsHtml}
      ${wrapHatPatternSection("finishing", "<h4>Finishing</h4>", finishingHtml)}
    `;
}
