import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { generateDropShoulderPattern } from "./dropShoulderPatternOutput";
import { buildDropShoulderFrontJapaneseNotationReplacements } from "./dropShoulderBodyJapaneseNotation";
import {
  buildDropShoulderBackStitchesRowsModel,
  buildDropShoulderFrontStitchesRowsModel,
} from "./dropShoulderPatternDiagramModel";
import { computeDefaultMeasurementsFromChartRow } from "./sleevelessExpressSizeChartClient";
import type { ChartRow } from "./sleevelessExpressSizeChartTypes";

const baby = JSON.parse(
  readFileSync(new URL("../../../public/data/sizing_sweaters_baby.json", import.meta.url), "utf8"),
) as ChartRow[];

/** Customer PDF gauge: 23.88 stitches and 32.11 rows over 4 inches. */
const SPI = 23.88 / 4;
const RPI = 32.11 / 4;

function babyCardigan(size: string, neckline: "round" | "v-neck" = "round") {
  const row = baby.find((entry) => entry.size === size);
  if (!row) throw new Error(`missing baby size ${size}`);
  return generateDropShoulderPattern({
    fit: {
      sizingChart: "baby",
      selectedSize: row.size,
      easeChoice: "standard",
      selectedMeasurements: computeDefaultMeasurementsFromChartRow(row, "standard", {
        bodyShape: "straight",
      }),
    },
    style: {
      construction: "drop-shoulder",
      constructionAuthored: "drop-shoulder",
      recipientCategory: "baby",
      neckline,
      bodyShape: "straight",
      frontStyle: "open",
      garmentStyle: "cardigan",
    },
    yarnGaugeMachine: {
      gaugeStitchesPerInch: SPI,
      gaugeRowsPerInch: RPI,
      availableNeedles: 200,
    },
  });
}

function frontProse(result: ReturnType<typeof generateDropShoulderPattern>): string {
  return result.frontDisplayRows
    .flatMap((row) => {
      if (row.kind !== "block") return [];
      const src = row.trustedParagraphs?.length ? row.trustedParagraphs : row.paragraphs;
      return src ?? [];
    })
    .join("\n");
}

describe("Baby 3 mo cardigan front instructions and chart", () => {
  const result = babyCardigan("3 mo");
  const prose = frontProse(result);
  const chart = result.frontNeckShoulderShapingChart.rows;
  const neckRemoved = chart.reduce((sum, row) => {
    const raw = row.rightNeck.startsWith("-") ? Number(row.rightNeck.slice(1)) : 0;
    return sum + (Number.isFinite(raw) ? raw : 0);
  }, 0);
  const shoulderBindOff = chart.reduce((sum, row) => {
    const raw = row.rightSide.startsWith("-") ? Number(row.rightSide.slice(1)) : 0;
    return sum + (Number.isFinite(raw) ? raw : 0);
  }, 0);

  it("keeps the chart finished length at the 3 mo source value of 8.75 inches", () => {
    expect(result.debug.backNeckToHem).toBe(8.75);
    expect(result.debug.totalCalculatedRows).toBe(70);
    expect(result.debug.finalRC).toBe(70);
  });

  it("uses one starting stitch count, decrease count, ending count, and shoulder row", () => {
    expect(result.debug.cardiganHalfLeftCastOnSts).toBe(29);
    expect(prose).toContain("Cast on 29 stitches for the left front.");
    expect(chart[0]?.rightNeck).toBe("-4");
    expect(chart[0]?.rightStitchCount).toBe(25);
    expect(neckRemoved).toBe(14);
    expect(prose).toContain("Bind off 4 stitches at the center-front (neck) edge.");
    expect(prose).toContain("(RC: 2, 4)");
    expect(prose).toContain("(RC: 6, 8, 10, 12, 14)");
    expect(shoulderBindOff).toBe(15);
    expect(prose).toContain("bind off 15 stitches for the shoulder at RC: 014");
    expect(result.debug.shoulderStitches).toBe(15);
    expect(chart[chart.length - 1]?.row).toBe(result.debug.finalRC);
    expect(result.debug.frontNecklineStartRC).toBe(56);
  });

  it("reaches the same shoulder row on the front and the back", () => {
    expect(result.debug.frontNecklineStartRC! + 14).toBe(result.debug.finalRC);
    expect(result.debug.shoulderStitches).toBe(15);
  });

  it("labels the front diagram with the same cast-on and the working neckline rows", () => {
    const model = buildDropShoulderFrontStitchesRowsModel(result, {
      style: { frontStyle: "open", garmentStyle: "cardigan", neckline: "round" },
    });
    expect(model?.hemStitches).toBe(29);
    expect(model?.frontNeckDepthRows).toBe(14);
    expect(model?.necklineDepthLabel).toContain("14 rows");
    expect(model?.necklineDepthLabel).toContain("in");

    const cm = buildDropShoulderFrontStitchesRowsModel(
      result,
      {
        style: { frontStyle: "open", garmentStyle: "cardigan", neckline: "round" },
      },
      "cm",
    );
    expect(cm?.hemStitchesLabel).toContain("cm");
    expect(cm?.hemStitchesLabel).not.toMatch(/\din\b/);
    expect(cm?.necklineDepthLabel).toContain("cm");
    expect(cm?.necklineDepthLabel).not.toMatch(/\din\b/);
    expect(cm?.armholeDepthLabel).toContain("cm");
  });
});

