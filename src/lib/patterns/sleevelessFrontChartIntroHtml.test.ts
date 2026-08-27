import { describe, expect, it } from "vitest";
import {
  renderSleevelessFrontChartIntroHtml,
  renderSleevelessFrontPrintChartHtml,
  sleevelessFrontChartIntroLocalStartLabel,
} from "./sleevelessFrontChartIntroHtml";
import { generateSleevelessBackPattern } from "./sleevelessPatternOutput";

/** Women's sleeveless cardigan, straight body, deep V: V at garment RC 077, armhole at 102. */
function womenCardiganDeepVBeforeArmholePattern(): Record<string, unknown> {
  return {
    fit: {
      sizingChart: "misses",
      selectedMeasurements: {
        finished_bust_chest: 40,
        back_neck_to_hem: 22.5,
        armhole_depth: 8,
        neck_opening: 3,
        shoulder_width: 4.25,
        front_neck_depth: 11.25,
        back_neck_depth: 1,
      },
    },
    style: {
      recipientCategory: "misses",
      neckline: "v-neck",
      garmentStyle: "cardigan",
      frontStyle: "open",
      bodyShape: "straight",
    },
    yarnGaugeMachine: {
      gaugeStitchesPerInch: 5,
      gaugeRowsPerInch: 7,
      availableNeedles: 200,
    },
  };
}

describe("sleeveless Front chart intro — live page/print path", () => {
  const r = generateSleevelessBackPattern(womenCardiganDeepVBeforeArmholePattern());
  const expected = "At RC 077, begin V-neck shaping at the center-front edge.";

  it("is the women's cardigan deep-V continuous-RC case (077 then 102, no Front reset)", () => {
    expect(r.debug.frontVNeckShapingTimingCase).toBe("before-armhole");
    expect(r.debug.frontArmholeNecklineOverlap?.divideGarmentRc).toBe(77);
    expect(r.debug.armholeStartRow).toBe(102);
    expect(r.debug.frontArmholeNecklineOverlap?.divideGarmentRc).toBeLessThan(r.debug.armholeStartRow!);
  });

  it("page intro uses At RC 077, not When Armhole RC reaches", () => {
    expect(sleevelessFrontChartIntroLocalStartLabel(r)).toBe("RC:077");
    const html = renderSleevelessFrontChartIntroHtml(r, "page");
    expect(html).toContain(expected);
    expect(html).not.toMatch(/When Armhole RC reaches/i);
    expect(html).not.toMatch(/begin neckline shaping at the center-front edge/i);
  });

  it("print chart HTML uses the same sentence", () => {
    const html = renderSleevelessFrontPrintChartHtml(r);
    expect(html).toContain(expected);
    expect(html).not.toMatch(/When Armhole RC reaches/i);
  });
});
