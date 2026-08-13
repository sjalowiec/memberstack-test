import { describe, expect, it } from "vitest";
import { buildShapingMapDataFromEdges } from "./shapingMapFromEdges";
import { formatCenterStitchesLabel, renderShapingMapSvg } from "./shapingMapSvg";

function parseRowNumbers(svg: string): number[] {
  return [...svg.matchAll(/class="shaping-map-row-number"[^>]*>(\d+)</g)].map((m) =>
    Number(m[1]),
  );
}

function parseStepLabels(svg: string): string[] {
  return [...svg.matchAll(/class="shaping-map-step-label[^"]*"[^>]*>([^<]*)</g)].map(
    (m) => m[1]!,
  );
}

describe("buildShapingMapDataFromEdges", () => {
  it("uses the supplied starting row (never 0) and attaches the center bind-off there", () => {
    const data = buildShapingMapDataFromEdges({
      startRow: 12,
      endRow: 17,
      centerStitches: 6,
      remainingStitches: 9,
      shoulderMode: "straight",
      neckEvents: [
        { row: 12, stitches: 2, kind: "bindOff", label: "BO 2" },
        { row: 14, stitches: 1, kind: "decrease", label: "Dec 1" },
        { row: 16, stitches: 1, kind: "decrease", label: "Dec 1" },
      ],
    });

    expect(data.rowMin).toBe(12);
    expect(data.rowMax).toBe(17);
    expect(data.centerStitches).toBe(6);

    const neck = data.paths.find((path) => path.id === "neck");
    expect(neck).toBeDefined();
    const lastNeck = neck!.steps.at(-1);
    expect(lastNeck?.stitches).toBe(2);
    expect(lastNeck?.rows).toBe(0);

    const svg = renderShapingMapSvg(data);
    const rows = parseRowNumbers(svg);
    expect(rows).toContain(12);
    expect(rows).not.toContain(0);
    expect(svg).toContain(`>${formatCenterStitchesLabel(6)}<`);
    expect(parseStepLabels(svg)).toEqual(expect.arrayContaining(["BO 2", "Dec 1", "9 sts"]));
    expect(data.layout ?? "single-edge").toBe("single-edge");
    expect(data.paths.some((path) => path.id === "shoulder-right")).toBe(false);
  });

  it("draws a straight outside edge without shoulder bind-off steps", () => {
    const data = buildShapingMapDataFromEdges({
      startRow: 12,
      endRow: 17,
      remainingStitches: 9,
      shoulderMode: "straight",
      neckEvents: [{ row: 12, stitches: 2, kind: "bindOff" }],
      shoulderEvents: [{ row: 13, stitches: 3, kind: "bindOff", label: "BO 3" }],
    });

    const shoulder = data.paths.find((path) => path.id === "shoulder");
    expect(shoulder?.steps.some((step) => step.label === "BO 3")).toBe(false);
    expect(shoulder?.steps.some((step) => step.label === "9 sts")).toBe(true);
    expect(shoulder?.steps.filter((step) => step.stitches > 0)).toHaveLength(1);
  });

  it("draws both edges over the same row window for shaped shoulders", () => {
    const data = buildShapingMapDataFromEdges({
      startRow: 12,
      endRow: 17,
      centerStitches: 6,
      remainingStitches: 9,
      shoulderMode: "shaped",
      neckEvents: [
        { row: 12, stitches: 2, kind: "bindOff", label: "BO 2" },
        { row: 14, stitches: 1, kind: "decrease", label: "Dec 1" },
        { row: 16, stitches: 1, kind: "decrease", label: "Dec 1" },
      ],
      shoulderEvents: [
        { row: 13, stitches: 3, kind: "bindOff", label: "BO 3" },
        { row: 15, stitches: 3, kind: "bindOff", label: "BO 3" },
        { row: 17, stitches: 3, kind: "bindOff", label: "BO 3" },
      ],
      edgeLabels: { shoulder: "Outside Edge", neck: "Neck Edge" },
    });

    expect(data.rowMin).toBe(12);
    expect(data.rowMax).toBe(17);
    const shoulder = data.paths.find((path) => path.id === "shoulder");
    const neck = data.paths.find((path) => path.id === "neck");
    expect(shoulder?.startRow).toBe(12);
    expect(neck?.startRow).toBe(17);
    expect(shoulder?.steps.filter((step) => step.stitches === 3)).toHaveLength(3);
    expect(neck?.steps.filter((step) => (step.label ?? "").length > 0).length).toBeGreaterThan(0);

    const svg = renderShapingMapSvg(data);
    expect(svg).toContain(">BO 3<");
    expect(svg).toContain(">BO 2<");
    expect(svg).toContain(">Dec 1<");
    expect(svg).toContain(">Outside Edge<");
    expect(svg).toContain(">Neck Edge<");
    expect(svg).not.toContain(">0<");
  });

  it("keeps one stitch and one row as one chart unit", () => {
    const data = buildShapingMapDataFromEdges({
      startRow: 12,
      endRow: 17,
      centerStitches: 6,
      remainingStitches: 9,
      shoulderMode: "straight",
      neckEvents: [{ row: 12, stitches: 2, kind: "bindOff" }],
    });
    const cell = 14;
    const svg = renderShapingMapSvg(data, { cell });
    const viewBox = svg.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/);
    expect(viewBox).toBeTruthy();
    const height = Number(viewBox![2]);
    // 5 row intervals (12–17) at `cell` px, plus top/bottom padding.
    expect(height).toBeGreaterThan((17 - 12) * cell);
    expect(height).toBeLessThan((17 - 12) * cell + 200);
  });

  it("emits a mirrored left/right chart with a center bind-off gap when layout is symmetrical", () => {
    const data = buildShapingMapDataFromEdges({
      startRow: 12,
      endRow: 17,
      centerStitches: 6,
      remainingStitches: 9,
      shoulderMode: "straight",
      layout: "symmetrical",
      neckEvents: [
        { row: 12, stitches: 2, kind: "bindOff", label: "BO 2" },
        { row: 14, stitches: 1, kind: "decrease", label: "Dec 1" },
        { row: 16, stitches: 1, kind: "decrease", label: "Dec 1" },
      ],
    });

    expect(data.layout).toBe("symmetrical");
    expect(data.paths.map((path) => path.id)).toEqual([
      "shoulder",
      "neck",
      "shoulder-right",
      "neck-right",
    ]);
    expect(data.paths.find((path) => path.id === "shoulder")?.edge).toBe("left");
    expect(data.paths.find((path) => path.id === "shoulder-right")?.edge).toBe("right");
    // Full cast-on: 9 remaining + 4 neck + 6 center + 4 neck + 9 remaining = 32.
    expect(data.paths.find((path) => path.id === "shoulder-right")?.startX).toBe(32);

    const leftNeckLabels = (data.paths.find((path) => path.id === "neck")?.steps ?? [])
      .filter((step) => step.stitches > 0)
      .map((step) => step.label);
    const rightNeckLabels = (data.paths.find((path) => path.id === "neck-right")?.steps ?? [])
      .filter((step) => step.stitches > 0)
      .map((step) => step.label);
    expect(leftNeckLabels).toEqual(["Dec 1", "Dec 1", "BO 2"]);
    expect(rightNeckLabels).toEqual(["", "", ""]);

    const svg = renderShapingMapSvg(data, { cell: 14 });
    const labels = parseStepLabels(svg);
    expect(labels.filter((label) => label === "9 sts")).toHaveLength(2);
    expect(labels.filter((label) => label === "BO 2")).toHaveLength(1);
    expect(labels.filter((label) => label === "Dec 1")).toHaveLength(2);
    expect(svg).toContain(`>${formatCenterStitchesLabel(6)}<`);
    expect(svg).toMatch(/class="shaping-map-center-label"[^>]*text-anchor="middle"/);

    const bo2 = [...svg.matchAll(/<text class="shaping-map-step-label[^"]*" x="([\d.]+)" y="([\d.]+)"[^>]*>BO 2<\/text>/g)][0];
    const center = svg.match(/class="shaping-map-center-label"[^>]*\sy="([\d.]+)"/);
    expect(bo2).toBeTruthy();
    expect(center).toBeTruthy();
    expect(Number(center![1])).toBeGreaterThan(Number(bo2![2]) + 16);

    const rows = parseRowNumbers(svg);
    expect(rows).toContain(12);
    expect(rows).not.toContain(0);
  });

  it("continues the neck path down to the center-bind-off row when the first neck-edge BO is two rows later", () => {
    const data = buildShapingMapDataFromEdges({
      startRow: 12,
      endRow: 19,
      centerStitches: 6,
      remainingStitches: 9,
      shoulderMode: "straight",
      layout: "symmetrical",
      neckEvents: [
        { row: 14, stitches: 2, kind: "bindOff", label: "BO 2" },
        { row: 16, stitches: 1, kind: "decrease", label: "Dec 1" },
        { row: 18, stitches: 1, kind: "decrease", label: "Dec 1" },
      ],
    });
    const neck = data.paths.find((path) => path.id === "neck");
    const lastNeck = neck!.steps.filter((step) => step.stitches > 0).at(-1);
    expect(lastNeck?.label).toBe("BO 2");
    expect(lastNeck?.rows).toBe(2);
  });

  it("mirrors outside-shoulder bind-offs on both sides for a symmetrical shaped chart", () => {
    const data = buildShapingMapDataFromEdges({
      startRow: 12,
      endRow: 17,
      centerStitches: 6,
      remainingStitches: 9,
      shoulderMode: "shaped",
      layout: "symmetrical",
      neckEvents: [{ row: 12, stitches: 2, kind: "bindOff", label: "BO 2" }],
      shoulderEvents: [
        { row: 13, stitches: 3, kind: "bindOff", label: "BO 3" },
        { row: 15, stitches: 3, kind: "bindOff", label: "BO 3" },
        { row: 17, stitches: 3, kind: "bindOff", label: "BO 3" },
      ],
    });

    expect(data.paths.find((path) => path.id === "shoulder-right")?.steps.filter((step) => step.stitches === 3)).toHaveLength(3);
    const svg = renderShapingMapSvg(data);
    expect(parseStepLabels(svg).filter((label) => label === "BO 3")).toHaveLength(6);
  });
});
