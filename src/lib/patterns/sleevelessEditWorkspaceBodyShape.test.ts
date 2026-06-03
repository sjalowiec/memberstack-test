import { describe, expect, it } from "vitest";
import { deriveSleevelessEditWorkspaceBodyShape } from "./sleevelessEditWorkspaceBodyShape";
import { resolveEffectiveSleevelessBodyShapeKind } from "./sleevelessAlineShaping";

describe("deriveSleevelessEditWorkspaceBodyShape", () => {
  it("flips a straight pattern to A-line when the edited hip exceeds the bust (38 -> 40)", () => {
    expect(
      deriveSleevelessEditWorkspaceBodyShape({ chestBust: "38", hip: "40" }, "straight"),
    ).toBe("aline");
  });

  it("persists straight (inference -> shaped) when the edited hip is narrower than the bust (40/38)", () => {
    expect(
      deriveSleevelessEditWorkspaceBodyShape({ chestBust: "40", hip: "38" }, "straight"),
    ).toBe("straight");
  });

  it("drops a stale A-line token when the hip is edited narrower than the bust (was aline, 40/38)", () => {
    expect(
      deriveSleevelessEditWorkspaceBodyShape({ chestBust: "40", hip: "38" }, "aline"),
    ).toBe("straight");
  });

  it("drops a stale A-line token when bust and hip are edited within tolerance (was aline, 38/38)", () => {
    expect(
      deriveSleevelessEditWorkspaceBodyShape({ chestBust: "38", hip: "38" }, "aline"),
    ).toBe("straight");
  });

  it("keeps straight when the hip is only a hair wider (within 0.25in tolerance)", () => {
    expect(
      deriveSleevelessEditWorkspaceBodyShape({ chestBust: "38", hip: "38.25" }, "straight"),
    ).toBe("straight");
  });

  it("falls back to the current shape only when a finished measurement is missing/unparseable", () => {
    expect(deriveSleevelessEditWorkspaceBodyShape(null, "aline")).toBe("aline");
    expect(deriveSleevelessEditWorkspaceBodyShape({ chestBust: "40" }, "aline")).toBe("aline");
    expect(
      deriveSleevelessEditWorkspaceBodyShape({ chestBust: "abc", hip: "40" }, "aline"),
    ).toBe("aline");
  });
});

/**
 * Edit-and-update must route to the same diagram body-shape kind as creating a new pattern with the
 * same final bust/hip. Both flows persist a `straight`/`aline` token and let
 * {@link resolveEffectiveSleevelessBodyShapeKind} resolve the diagram kind from measurements.
 */
function resolvedDiagramKind(
  finishedBust: number,
  finishedHip: number,
  startingShape: "straight" | "aline",
  patternMode: "express" | "custom-build" = "express",
): string {
  const overrides = { chestBust: String(finishedBust), hip: String(finishedHip) };
  const bodyShape = deriveSleevelessEditWorkspaceBodyShape(overrides, startingShape);
  const patternData = {
    fit: {
      selectedMeasurements: { finished_bust_chest: finishedBust, finished_hip: finishedBust },
      cbMeasurementOverrides: overrides,
    },
    style: { bodyShape, patternMode },
  };
  return resolveEffectiveSleevelessBodyShapeKind(patternData, finishedBust, finishedHip);
}

describe("edit workspace diagram routing parity (resolved kind)", () => {
  it("bust 38, hip edited to 40 -> aline diagram", () => {
    expect(resolvedDiagramKind(38, 40, "straight")).toBe("aline");
    expect(resolvedDiagramKind(38, 40, "aline")).toBe("aline");
  });

  it("bust 40, hip edited to 38 -> shaped/reverse-A-line diagram (even when previously aline)", () => {
    expect(resolvedDiagramKind(40, 38, "straight")).toBe("shaped");
    expect(resolvedDiagramKind(40, 38, "aline")).toBe("shaped");
    expect(resolvedDiagramKind(40, 38, "aline", "custom-build")).toBe("shaped");
  });

  it("bust and hip within 0.25in tolerance -> straight diagram (even when previously aline)", () => {
    expect(resolvedDiagramKind(40, 40, "straight")).toBe("straight");
    expect(resolvedDiagramKind(40, 40, "aline")).toBe("straight");
  });
});
