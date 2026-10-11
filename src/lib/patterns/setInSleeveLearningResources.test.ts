import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  SET_IN_BACK_ARMHOLE_BIND_OFF_TIP_ID,
  SET_IN_NECKLINE_ORIENTATION_TIP_ID,
  SET_IN_NECKLINE_SHORT_ROW_GLOSSARY_ID,
  SET_IN_NECKLINE_STAIR_STEPS_GLOSSARY_ID,
  SET_IN_SLEEVE_PERFECTION_CONTENT_ID,
  setInBackArmholeBindOffTrickTip,
  setInBackNecklineMachineHelpCardHtml,
  setInFrontNecklineMachineHelpCardHtml,
  setInNecklineOrientationTipBlock,
  setInSleevePerfectionVideoHelpHtml,
} from "./setInSleeveLearningResources";
import { patternTipWrapperHtml } from "./sleevelessPatternOutput";

describe("set-in neckline chart help cards", () => {
  it("uses active Short Rows glossary 811 and omits inactive glossary 250", () => {
    const back = setInBackNecklineMachineHelpCardHtml();
    const front = setInFrontNecklineMachineHelpCardHtml(false);
    for (const html of [back, front]) {
      expect(html).toContain(`data-glossary-id="${SET_IN_NECKLINE_SHORT_ROW_GLOSSARY_ID}"`);
      expect(html).toContain(`data-glossary-id="${SET_IN_NECKLINE_STAIR_STEPS_GLOSSARY_ID}"`);
      expect(html).not.toContain('data-glossary-id="250"');
      expect(html).toContain('data-sleeveless-help-video="roundNeckShaping"');
      expect(html).toContain('data-tip-id="sleeveless-neckline-machine-help"');
      expect(html).toContain("no-print");
    }
  });

  it("omits the shallow-neck catalog 813 button from the back card", () => {
    const back = setInBackNecklineMachineHelpCardHtml();
    expect(back).not.toContain('data-sleeveless-help-video="shallowBackNeck"');
    expect(back).not.toContain("Short row shoulder shaping");
  });

  it("keeps both neckline videos on a round-neck front card", () => {
    const front = setInFrontNecklineMachineHelpCardHtml(false);
    expect(front).toContain('data-sleeveless-help-video="roundNeckShaping"');
    expect(front).toContain('data-sleeveless-help-video="shallowBackNeck"');
    expect(front).toContain("Round neck shaping");
    expect(front).toContain("Short row shoulder shaping");
  });

  it("omits the round-neck chart card from V-neck front shaping", () => {
    expect(setInFrontNecklineMachineHelpCardHtml(true)).toBe("");
  });
});

describe("set-in attach-sleeves and bind-off resources", () => {
  it("links catalog video 580 once, as a screen-only catalog page", () => {
    const html = setInSleevePerfectionVideoHelpHtml();
    expect(html).toContain(`href="/videos/${SET_IN_SLEEVE_PERFECTION_CONTENT_ID}"`);
    expect(html).toContain('data-content-id="580"');
    expect(html).toContain("Set In Sleeve Perfection");
    expect(html).toContain("no-print");
    expect(html.match(/\/videos\/580/g)).toHaveLength(1);
  });

  it("is a dismissible Bind Off Trick tip for catalog video 5002", () => {
    const tip = setInBackArmholeBindOffTrickTip();
    const html = patternTipWrapperHtml(tip);
    expect(tip.tipId).toBe(SET_IN_BACK_ARMHOLE_BIND_OFF_TIP_ID);
    expect(html).toContain(`data-tip-id="${SET_IN_BACK_ARMHOLE_BIND_OFF_TIP_ID}"`);
    expect(html).toContain("Bind Off Trick");
    expect(html).toContain('data-sleeveless-help-video="bindOffTrick"');
    expect(html).toContain('data-content-id="5002"');
    expect(html).toContain("no-print");
    expect(html).not.toContain("hold stitches or use short-row shaping");
  });

  it("reuses the existing orientation help card", () => {
    const block = setInNecklineOrientationTipBlock();
    expect(block.tipId).toBe(SET_IN_NECKLINE_ORIENTATION_TIP_ID);
    expect(block.tipHtml).toContain("Understanding Left, Right & Diagram Orientation");
    expect(block.tipPresentation).toBe("help-card");
  });
});

describe("set-in page wiring leaves sleeveless on the shared card", () => {
  const page = readFileSync(new URL("../../scripts/sleevelessPatternPageShared.ts", import.meta.url), "utf8");

  it("passes set-in help cards only inside the set-in mount", () => {
    expect(page).toContain("const frontHelpCardHtml = setInFrontNeckHelpCard;");
    expect(page).toContain("const frontHelpCardHtml = necklineChartMachineHelpCardHtml();");
    expect(page).toContain("glossaryTooltip(250, \"Short Rows\")");
  });
});
