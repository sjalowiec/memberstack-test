import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { calculateDropShoulderSleevePieceNumbers } from "./dropShoulderSleevePieceNumbers";
import {
  dropShoulderSleeveShapingPlan,
  formatDropShoulderSleeveShapingWrittenLines,
} from "./dropShoulderSleeveShaping";
import { dropShoulderSleeveShapingRcSequence } from "./dropShoulderSleeveShapingChart";
import { buildDropShoulderSleeveDisplayRows } from "./dropShoulderPatternOutput";
import { sleeveShapingPerSide } from "./evenShapingSchedule";
import { formatParentheticalRcList } from "./parentheticalRcList";
import { rawSwatchToPerInch } from "./rawSwatchGauge";
import {
  GAUGE_DEMO_SAMPLES,
  GAUGE_DEMO_SLEEVE_MEASUREMENTS,
  gaugeDemoSleeveFrame,
  gaugeDemoSleeveInstructions,
  gaugeDemoSleeveExcerptLines,
  gaugeDemoSleeveKnitTile,
  gaugeDemoSleeveLinesFromDisplayRows,
  resolveGaugeDemoState,
} from "./patternGaugeDemo";

describe("pattern gauge demonstration", () => {
  it("selects 20 stitches and 28 rows by default", () => {
    expect(GAUGE_DEMO_SAMPLES[1]).toEqual({ stitches: 20, rows: 28, label: "20 stitches / 28 rows" });
    expect(resolveGaugeDemoState(20, 28)).toEqual({
      stitchesPer4: 20,
      rowsPer4: 28,
      castOn: 20,
      knitRows: 28,
    });
  });

  it("uses one finished sleeve and the Drop Shoulder shaping schedule at every sample gauge", () => {
    expect(GAUGE_DEMO_SAMPLES.map((sample) => sample.label)).toEqual([
      "16 stitches / 24 rows",
      "20 stitches / 28 rows",
      "32 stitches / 44 rows",
    ]);
    expect(GAUGE_DEMO_SLEEVE_MEASUREMENTS).toEqual({
      sleeveLengthInches: 17,
      upperArmInches: 14,
      wristInches: 6.75,
      cuffDepthInches: 2,
    });
    const outline = gaugeDemoSleeveFrame().path;
    const results = GAUGE_DEMO_SAMPLES.map((sample) => gaugeDemoSleeveInstructions(sample.stitches, sample.rows));
    expect(results.map((result) => [
      result.castOn,
      result.bindOff,
      result.totalRows,
      result.shapingLines[0]?.replace(/ \(RC:.*\)$/, ""),
    ])).toEqual([
      [28, 56, 102, "Increase 1 stitch at each side every 6 rows 14 times."],
      [34, 70, 119, "Increase 1 stitch at each side every 4 rows 18 times."],
      [54, 112, 187, "Increase 1 stitch at each side every 4 rows 29 times."],
    ]);

    for (const sample of GAUGE_DEMO_SAMPLES) {
      const shown = gaugeDemoSleeveInstructions(sample.stitches, sample.rows);
      const perInch = rawSwatchToPerInch(String(sample.stitches), String(sample.rows), "in");
      const piece = calculateDropShoulderSleevePieceNumbers({
        finishedUpperArmInches: GAUGE_DEMO_SLEEVE_MEASUREMENTS.upperArmInches,
        finishedWristInches: GAUGE_DEMO_SLEEVE_MEASUREMENTS.wristInches,
        sleeveLengthInches: GAUGE_DEMO_SLEEVE_MEASUREMENTS.sleeveLengthInches,
        stitchesPerInch: Number(perInch.gaugeStitchesPerInch),
        rowsPerInch: Number(perInch.gaugeRowsPerInch),
        cuffDepthInches: GAUGE_DEMO_SLEEVE_MEASUREMENTS.cuffDepthInches,
      });
      const plan = dropShoulderSleeveShapingPlan({
        topSts: piece.topSts,
        wristSts: piece.wristSts,
        sleeveBodyRows: piece.sleeveBodyRows,
      });
      expect(shown.castOn).toBe(piece.wristSts);
      expect(shown.bindOff).toBe(piece.topSts);
      expect(shown.totalRows).toBe(piece.sleeveTotalRows);
      expect(shown.cuffRows).toBe(piece.cuffRows);
      const chartInput = {
        topSts: piece.topSts,
        wristSts: piece.wristSts,
        cuffRows: piece.cuffRows,
        sleeveBodyRows: piece.sleeveBodyRows,
        sleeveTotalRows: piece.sleeveTotalRows,
        direction: "cuff-up" as const,
      };
      const shapingRc = dropShoulderSleeveShapingRcSequence(chartInput);
      expect(shown.shapingLines).toEqual(
        formatDropShoulderSleeveShapingWrittenLines(plan.shapingDirection, plan.steps, shapingRc).map((line) =>
          line.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim(),
        ),
      );
      const displayRows = buildDropShoulderSleeveDisplayRows({ ...chartInput, valid: true });
      const generated = gaugeDemoSleeveLinesFromDisplayRows(displayRows);
      expect(shown.lines).toEqual(gaugeDemoSleeveExcerptLines(displayRows, shown.shapingLines));
      expect(generated.some((line) => line.text.includes("Choose one way to begin"))).toBe(true);
      expect(shown.lines.some((line) => /Choose one way|hung hem|mock ribbing|Reset row counter|scrap off/i.test(line.text))).toBe(false);
      const shapingLine = shown.lines.find((line) => line.text.startsWith("Increase 1 stitch at each side"));
      expect(shapingLine?.text).toBe(shown.shapingLines[0]);
      expect(shapingLine?.text).toContain(formatParentheticalRcList(shapingRc));
      expect(shapingLine?.text).not.toMatch(/RC: \d+, RC:/);
      expect(shown.lines[0]?.text).toBe(`Cast on ${piece.wristSts} stitches.`);
      const before = generated.find((line) => /^Knit \d+ rows? even\.$/.test(line.text));
      if (before) expect(shown.lines.some((line) => line.text === before.text)).toBe(true);
      expect(shown.lines.at(-1)?.text).toBe(
        `Bind off ${piece.topSts} stitches at RC: ${String(piece.sleeveBodyRows).padStart(3, "0")}.`,
      );
      expect(shown.castOn + shown.increaseCountPerSide * 2).toBe(shown.bindOff);
      expect(shown.increaseCountPerSide).toBe(sleeveShapingPerSide(piece.topSts, piece.wristSts));
      expect(piece.cuffRows + plan.schedule.interval * plan.schedule.count + plan.schedule.remainderRows).toBe(
        piece.sleeveTotalRows,
      );
      expect(shown.rowsAfterShaping).toBe(plan.schedule.remainderRows);
      expect(gaugeDemoSleeveFrame().path).toBe(outline);
    }
  });

  it("changes sleeve stitch density without changing the finished sleeve outline", () => {
    const coarse = gaugeDemoSleeveKnitTile(16, 24);
    const fine = gaugeDemoSleeveKnitTile(32, 44);
    expect(fine.stitchWidth).toBeLessThan(coarse.stitchWidth);
    expect(fine.rowHeight).toBeLessThan(coarse.rowHeight);
    expect(coarse.stitchPath).not.toBe(fine.stitchPath);
    const frame = gaugeDemoSleeveFrame();
    expect(frame.sleeveLength / frame.upperArmWidth).toBeCloseTo(
      GAUGE_DEMO_SLEEVE_MEASUREMENTS.sleeveLengthInches / GAUGE_DEMO_SLEEVE_MEASUREMENTS.upperArmInches,
      5,
    );
    expect(frame.wristWidth / frame.upperArmWidth).toBeCloseTo(
      GAUGE_DEMO_SLEEVE_MEASUREMENTS.wristInches / GAUGE_DEMO_SLEEVE_MEASUREMENTS.upperArmInches,
      5,
    );
    expect(frame.measurements).toContain('14" Upper Arm');
    expect(frame.measurements).toContain('6.75" Wrist');
    expect(frame.measurements).toContain('17" Length');
    expect(frame.measurements).toContain('data-gauge-demo-measure="upper-arm"');
    expect(frame.measurements).toContain('data-gauge-demo-measure="wrist"');
    expect(frame.measurements).toContain('data-gauge-demo-measure="length"');
    expect(frame.measurements).not.toContain("<polygon");
    expect(frame.path).toBe("M 62 52 L 286 52 L 228 324 L 120 324 Z");
  });

  it("rejects empty, nonnumeric, zero, and negative gauges", () => {
    expect(resolveGaugeDemoState("", "")).toMatchObject({ castOn: 20, knitRows: 28 });
    expect(resolveGaugeDemoState("nope", "rows")).toMatchObject({ castOn: 20, knitRows: 28 });
    expect(resolveGaugeDemoState(0, 0)).toEqual({
      stitchesPer4: 12,
      rowsPer4: 16,
      castOn: 12,
      knitRows: 16,
    });
    expect(resolveGaugeDemoState(-4, -8)).toMatchObject({ castOn: 12, knitRows: 16 });
    expect(resolveGaugeDemoState(12.6, 16.2)).toEqual({
      stitchesPer4: 13,
      rowsPer4: 16,
      castOn: 13,
      knitRows: 16,
    });
    expect(resolveGaugeDemoState(99, 200)).toMatchObject({ castOn: 48, knitRows: 64 });
  });

  it("offers three sample gauges and no sliders", () => {
    const page = readFileSync(resolve("src/pages/patterns/index.astro"), "utf8");
    const component = readFileSync(
      resolve("src/components/patterns/PatternGaugeDemo.astro"),
      "utf8",
    );
    expect(page).toContain("PatternGaugeDemo");
    expect(page).toContain("Your Gauge. Your Size. Your Style. Your Pattern.");
    expect(page).toContain("Stop searching for a pattern that might work. Build one that works for you.");
    expect(page).toContain("href: '/patterns/hat/builder?new=1'");
    expect(component).toContain("See Your Pattern Take Shape");
    expect(component).toContain(
      "Same finished sleeve. Different gauge. Watch the pattern change.",
    );
    expect(component).toContain("Choose a sample gauge");
    expect(component).toContain('Gauge measured over 4"');
    expect(component).toContain("(10 cm)");
    expect(component).toContain("{sample.label}");
    expect(component).toContain('role="radiogroup"');
    expect(component).toContain('aria-checked={selected ? "true" : "false"}');
    expect(component).toContain("Your Sleeve Pattern");
    expect(component).toContain('matchMedia("(prefers-reduced-motion: reduce)")');
    expect(component).toContain("is-recalculated");
    expect(component).toContain("highlightPattern();");
    expect(component).toContain("data-gauge-sleeve-lines");
    expect(component).toContain("line.text");
    expect(component).toContain("frame.measurements");
    expect(component).not.toContain("Finished size");
    expect(component).not.toContain("gauge-demo__finished");
    expect(component).toContain("gaugeDemoSleeveFrame");
    expect(component).not.toContain("<details");
    expect(component).not.toContain("Bind off");
    expect(page).toContain('data-patterns-sales');
    expect(page).toContain('data-patterns-member-intro');
    expect(page).toContain('data-patterns-access", "pending"');
    expect(component).toContain(
      "That's just one sleeve. Imagine how much time you'll save when your entire sweater pattern calculates itself using your gauge, your measurements, and your knitting machine.",
    );
    expect(component).not.toContain('type="range"');
    expect(component).not.toContain("data-gauge-demo-stitches");
    expect(component).not.toMatch(/Gauge [ABC]/);
    expect(component).not.toMatch(/per inch/i);
  });

  it("uses larger illustrative stitches for coarser gauges and keeps the calculated summary", () => {
    const coarse = gaugeDemoSleeveKnitTile(16, 24);
    const medium = gaugeDemoSleeveKnitTile(20, 28);
    const fine = gaugeDemoSleeveKnitTile(32, 44);
    expect(coarse.stitchWidth).toBeCloseTo(22, 5);
    expect(medium.stitchWidth).toBeCloseTo(22 * (16 / 20), 5);
    expect(fine.stitchWidth).toBeCloseTo(22 * (16 / 32), 5);
    expect(coarse.stitchWidth).toBeGreaterThan(medium.stitchWidth);
    expect(medium.stitchWidth).toBeGreaterThan(fine.stitchWidth);
    expect(coarse.simplified).toBe(false);
    expect(fine.simplified).toBe(false);
    expect(coarse.rowHeight).toBeCloseTo(coarse.stitchWidth * (16 / 24), 5);

    for (const sample of GAUGE_DEMO_SAMPLES) {
      const sleeve = gaugeDemoSleeveInstructions(sample.stitches, sample.rows);
      expect(sleeve.castOn + sleeve.increaseCountPerSide * 2).toBe(sleeve.bindOff);
      expect(sleeve.lines.some((line) => line.text.includes(`Cast on ${sleeve.castOn} stitches`))).toBe(true);
      expect(sleeve.lines.some((line) => line.text.startsWith("Increase 1 stitch at each side"))).toBe(true);
    }
  });
});