describe("neighboring baby sizes stay on the chart finished length", () => {
  it("uses each size's garment back length with no added ease", () => {
    for (const row of baby) {
      const result = babyCardigan(String(row.size));
      expect(result.debug.backNeckToHem).toBe(row.garment_back_length);
      expect(result.debug.armholeDepth).toBe(Number(row.upper_arm) / 2);
    }
  });

  it("keeps each front shoulder on the same stitch count and row as the back", () => {
    for (const row of baby) {
      const result = babyCardigan(String(row.size));
      const chart = result.frontNeckShoulderShapingChart.rows;
      const start =
        (chart[0]?.rightStitchCount ?? 0) +
        (chart[0]?.rightNeck.startsWith("-") ? Number(chart[0].rightNeck.slice(1)) : 0);
      const neckRemoved = chart.reduce((sum, item) => {
        const raw = item.rightNeck.startsWith("-") ? Number(item.rightNeck.slice(1)) : 0;
        return sum + raw;
      }, 0);
      const shoulder = chart.reduce((sum, item) => {
        const raw = item.rightSide.startsWith("-") ? Number(item.rightSide.slice(1)) : 0;
        return sum + raw;
      }, 0);
      expect(start).toBe(result.debug.cardiganHalfLeftCastOnSts);
      expect(start - neckRemoved).toBe(result.debug.shoulderStitches);
      expect(shoulder).toBe(result.debug.shoulderStitches);
      expect(chart.at(-1)?.row).toBe(result.debug.finalRC);
      expect(frontProse(result)).toContain(
        `When ${result.debug.shoulderStitches} stitches remain`,
      );
    }
  });
});

