import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  convertLength,
  formatLength,
} from "../../../components/wizards/utils/unitHelpers";
import { calculateHatPattern, type HatSpiralPlan } from "./hatMath";
import { buildHatPatternHtml, buildSpiralCrownInstructions } from "./hatInstructions";
import {
  HAT_TRANSFER_STEP_CALLOUT_BODY,
  HAT_TRANSFER_STEP_ICON_EXPLAIN,
  HAT_TRANSFER_STEP_ICON_SRC,
  HAT_TRANSFER_STEP_INSTRUCTION_TYPE,
  HAT_TRANSFER_STEP_LABEL,
  HAT_TRANSFER_STEP_MARKER_ARIA_LABEL,
  HAT_TRANSFER_STEP_REMINDER_INSTRUCTION_TYPE,
  formatHatNeedleCountPhrase,
  formatHatSpiralCountNeedlesPhrase,
} from "./hatTransferStep";

const formatters = {
  convertLength: convertLength as (v: number, from: string, to: string) => number,
  formatLength: formatLength as (v: number, unit: string) => string,
};

function calcFor(crown: string) {
  return calculateHatPattern({
    finishedHatCircInches: 20.5,
    stitchGaugeDisplay: 5,
    rowGaugeDisplay: 7,
    displayUnit: "inches",
    totalHatLengthInches: 8.5,
    brimDepthInches: 2,
    brimType: "single",
    crown,
    suggestedCrownDepthInches: 2.5,
    fit: "watchcap",
  });
}

function patternHtml(crown: string, showTips = true) {
  return buildHatPatternHtml({
    calc: calcFor(crown),
    currentUnit: "inches",
    scrapOffPatternTooltip: "Scrap Off",
    tipsIntroHtml: "",
    showTips,
    formatters,
  });
}

const miniPlan: HatSpiralPlan = {
  decreasePoints: 6,
  targetStitches: 6,
  decreaseRows: 3,
  gradual: 1,
  rapid: 2,
  gradualRows: 2,
  rapidRows: 2,
  crownRows: 4,
};

const transferSvgSource = readFileSync(
  join(__dirname, "../../../../public/icons/patterns/transfer-step.svg"),
  "utf8",
);

describe("hatTransferStep grammar", () => {
  it("uses singular needle only for count 1", () => {
    expect(formatHatNeedleCountPhrase(1)).toBe("1 needle");
    expect(formatHatSpiralCountNeedlesPhrase(1)).toBe("Count 1 needle");
  });

  it("uses needles for every count other than 1", () => {
    expect(formatHatNeedleCountPhrase(0)).toBe("0 needles");
    expect(formatHatNeedleCountPhrase(2)).toBe("2 needles");
    expect(formatHatNeedleCountPhrase(13)).toBe("13 needles");
    expect(formatHatSpiralCountNeedlesPhrase(13)).toBe("Count 13 needles");
  });
});

describe("transfer-step.svg asset", () => {
  it("uses Knit It Now terracotta root stroke and preserves artwork", () => {
    expect(transferSvgSource).toContain('stroke="#C2614e"');
    expect(transferSvgSource).not.toContain("#BA4A38");
    expect(transferSvgSource).toContain('viewBox="0 0 24 24"');
    expect(transferSvgSource).toContain('width="24"');
    expect(transferSvgSource).toContain('height="24"');
    expect(transferSvgSource).toContain('<!-- Main Bar -->');
    expect(transferSvgSource).toContain('<!-- Comb Teeth / Prongs -->');
    expect(transferSvgSource).toContain('<!-- Shift Action Arrow -->');
    expect(transferSvgSource).toContain('<path d="M5 18h12m-3-3l3 3-3 3" />');
  });
});

