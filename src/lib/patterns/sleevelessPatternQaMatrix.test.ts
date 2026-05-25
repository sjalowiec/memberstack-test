import { describe, expect, it } from "vitest";
import {
  buildProductionQaGeneratorInput,
  buildSleevelessQaMatrix,
  collectCrossScenarioFlags,
  extractCastOnFromRows,
  generateSleevelessQaPatternResult,
  printSleevelessQaMatrixReport,
  QA_MATRIX_PROFILE_LABEL,
  SLEEVELESS_QA_SCENARIOS,
} from "./testScenarios/sleevelessPatternQaMatrix";

function writtenBackCastOn(
  scenario: (typeof SLEEVELESS_QA_SCENARIOS)[number],
  path: "raw" | "production",
  options?: { cbMeasurementOverrides?: Record<string, string> },
): number | undefined {
  const result = generateSleevelessQaPatternResult(scenario, path, options);
  return extractCastOnFromRows(result.displayRows);
}

describe("sleeveless pattern QA matrix (Men's Med close fit, 16/24 gauge)", () => {
  const productionRows = buildSleevelessQaMatrix("production");
  const crossFlags = collectCrossScenarioFlags(productionRows);

  it("prints a compact console report for manual review", () => {
    printSleevelessQaMatrixReport(productionRows);
    expect(productionRows).toHaveLength(SLEEVELESS_QA_SCENARIOS.length);
    expect(QA_MATRIX_PROFILE_LABEL).toMatch(/Men's Med/);
  });

  it.each(SLEEVELESS_QA_SCENARIOS.map((s, i) => [s.label, productionRows[i]!] as const))(
    "%s: per-scenario cast-on and width checks pass (production path)",
    (_label, row) => {
      expect(row.generatorPath).toBe("production");
      expect(row.flags, row.flags.join("; ")).toEqual([]);
      expect(row.writtenBackCastOn).toBe(row.bustBodySts);
      expect(row.writtenBackCastOn).toBe(row.diagramBackHipSts);
    },
  );

  it("pullover round and V-neck cast-ons match", () => {
    expect(crossFlags.filter((f) => f.startsWith("pullover"))).toEqual([]);
  });

  it("cardigan round and V-neck use same torso cast-on (production path)", () => {
    expect(crossFlags.filter((f) => f.startsWith("cardigan"))).toEqual([]);
    const round = productionRows.find((r) => r.scenario === "Cardigan front + round");
    const v = productionRows.find((r) => r.scenario === "Cardigan front + V-neck");
    expect(round?.writtenBackCastOn).toBe(74);
    expect(v?.writtenBackCastOn).toBe(74);
  });

  it("stale hip override does not widen express straight torso (cardigan round vs V)", () => {
    const overrides = { hip: "43", chestBust: "37" };
    const round = SLEEVELESS_QA_SCENARIOS.find((s) => s.id === "cardigan-round")!;
    const v = SLEEVELESS_QA_SCENARIOS.find((s) => s.id === "cardigan-v-neck")!;
    expect(writtenBackCastOn(round, "production", { cbMeasurementOverrides: overrides })).toBe(74);
    expect(writtenBackCastOn(v, "production", { cbMeasurementOverrides: overrides })).toBe(74);
    const genRound = buildProductionQaGeneratorInput(round, { cbMeasurementOverrides: overrides });
    expect(genRound.fit).toBeDefined();
    const fit = genRound.fit as Record<string, unknown>;
    const cb = fit.cbMeasurementOverrides as Record<string, string> | undefined;
    expect(cb?.hip).toBe("37");
  });
});