describe("Baby 3 mo standard V-neck cardigan at the customer gauge", () => {
  const pattern = {
    fit: {
      sizingChart: "baby",
      selectedSize: "3 mo",
      easeChoice: "standard",
      selectedMeasurements: computeDefaultMeasurementsFromChartRow(
        baby.find((entry) => entry.size === "3 mo")!,
        "standard",
        { bodyShape: "straight" },
      ),
    },
    style: {
      construction: "drop-shoulder",
      constructionAuthored: "drop-shoulder",
      recipientCategory: "baby",
      neckline: "v-neck" as const,
      bodyShape: "straight",
      frontStyle: "open",
      garmentStyle: "cardigan",
    },
    yarnGaugeMachine: {
      gaugeStitchesPerInch: SPI,
      gaugeRowsPerInch: RPI,
      availableNeedles: 200,
    },
  };
  const result = generateDropShoulderPattern(pattern);
  const prose = frontProse(result);
  const chart = result.frontNeckShoulderShapingChart.rows;
  const neckRemoved = chart.reduce((sum, row) => {
    const raw = row.rightNeck.startsWith("-") ? Number(row.rightNeck.slice(1)) : 0;
    return sum + (Number.isFinite(raw) ? raw : 0);
  }, 0);
  const shoulderBindOff = chart.reduce((sum, row) => {
    const raw = row.rightSide.startsWith("-") ? Number(row.rightSide.slice(1)) : 0;
    return sum + (Number.isFinite(raw) ? raw : 0);
  }, 0);
  const chartStart =
    (chart[0]?.rightStitchCount ?? 0) +
    (chart[0]?.rightNeck.startsWith("-") ? Number(chart[0].rightNeck.slice(1)) : 0);

  it("is a V-neck decrease schedule, not the round-neck center bind-off", () => {
    expect(prose).not.toMatch(/bind off 4 stitches at the center-front/i);
    expect(prose).toContain("Begin the V-neck shaping at the center-front edge.");
    expect(prose).toContain("Cast on 29 stitches for the left front.");
    expect(prose).toContain(
      "Decrease 1 stitch at the center-front (neck) edge every row 14 times <em>(RC: 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14)</em> (14 stitches removed).",
    );
    expect(prose).toContain(
      "When 15 stitches remain, bind off 15 stitches for the shoulder at RC: 014.",
    );
  });

  it("uses the same 29-stitch front, 14 decreases, 15-stitch shoulder, and shoulder row as the back", () => {
    expect(result.debug.cardiganHalfLeftCastOnSts).toBe(29);
    expect(result.debug.shoulderStitches).toBe(15);
    expect(result.debug.finalRC).toBe(70);
    expect(result.debug.frontNecklineStartRC).toBe(56);
    expect(chartStart).toBe(29);
    expect(neckRemoved).toBe(14);
    expect(shoulderBindOff).toBe(15);
    expect(chart.at(-1)?.row).toBe(result.debug.finalRC);
    expect(chart.at(-1)?.rightStitchCount).toBe(0);
  });

  it("knits about 6 inches to the underarm and 8.75 inches to the shoulder, with the sleeve top matching both armhole edges", () => {
    expect(result.debug.backNeckToHem).toBe(8.75);
    expect(result.debug.armholeDepth).toBe(2.75);
    expect(result.debug.dropShoulderUpperArmInches).toBe(5.5);
    expect((result.debug.armholeDepth ?? 0) * 2).toBe(result.debug.dropShoulderUpperArmInches);

    const rpi = result.debug.rowsPerInch ?? 0;
    const hemToUnderarmRows = (result.debug.hemRows ?? 0) + (result.debug.bodyRows ?? 0);
    expect(hemToUnderarmRows / rpi).toBeCloseTo(6, 1);
    expect((result.debug.totalCalculatedRows ?? 0) / rpi).toBeCloseTo(8.75, 1);
    expect((result.debug.armholeRows ?? 0) * 2 / rpi).toBeCloseTo(
      (result.debug.dropShoulderSleeveTopStitches ?? 0) / (result.debug.stitchesPerInch ?? 1),
      0,
    );
  });

  it("labels the front diagram and Japanese notation with that same V", () => {
    const model = buildDropShoulderFrontStitchesRowsModel(result, pattern);
    expect(model?.hemStitches).toBe(29);
    expect(model?.frontNecklineStitches).toBe(14);
    expect(model?.frontNeckDepthRows).toBe(14);
    expect(model?.shoulderStitchesEach).toBe(15);
    expect(model?.necklineDepthLabel).toContain("14 rows");

    const back = buildDropShoulderBackStitchesRowsModel(result);
    expect(back?.shoulderStitchesEach).toBe(15);

    const jp = buildDropShoulderFrontJapaneseNotationReplacements(result, pattern);
    expect(jp["jp-neckline-bo"]).toBe("");
    expect(jp["jp-neckline-shaping"]).toBe("1s-1r-14x");
  });
});