describe("buildSpiralCrownInstructions transfer callout", () => {
  it("places one full TRANSFER STEP callout immediately before decrease rows", () => {
    const html = buildSpiralCrownInstructions(24, 70, miniPlan);
    const planIdx = html.indexOf('data-instruction-type="swirl-shaping-plan"');
    const calloutIdx = html.indexOf(
      `data-instruction-type="${HAT_TRANSFER_STEP_INSTRUCTION_TYPE}"`,
    );
    const firstDecreaseIdx = html.indexOf('data-instruction-type="swirl-decrease-row"');
    expect(planIdx).toBeGreaterThanOrEqual(0);
    expect(calloutIdx).toBeGreaterThan(planIdx);
    expect(firstDecreaseIdx).toBeGreaterThan(calloutIdx);
    expect(html.match(/data-instruction-type="transfer-step"/g)?.length).toBe(1);
    expect(html).toContain(HAT_TRANSFER_STEP_LABEL);
    expect(html).toContain(HAT_TRANSFER_STEP_CALLOUT_BODY);
    expect(html).toContain(HAT_TRANSFER_STEP_ICON_EXPLAIN);
    expect(html).toContain(`src="${HAT_TRANSFER_STEP_ICON_SRC}"`);
    expect(html).toContain("hat-transfer-step-icon--callout");
    expect(html).not.toContain("↔");
    expect(html).not.toContain("pattern-tip");
    expect(html).not.toContain("data-tip");
    expect(html).not.toContain("hat-transfer-step-badge");
  });

  it("repeats only the transfer icon after every decrease row", () => {
    const html = buildSpiralCrownInstructions(24, 70, miniPlan);
    const decreaseCount = (html.match(/data-instruction-type="swirl-decrease-row"/g) ?? [])
      .length;
    const reminderCount = (
      html.match(
        new RegExp(
          `data-instruction-type="${HAT_TRANSFER_STEP_REMINDER_INSTRUCTION_TYPE}"`,
          "g",
        ),
      ) ?? []
    ).length;
    const rowIconCount = (html.match(/hat-transfer-step-icon--row/g) ?? []).length;
    expect(decreaseCount).toBe(3);
    expect(reminderCount).toBe(3);
    expect(rowIconCount).toBe(3);

    expect(html).not.toContain("Fill empty needles and knit across");
    expect(html).not.toContain("hat-transfer-step-badge--compact");
    expect(html).not.toContain("hat-transfer-step-reminder__text");

    // Heading text once; row markers must not repeat the badge label.
    expect(html).toContain(`hat-transfer-step-callout__heading">${HAT_TRANSFER_STEP_LABEL}<`);
    expect(html).not.toMatch(
      /transfer-step-reminder[\s\S]{0,200}TRANSFER STEP|TRANSFER STEP[\s\S]{0,120}transfer-step-reminder/,
    );
    const markerChunks = html.split(`data-instruction-type="${HAT_TRANSFER_STEP_REMINDER_INSTRUCTION_TYPE}"`);
    for (let i = 1; i < markerChunks.length; i += 1) {
      const chunk = markerChunks[i].slice(0, 280);
      expect(chunk).not.toContain(HAT_TRANSFER_STEP_LABEL);
      expect(chunk).not.toContain("Fill empty needles");
    }

    const gatherIdx = html.indexOf('data-instruction-type="swirl-gather-remaining"');
    const planIdx = html.indexOf('data-instruction-type="swirl-shaping-plan"');
    const calloutIdx = html.indexOf(
      `data-instruction-type="${HAT_TRANSFER_STEP_INSTRUCTION_TYPE}"`,
    );
    const firstReminderIdx = html.indexOf(
      `data-instruction-type="${HAT_TRANSFER_STEP_REMINDER_INSTRUCTION_TYPE}"`,
    );
    expect(firstReminderIdx).toBeGreaterThan(calloutIdx);
    expect(gatherIdx).toBeGreaterThan(firstReminderIdx);
    expect(html.slice(planIdx, calloutIdx)).not.toContain(
      HAT_TRANSFER_STEP_REMINDER_INSTRUCTION_TYPE,
    );
    expect(html.slice(gatherIdx)).not.toContain(
      HAT_TRANSFER_STEP_REMINDER_INSTRUCTION_TYPE,
    );
    expect(html).toContain(`aria-label="${HAT_TRANSFER_STEP_MARKER_ARIA_LABEL}"`);
    expect(html).toContain(`src="${HAT_TRANSFER_STEP_ICON_SRC}"`);

    // Icon sits immediately before the transfer verb; keep icon+verb together.
    expect(html).toMatch(
      /hat-transfer-step-action">\s*<span class="hat-transfer-step-marker"[\s\S]*?<\/span> transfer<\/span>/,
    );
    expect(html).not.toMatch(/stitches\)\s*<span class="hat-transfer-step-marker"/);
    expect(html).not.toMatch(/stitches\)\s*<\/p>\s*<span class="hat-transfer-step-marker"/);
  });

  it("uses Count 1 needle when spacing is 1 (not hard-coded to a row number)", () => {
    const plan: HatSpiralPlan = {
      decreasePoints: 6,
      targetStitches: 6,
      decreaseRows: 1,
      gradual: 0,
      rapid: 1,
      gradualRows: 0,
      rapidRows: 1,
      crownRows: 1,
    };
    const html = buildSpiralCrownInstructions(12, 99, plan);
    expect(html).toContain("Count 1 needle, ");
    expect(html).toMatch(
      /Count 1 needle, <span class="hat-transfer-step-action">[\s\S]*?<\/span> transfer<\/span> the next stitch/,
    );
    expect(html).not.toContain("Count 1 needles");
    expect(html).toContain("Row 99:");
  });
});

describe("TRANSFER STEP only on Swirl Top finished pattern", () => {
  it("appears for spiral and is not a pattern tip", () => {
    const spiral = patternHtml("spiral", false);
    expect(spiral).toContain(`data-instruction-type="${HAT_TRANSFER_STEP_INSTRUCTION_TYPE}"`);
    expect(spiral).toContain(HAT_TRANSFER_STEP_ICON_EXPLAIN);
    expect(spiral).toContain(HAT_TRANSFER_STEP_ICON_SRC);
    expect(spiral).toContain("hat-transfer-step-marker");
    expect(spiral).not.toContain("Fill empty needles and knit across");
    expect(spiral).not.toMatch(
      /class="pattern-tip"[^>]*hat-transfer-step|hat-transfer-step[\s\S]*class="pattern-tip"/,
    );
  });

  it("does not appear for gathered or four-gore crowns", () => {
    for (const crown of ["gathered", "wedge-4-decrease"] as const) {
      const html = patternHtml(crown);
      expect(html).not.toContain("hat-transfer-step");
      expect(html).not.toContain(HAT_TRANSFER_STEP_INSTRUCTION_TYPE);
      expect(html).not.toContain(HAT_TRANSFER_STEP_ICON_SRC);
      expect(html).not.toContain("TRANSFER STEP");
    }
  });
});
