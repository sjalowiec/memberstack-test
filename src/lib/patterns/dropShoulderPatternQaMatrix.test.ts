import { describe, expect, it } from "vitest";
import {
  buildDropShoulderQaMatrix,
  collectDropShoulderCrossScenarioFlags,
  DROP_SHOULDER_KNOWN_CARDIGAN_FRONT_CAST_ON_DRIFT,
  DROP_SHOULDER_QA_SCENARIOS,
  findForbiddenDropShoulderInstructionViolations,
  formatDropShoulderQaFailureReport,
  printDropShoulderQaMatrixReport,
} from "./testScenarios/dropShoulderPatternQaMatrix";

const PULLOVER_SCENARIO_IDS = DROP_SHOULDER_QA_SCENARIOS.filter((s) => !s.id.includes("cardigan")).map(
  (s) => s.id,
);
const CARDIGAN_SCENARIO_IDS = DROP_SHOULDER_QA_SCENARIOS.filter((s) => s.id.includes("cardigan")).map(
  (s) => s.id,
);

describe("drop-shoulder pattern QA matrix", () => {
  const rows = buildDropShoulderQaMatrix();
  const rowsById = Object.fromEntries(rows.map((r) => [r.scenarioId, r]));
  const crossFlags = collectDropShoulderCrossScenarioFlags(rows);
  const failureReport = formatDropShoulderQaFailureReport(rows);

  it("prints a compact console report for manual review", () => {
    printDropShoulderQaMatrixReport(rows);
    expect(rows).toHaveLength(DROP_SHOULDER_QA_SCENARIOS.length);
  });

  it.each(PULLOVER_SCENARIO_IDS.map((id) => [id, rowsById[id]!] as const))(
    "%s: pullover math and instruction audit checks pass",
    (scenarioId, row) => {
      expect(row.scenarioId, failureReport || undefined).toBe(scenarioId);
      expect(row.flags, `[${scenarioId}] ${row.flags.join("; ")}`).toEqual([]);
    },
  );

  it.each(CARDIGAN_SCENARIO_IDS.map((id) => [id, rowsById[id]!] as const))(
    "%s: cardigan passes except known front cast-on JP/diagram drift bug",
    (scenarioId, row) => {
      const otherFlags = row.flags.filter((f) => !f.startsWith(DROP_SHOULDER_KNOWN_CARDIGAN_FRONT_CAST_ON_DRIFT));
      expect(otherFlags, `[${scenarioId}] unexpected flags: ${otherFlags.join("; ")}`).toEqual([]);
      expect(
        row.flags.some((f) => f.startsWith(DROP_SHOULDER_KNOWN_CARDIGAN_FRONT_CAST_ON_DRIFT)),
        `[${scenarioId}] expected documented cardigan front cast-on drift`,
      ).toBe(true);
    },
  );

  it("allows explanatory 'no armhole/shoulder shaping' but rejects sleeveless-style shaping instructions", () => {
    expect(
      findForbiddenDropShoulderInstructionViolations(
        "Work straight above the markers (no armhole shaping).\nShoulders are worked straight.",
      ),
    ).toEqual([]);
    const armholeShapingViolations = findForbiddenDropShoulderInstructionViolations(
      "Decrease at the armhole shaping section on each side.",
    );
    expect(armholeShapingViolations.some((v) => v.includes("armhole-shaping"))).toBe(true);
    expect(findForbiddenDropShoulderInstructionViolations("Finish armholes with a pickup band.")).toContain(
      "instructions mention finishing armholes",
    );
  });

  it("pullover round and V-neck share body cast-on within each gauge profile", () => {
    expect(crossFlags, crossFlags.map((f) => f.message).join("; ")).toEqual([]);
  });

  it("covers multiple gauges and style combinations", () => {
    const gaugeIds = new Set(
      DROP_SHOULDER_QA_SCENARIOS.map((s) => {
        if (s.id.includes("16-24")) return "16-24";
        if (s.id.includes("7-7")) return "7-7";
        return "5-7";
      }),
    );
    expect(gaugeIds.has("16-24")).toBe(true);
    expect(gaugeIds.has("5-7")).toBe(true);
    expect(gaugeIds.has("7-7")).toBe(true);

    const styles = {
      pulloverRound: rows.some((r) => r.scenarioId.includes("pullover-round")),
      pulloverV: rows.some((r) => r.scenarioId.includes("pullover-v")),
      cardiganRound: rows.some((r) => r.scenarioId.includes("cardigan-round")),
      cardiganV: rows.some((r) => r.scenarioId.includes("cardigan-v")),
      topDown: rows.some((r) => r.sleeveDirection === "top-down"),
    };
    expect(styles).toEqual({
      pulloverRound: true,
      pulloverV: true,
      cardiganRound: true,
      cardiganV: true,
      topDown: true,
    });
  });
});