describe("every baby size, standard-fit V-neck cardigan", () => {
  const results = baby.map((row) => {
    const result = babyCardigan(String(row.size), "v-neck");
    const rpi = result.debug.rowsPerInch ?? 0;
    const spi = result.debug.stitchesPerInch ?? 0;
    const hemToUnderarmRows = (result.debug.hemRows ?? 0) + (result.debug.bodyRows ?? 0);
    const chart = result.frontNeckShoulderShapingChart.rows;
    const chartStart =
      (chart[0]?.rightStitchCount ?? 0) +
      (chart[0]?.rightNeck.startsWith("-") ? Number(chart[0].rightNeck.slice(1)) : 0);
    const neckRemoved = chart.reduce((sum, item) => {
      const raw = item.rightNeck.startsWith("-") ? Number(item.rightNeck.slice(1)) : 0;
      return sum + raw;
    }, 0);
    const shoulderBindOff = chart.reduce((sum, item) => {
      const raw = item.rightSide.startsWith("-") ? Number(item.rightSide.slice(1)) : 0;
      return sum + raw;
    }, 0);
    return { row, result, rpi, spi, hemToUnderarmRows, chart, chartStart, neckRemoved, shoulderBindOff };
  });

  it("lengthens the body at each size while the sleeve top stays equal to both armhole edges", () => {
    let previousHem = 0;
    let previousTotal = 0;
    for (const item of results) {
      const upperArm = Number(item.row.upper_arm);
      expect(item.result.debug.backNeckToHem).toBe(item.row.garment_back_length);
      expect(item.result.debug.armholeDepth).toBe(upperArm / 2);
      expect(item.result.debug.dropShoulderUpperArmInches).toBe(upperArm);
      expect((item.result.debug.armholeDepth ?? 0) * 2).toBe(upperArm);

      const hemInches = item.hemToUnderarmRows / item.rpi;
      const totalInches = (item.result.debug.totalCalculatedRows ?? 0) / item.rpi;
      expect(hemInches).toBeGreaterThan(previousHem);
      expect(totalInches).toBeGreaterThan(previousTotal);
      expect(hemInches).toBeCloseTo(Number(item.row.garment_back_length) - upperArm / 2, 1);
      expect(totalInches).toBeCloseTo(Number(item.row.garment_back_length), 1);
      previousHem = hemInches;
      previousTotal = totalInches;
    }
  });

  it("keeps the V-neck front, chart, diagram, and back on one shoulder", () => {
    for (const item of results) {
      const prose = frontProse(item.result);
      const shoulder = item.result.debug.shoulderStitches ?? 0;
      const castOn = item.result.debug.cardiganHalfLeftCastOnSts ?? 0;
      expect(item.chartStart).toBe(castOn);
      expect(item.chartStart - item.neckRemoved).toBe(shoulder);
      expect(item.shoulderBindOff).toBe(shoulder);
      expect(item.chart.at(-1)?.row).toBe(item.result.debug.finalRC);
      expect(prose).toContain(`Cast on ${castOn} stitches for the left front.`);
      expect(prose).toContain(`When ${shoulder} stitches remain`);
      expect(prose).toContain("Begin the V-neck shaping at the center-front edge.");

      const pattern = {
        style: { frontStyle: "open", garmentStyle: "cardigan", neckline: "v-neck" },
      };
      const front = buildDropShoulderFrontStitchesRowsModel(item.result, pattern);
      const back = buildDropShoulderBackStitchesRowsModel(item.result);
      expect(front?.hemStitches).toBe(castOn);
      expect(front?.shoulderStitchesEach).toBe(shoulder);
      expect(back?.shoulderStitchesEach).toBe(shoulder);
      expect(front?.frontNecklineStitches).toBe(item.neckRemoved);
    }
  });
});

describe("Kids 2 yr standard V-neck cardigan follows Baby 24 mo", () => {
  const kids = JSON.parse(
    readFileSync(new URL("../../../public/data/sizing_sweaters_kids.json", import.meta.url), "utf8"),
  ) as ChartRow[];
  const row = kids.find((entry) => entry.size === "2 yr");
  if (!row) throw new Error("missing kids size 2 yr");

  const result = generateDropShoulderPattern({
    fit: {
      sizingChart: "kids",
      selectedSize: row.size,
      easeChoice: "standard",
      selectedMeasurements: computeDefaultMeasurementsFromChartRow(row, "standard", {
        bodyShape: "straight",
      }),
    },
    style: {
      construction: "drop-shoulder",
      constructionAuthored: "drop-shoulder",
      recipientCategory: "kids",
      neckline: "v-neck",
      bodyShape: "straight",
      frontStyle: "open",
      garmentStyle: "cardigan",
    },
    yarnGaugeMachine: {
      gaugeStitchesPerInch: SPI,
      gaugeRowsPerInch: RPI,
      availableNeedles: 200,
    },
  });

  const baby24 = babyCardigan("24 mo", "v-neck");
  const chart = result.frontNeckShoulderShapingChart.rows;
  const chartStart =
    (chart[0]?.rightStitchCount ?? 0) +
    (chart[0]?.rightNeck.startsWith("-") ? Number(chart[0].rightNeck.slice(1)) : 0);
  const neckRemoved = chart.reduce((sum, item) => {
    const raw = item.rightNeck.startsWith("-") ? Number(item.rightNeck.slice(1)) : 0;
    return sum + raw;
  }, 0);
  const shoulderBindOff = chart.reduce((sum, item) => {
    const raw = item.rightSide.startsWith("-") ? Number(item.rightSide.slice(1)) : 0;
    return sum + raw;
  }, 0);

  it("matches the 24-month hem, armhole, and finished length", () => {
    const rpi = result.debug.rowsPerInch ?? 0;
    const hemInches = ((result.debug.hemRows ?? 0) + (result.debug.bodyRows ?? 0)) / rpi;
    const totalInches = (result.debug.totalCalculatedRows ?? 0) / rpi;
    expect(result.debug.backNeckToHem).toBe(11.25);
    expect(result.debug.armholeDepth).toBe(3.75);
    expect(result.debug.dropShoulderUpperArmInches).toBe(7.5);
    expect((result.debug.armholeDepth ?? 0) * 2).toBe(7.5);
    expect(hemInches).toBeCloseTo(7.5, 1);
    expect(totalInches).toBeCloseTo(11.25, 1);
    expect(hemInches).toBeCloseTo(
      ((baby24.debug.hemRows ?? 0) + (baby24.debug.bodyRows ?? 0)) / (baby24.debug.rowsPerInch ?? 1),
      1,
    );
    expect(result.debug.armholeDepth).toBe(baby24.debug.armholeDepth);
    expect(result.debug.backNeckToHem).toBe(baby24.debug.backNeckToHem);
  });

  it("keeps the sleeve top and both shoulders on the same line as the back", () => {
    const prose = frontProse(result);
    const shoulder = result.debug.shoulderStitches ?? 0;
    const castOn = result.debug.cardiganHalfLeftCastOnSts ?? 0;
    const pattern = {
      style: { frontStyle: "open", garmentStyle: "cardigan", neckline: "v-neck" },
    };
    const front = buildDropShoulderFrontStitchesRowsModel(result, pattern);
    const back = buildDropShoulderBackStitchesRowsModel(result);

    expect(chartStart).toBe(castOn);
    expect(chartStart - neckRemoved).toBe(shoulder);
    expect(shoulderBindOff).toBe(shoulder);
    expect(chart.at(-1)?.row).toBe(result.debug.finalRC);
    expect(prose).toContain(`Cast on ${castOn} stitches for the left front.`);
    expect(prose).toContain(`When ${shoulder} stitches remain`);
    expect(prose).toContain("Begin the V-neck shaping at the center-front edge.");
    expect(front?.hemStitches).toBe(castOn);
    expect(front?.shoulderStitchesEach).toBe(shoulder);
    expect(back?.shoulderStitchesEach).toBe(shoulder);
    expect(front?.frontNecklineStitches).toBe(neckRemoved);
  });
});

describe("Kids sizes 4–16 standard V-neck cardigans", () => {
  const kids = JSON.parse(
    readFileSync(new URL("../../../public/data/sizing_sweaters_kids.json", import.meta.url), "utf8"),
  ) as ChartRow[];
  const expectedLength: Record<string, number> = {
    "2 yr": 11.25,
    "4 yr": 12.75,
    "6 yr": 13.5,
    "8 yr": 14.75,
    "10 yr": 15.5,
    "12 yr": 16.5,
    "14 yr": 17.5,
    "16 yr": 18.5,
  };

  function kidsCardigan(size: string) {
    const row = kids.find((entry) => entry.size === size);
    if (!row) throw new Error(`missing kids size ${size}`);
    return {
      row,
      result: generateDropShoulderPattern({
        fit: {
          sizingChart: "kids",
          selectedSize: row.size,
          easeChoice: "standard",
          selectedMeasurements: computeDefaultMeasurementsFromChartRow(row, "standard", {
            bodyShape: "straight",
          }),
        },
        style: {
          construction: "drop-shoulder",
          constructionAuthored: "drop-shoulder",
          recipientCategory: "kids",
          neckline: "v-neck",
          bodyShape: "straight",
          frontStyle: "open",
          garmentStyle: "cardigan",
        },
        yarnGaugeMachine: {
          gaugeStitchesPerInch: SPI,
          gaugeRowsPerInch: RPI,
          availableNeedles: 200,
        },
      }),
    };
  }

  const updated = ["4 yr", "6 yr", "8 yr", "10 yr", "12 yr", "14 yr", "16 yr"].map(kidsCardigan);

  it("keeps size 2 at 11.25 and sets sizes 14 and 16 to the short-cardigan lengths", () => {
    expect(kids.find((entry) => entry.size === "2 yr")?.garment_back_length).toBe(11.25);
    expect(kids.find((entry) => entry.size === "14 yr")?.garment_back_length).toBe(17.5);
    expect(kids.find((entry) => entry.size === "16 yr")?.garment_back_length).toBe(18.5);
  });

  it("lengthens the body at each size while the sleeve top stays equal to both armhole edges", () => {
    let previousHem = 0;
    let previousTotal = 0;
    for (const item of [kidsCardigan("2 yr"), ...updated]) {
      const upperArm = Number(item.row.upper_arm);
      const finished = expectedLength[String(item.row.size)];
      expect(item.result.debug.backNeckToHem).toBe(finished);
      expect(item.result.debug.armholeDepth).toBe(upperArm / 2);
      expect(item.result.debug.dropShoulderUpperArmInches).toBe(upperArm);
      expect((item.result.debug.armholeDepth ?? 0) * 2).toBe(upperArm);

      const rpi = item.result.debug.rowsPerInch ?? 0;
      const hemInches =
        ((item.result.debug.hemRows ?? 0) + (item.result.debug.bodyRows ?? 0)) / rpi;
      const totalInches = (item.result.debug.totalCalculatedRows ?? 0) / rpi;
      expect(hemInches).toBeGreaterThan(previousHem);
      expect(totalInches).toBeGreaterThan(previousTotal);
      expect(Math.abs(hemInches - (finished - upperArm / 2))).toBeLessThan(0.2);
      expect(Math.abs(totalInches - finished)).toBeLessThan(0.2);
      expect(((item.result.debug.armholeRows ?? 0) * 2) / rpi).toBeCloseTo(
        (item.result.debug.dropShoulderSleeveTopStitches ?? 0) / (item.result.debug.stitchesPerInch ?? 1),
        0,
      );
      previousHem = hemInches;
      previousTotal = totalInches;
    }
  });

  it("keeps each V-neck front, chart, diagram, and back on one shoulder", () => {
    for (const item of updated) {
      const prose = frontProse(item.result);
      const chart = item.result.frontNeckShoulderShapingChart.rows;
      const chartStart =
        (chart[0]?.rightStitchCount ?? 0) +
        (chart[0]?.rightNeck.startsWith("-") ? Number(chart[0].rightNeck.slice(1)) : 0);
      const neckRemoved = chart.reduce((sum, row) => {
        const raw = row.rightNeck.startsWith("-") ? Number(row.rightNeck.slice(1)) : 0;
        return sum + raw;
      }, 0);
      const shoulderBindOff = chart.reduce((sum, row) => {
        const raw = row.rightSide.startsWith("-") ? Number(row.rightSide.slice(1)) : 0;
        return sum + raw;
      }, 0);
      const shoulder = item.result.debug.shoulderStitches ?? 0;
      const castOn = item.result.debug.cardiganHalfLeftCastOnSts ?? 0;
      const pattern = {
        style: { frontStyle: "open", garmentStyle: "cardigan", neckline: "v-neck" },
      };
      const front = buildDropShoulderFrontStitchesRowsModel(item.result, pattern);
      const back = buildDropShoulderBackStitchesRowsModel(item.result);

      expect(chartStart).toBe(castOn);
      expect(chartStart - neckRemoved).toBe(shoulder);
      expect(shoulderBindOff).toBe(shoulder);
      expect(chart.at(-1)?.row).toBe(item.result.debug.finalRC);
      expect(prose).toContain(`Cast on ${castOn} stitches for the left front.`);
      expect(prose).toContain(`When ${shoulder} stitches remain`);
      expect(prose).toContain("Begin the V-neck shaping at the center-front edge.");
      expect(front?.hemStitches).toBe(castOn);
      expect(front?.shoulderStitchesEach).toBe(shoulder);
      expect(back?.shoulderStitchesEach).toBe(shoulder);
      expect(front?.frontNecklineStitches).toBe(neckRemoved);
    }
  });
});
