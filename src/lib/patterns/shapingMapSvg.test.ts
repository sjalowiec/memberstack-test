import { describe, expect, it } from "vitest";
import {
  SAMPLE_SHAPING_MAP_DATA,
  SHAPING_MAP_KNIT_ROW_HEIGHT_RATIO,
  SHAPING_MAP_ANNOTATION_FONT_PX,
  SHAPING_MAP_PAD_TOP_PX,
  SHAPING_MAP_ROW_NUMBER_FONT_PX,
  SHAPING_MAP_SHOULDER_LABEL_ABOVE_LINE_PX,
  SHAPING_MAP_STEP_LABEL_FONT_PX,
  SHAPING_MAP_STEP_LABEL_OUTLINE_OFFSET_PX,
  formatCenterBindOffChartLabel,
  formatCenterStitchesLabel,
  formatChartCompactNotation,
  formatShapingMapCompactLegendItems,
  renderShapingMapSvg,
  stepLabelCenterY,
  stepLabelDrawX,
  stepLabelSegmentMidX,
  SHAPING_MAP_SYMMETRICAL_NECK_LABEL_OUTLINE_OFFSET_PX,
  symmetricalNeckOpeningLabelDrawX,
} from "./shapingMapSvg";

function viewBoxWidth(svg: string): number {
  const m = svg.match(/viewBox="0 0 ([\d.]+) /);
  return m ? Number(m[1]) : 0;
}

function centerLabelX(svg: string): number {
  const m = svg.match(
    /class="shaping-map-center-label"[^>]*\sx="([\d.]+)"|x="([\d.]+)"[^>]*class="shaping-map-center-label"/,
  );
  return Number(m?.[1] ?? m?.[2] ?? NaN);
}

function parseStepLabelPositions(
  svg: string,
): { x: number; y: number; text: string; centered: boolean }[] {
  const re =
    /<text class="shaping-map-step-label([^"]*)" x="([\d.]+)" y="([\d.]+)"[^>]*>([^<]*)<\/text>/g;
  const out: { x: number; y: number; text: string; centered: boolean }[] = [];
  for (const m of svg.matchAll(re)) {
    out.push({
      centered: m[1]!.includes("shaping-map-step-label--centered"),
      x: Number(m[2]),
      y: Number(m[3]),
      text: m[4]!,
    });
  }
  return out;
}

function parseRowNumberPositions(svg: string): { x: number; y: number; row: number }[] {
  const re =
    /<text class="shaping-map-row-number" x="([\d.]+)" y="([\d.]+)"[^>]*>(\d+)<\/text>/g;
  const out: { x: number; y: number; row: number }[] = [];
  for (const m of svg.matchAll(re)) {
    out.push({ x: Number(m[1]), y: Number(m[2]), row: Number(m[3]) });
  }
  return out;
}

function parsePathOutlineXs(svg: string): number[] {
  const m = svg.match(/class="shaping-map-path" points="([^"]+)"/);
  if (!m) return [];
  return m[1]!
    .split(" ")
    .map((pt) => Number(pt.split(",")[0]))
    .filter((n) => Number.isFinite(n));
}

describe("renderShapingMapSvg (shared shaping-map renderer)", () => {
  it("renders dynamic center bind-off label from centerStitches data", () => {
    const data = { ...SAMPLE_SHAPING_MAP_DATA, centerStitches: 20 };
    const svg = renderShapingMapSvg(data);
    expect(svg).toContain(`>${formatCenterStitchesLabel(20)}<`);
    expect(svg).toContain(">Bind off 20 center stitches<");
    expect(svg).not.toContain("Center Stitches");
    expect(svg).toContain('class="shaping-map-center-label"');
  });

  it("uses shared step-label class for shaping counts", () => {
    const svg = renderShapingMapSvg(SAMPLE_SHAPING_MAP_DATA);
    expect(svg).toContain('class="shaping-map-step-label"');
    expect(svg).toContain(">-1<");
    expect(svg).toContain(">-6<");
  });

  it("aligns step labels to the action row (same Y as the grid row)", () => {
    const yPx = (row: number): number => 20 + (110 - row) * 14;
    expect(stepLabelCenterY(110, yPx)).toBe(yPx(110));
    expect(stepLabelCenterY(232, yPx)).toBe(yPx(232));

    // Sample shoulder bind-offs on rows 250, 248, 246 — all centered and lifted by the same offset.
    const svg = renderShapingMapSvg(SAMPLE_SHAPING_MAP_DATA, { cell: 14 });
    const labels = parseStepLabelPositions(svg);
    const padTop = SHAPING_MAP_PAD_TOP_PX;
    const rowMax = 250;
    const expectedY = (row: number) => padTop + (rowMax - row) * 14;
    const sixes = labels.filter((l) => l.text === "-6");
    expect(sixes).toHaveLength(3);
    expect(sixes.every((l) => l.centered)).toBe(true);
    expect(sixes.map((l) => l.y).sort((a, b) => a - b)).toEqual(
      [250, 248, 246]
        .map((row) => expectedY(row) - SHAPING_MAP_SHOULDER_LABEL_ABOVE_LINE_PX)
        .sort((a, b) => a - b),
    );

    // Neck-edge labels stay on their action row (not lifted).
    const neck = labels.find((l) => l.text === "-1");
    expect(neck).toBeDefined();
    expect(neck!.centered).toBe(false);
    expect(neck!.y).toBe(expectedY(244));
  });

  it("places neck-edge step labels to the visual left of the outline with a consistent gap", () => {
    const fx = (px: number) => px;
    expect(stepLabelDrawX(100, 128, fx)).toBe(100 - SHAPING_MAP_STEP_LABEL_OUTLINE_OFFSET_PX);

    // Mirrored: visual-left end is the larger data-space x after fx flips.
    const mirrorFx = (px: number) => 400 - px;
    expect(stepLabelDrawX(100, 128, mirrorFx)).toBe(
      Math.min(mirrorFx(100), mirrorFx(128)) - SHAPING_MAP_STEP_LABEL_OUTLINE_OFFSET_PX,
    );

    const fxId = (px: number) => px;
    expect(symmetricalNeckOpeningLabelDrawX(100, 128, fxId)).toBe(
      128 + SHAPING_MAP_SYMMETRICAL_NECK_LABEL_OUTLINE_OFFSET_PX,
    );
    expect(symmetricalNeckOpeningLabelDrawX(100, 114, fxId)).toBe(
      114 + SHAPING_MAP_SYMMETRICAL_NECK_LABEL_OUTLINE_OFFSET_PX,
    );

    for (const mirror of [false, true]) {
      const svg = renderShapingMapSvg(SAMPLE_SHAPING_MAP_DATA, { mirror });
      const labels = parseStepLabelPositions(svg);
      const outlineXs = parsePathOutlineXs(svg);
      expect(labels.length).toBeGreaterThan(0);
      expect(outlineXs.length).toBeGreaterThan(0);
      // Neck labels stay end-anchored; shoulder labels are centered separately.
      expect(labels.some((l) => !l.centered)).toBe(true);
      expect(svg).toMatch(/class="shaping-map-step-label"[^>]*text-anchor="end"/);

      for (const lbl of labels.filter((l) => !l.centered)) {
        expect(lbl.x).toBeLessThan(Math.max(...outlineXs));
      }
    }
  });

  it("centers every shoulder bind-off label over its horizontal segment", () => {
    expect(stepLabelSegmentMidX(0, 27)).toBe(13.5);
    expect(stepLabelSegmentMidX(10, 4)).toBe(7);

    const straightShoulder = {
      title: "straight shoulder",
      rowMin: 0,
      rowMax: 20,
      centerStitches: 8,
      paths: [
        {
          id: "shoulder",
          label: "Shoulder",
          edge: "left" as const,
          rowDirection: "up" as const,
          startX: 0,
          startRow: 0,
          steps: [
            { stitches: 0, rows: 20, label: "" },
            { stitches: 27, rows: 0, label: "-27" },
          ],
        },
        {
          id: "neck",
          label: "Neck",
          edge: "left" as const,
          rowDirection: "down" as const,
          startX: 27,
          startRow: 20,
          steps: [{ stitches: 2, rows: 2, label: "-2" }],
        },
      ],
      edgeLabels: { shoulder: "Armhole Edge", neck: "Neck Edge" },
    };

    for (const mirror of [false, true]) {
      const svg = renderShapingMapSvg(straightShoulder, { mirror, cell: 14 });
      const labels = parseStepLabelPositions(svg);
      const shoulderLabels = labels.filter((l) => l.text === "-27");
      expect(shoulderLabels).toHaveLength(1);
      expect(shoulderLabels[0]!.centered).toBe(true);
      expect(svg).toMatch(
        /class="shaping-map-step-label shaping-map-step-label--centered"[^>]*text-anchor="middle"/,
      );

      // Midpoint of the shoulder's horizontal segment (first two distinct path x at top row).
      const padTop = SHAPING_MAP_PAD_TOP_PX + 26; // edge-label top gap
      const topRowY = padTop; // rowMax
      const pathPts = (svg.match(/class="shaping-map-path" points="([^"]+)"/)?.[1] ?? "")
        .split(" ")
        .map((pt) => {
          const [x, y] = pt.split(",").map(Number);
          return { x: x!, y: y! };
        });
      const shoulderSegXs: number[] = [];
      for (const p of pathPts) {
        if (p.y !== topRowY) {
          if (shoulderSegXs.length > 0) break;
          continue;
        }
        if (!shoulderSegXs.includes(p.x)) shoulderSegXs.push(p.x);
        if (shoulderSegXs.length === 2) break;
      }
      expect(shoulderSegXs).toHaveLength(2);
      const expectedMid = (shoulderSegXs[0]! + shoulderSegXs[1]!) / 2;
      expect(shoulderLabels[0]!.x).toBeCloseTo(expectedMid, 5);
      // Lifted above the shoulder line (smaller SVG y); neck labels stay on their row.
      expect(shoulderLabels[0]!.y).toBe(topRowY - SHAPING_MAP_SHOULDER_LABEL_ABOVE_LINE_PX);

      // Neck decrease stays left-of-outline (not centered) and on its action row.
      const neck = labels.find((l) => l.text === "-2");
      expect(neck).toBeDefined();
      expect(neck!.centered).toBe(false);
      expect(neck!.y).toBeGreaterThan(shoulderLabels[0]!.y);
    }

    // Shaped sample: every shoulder -6 is centered and lifted by the same offset; neck is not.
    const sampleSvg = renderShapingMapSvg(SAMPLE_SHAPING_MAP_DATA, { cell: 14 });
    const sampleLabels = parseStepLabelPositions(sampleSvg);
    const sixes = sampleLabels.filter((l) => l.text === "-6");
    expect(sixes).toHaveLength(3);
    expect(sixes.every((l) => l.centered)).toBe(true);
    const padTop = SHAPING_MAP_PAD_TOP_PX;
    const rowYs = [250, 248, 246].map(
      (row) => padTop + (250 - row) * 14 - SHAPING_MAP_SHOULDER_LABEL_ABOVE_LINE_PX,
    );
    expect(sixes.map((l) => l.y).sort((a, b) => a - b)).toEqual(rowYs.sort((a, b) => a - b));

    // Each shoulder label X is the midpoint of its 6-stitch segment (0–6, 6–12, 12–18).
    const padLeft = 18;
    const expectedMids = [3, 9, 15].map((midStitch) => padLeft + midStitch * 14);
    expect(sixes.map((l) => l.x).sort((a, b) => a - b)).toEqual(expectedMids);

    expect(sampleLabels.filter((l) => l.text === "-1").every((l) => !l.centered)).toBe(true);
  });

  it("keeps the center bind-off label inside the viewBox (mirrored and unmirrored)", () => {
    const wideCenter = {
      ...SAMPLE_SHAPING_MAP_DATA,
      centerStitches: 120,
      edgeLabels: { shoulder: "Armhole Edge", neck: "Neck Edge" },
    };
    for (const mirror of [false, true]) {
      const svg = renderShapingMapSvg(wideCenter, { mirror });
      const width = viewBoxWidth(svg);
      const x = centerLabelX(svg);
      const label = formatCenterStitchesLabel(120);
      expect(svg).toContain(`>${label}<`);
      expect(svg).toContain(">Armhole Edge<");
      expect(svg).not.toContain("Shoulder Edge");
      expect(Number.isFinite(x)).toBe(true);
      // text-anchor end (unmirrored) or start (mirrored): either way the glyph box must
      // start at x >= 0. For end-anchor, left edge ≈ x - estimated width.
      const estimatedWidth = label.length * 12 * 0.62;
      const leftEdge = mirror ? x : x - estimatedWidth;
      expect(leftEdge).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(width);
      expect(width).toBeGreaterThan(estimatedWidth);
    }
  });

  it("reserves extra left margin for long center bind-off counts (unmirrored)", () => {
    const narrow = {
      title: "test",
      rowMin: 10,
      rowMax: 12,
      centerStitches: 200,
      paths: [
        {
          id: "neck",
          label: "Neck",
          edge: "left" as const,
          rowDirection: "down" as const,
          startX: 0,
          startRow: 12,
          steps: [{ stitches: 1, rows: 1 }],
        },
      ],
      edgeLabels: { neck: "Neck Edge" },
    };
    const svg = renderShapingMapSvg(narrow, { mirror: false, cell: 14 });
    const width = viewBoxWidth(svg);
    const label = formatCenterStitchesLabel(200);
    expect(svg).toContain(`>${label}<`);
    expect(svg).not.toContain("Center Stitches");
    expect(width).toBeGreaterThan(120);
    const x = centerLabelX(svg);
    const estimatedWidth = label.length * 12 * 0.62;
    expect(x - estimatedWidth).toBeGreaterThanOrEqual(0);
  });

  it("keeps clear vertical space between the center bind-off label and Neck Edge", () => {
    const data = {
      ...SAMPLE_SHAPING_MAP_DATA,
      centerStitches: 8,
      edgeLabels: { shoulder: "Armhole Edge", neck: "Neck Edge" },
    };
    const short = renderShapingMapSvg(data, { mirror: true });
    const long = renderShapingMapSvg({ ...data, centerStitches: 120 }, { mirror: false });

    for (const svg of [short, long]) {
      const centerY = Number(
        svg.match(/class="shaping-map-center-label"[^>]*\sy="([\d.]+)"/)?.[1],
      );
      const neckMatches = [...svg.matchAll(/class="shaping-map-edge-label"[^>]*\sy="([\d.]+)"[^>]*>([^<]+)</g)];
      const neckY = Number(neckMatches.find((m) => m[2] === "Neck Edge")?.[1]);
      expect(centerY).toBeGreaterThan(0);
      expect(neckY).toBeGreaterThan(centerY);
      // Baselines must stay well separated for short and long bind-off wording.
      expect(neckY - centerY).toBeGreaterThanOrEqual(34);
    }
  });

  it("matches row-number font size to shaping-label font size", () => {
    expect(SHAPING_MAP_ANNOTATION_FONT_PX).toBe(18);
    expect(SHAPING_MAP_ANNOTATION_FONT_PX).toBeLessThan(SHAPING_MAP_STEP_LABEL_FONT_PX);
    expect(SHAPING_MAP_ROW_NUMBER_FONT_PX).toBeGreaterThanOrEqual(SHAPING_MAP_STEP_LABEL_FONT_PX);
    const svg = renderShapingMapSvg(SAMPLE_SHAPING_MAP_DATA);
    expect(svg).toContain('class="shaping-map-row-number"');
    expect(svg).toContain('dominant-baseline="central"');
    expect(svg).not.toContain("shaping-map__svg--practice");
    expect(svg).not.toContain('font-size="13" font-weight="400"');
  });

  it("aligns each row-number Y with its corresponding grid row", () => {
    const data = {
      ...SAMPLE_SHAPING_MAP_DATA,
      rowMin: 232,
      rowMax: 250,
    };
    const svg = renderShapingMapSvg(data, { cell: 14, rowNumberInterval: 2 });
    const nums = parseRowNumberPositions(svg);
    expect(nums.length).toBeGreaterThan(1);

    // Reconstruct the same yPx used by the renderer (no edge-label top gap on sample).
    const padTop = SHAPING_MAP_PAD_TOP_PX;
    const rowMax = 250;
    const yPx = (row: number) => padTop + (rowMax - row) * 14;

    for (const n of nums) {
      expect(n.y).toBe(yPx(n.row));
    }
    expect(nums.some((n) => n.row === 232)).toBe(true);
    expect(nums.some((n) => n.row === 250)).toBe(true);
  });

  it("does not add a completion-row band on sweater Visual Guides", () => {
    const svg = renderShapingMapSvg(SAMPLE_SHAPING_MAP_DATA, { cell: 14 });
    const nums = parseRowNumberPositions(svg);
    const topLabel = nums.reduce((a, b) => (a.y <= b.y ? a : b));
    expect(topLabel.row).toBe(250);
    const gridBody = [...svg.matchAll(/<g class="shaping-map-grid-(?:minor|major)">([\s\S]*?)<\/g>/g)]
      .map((m) => m[1]!)
      .join("");
    const horizontalYs = [
      ...gridBody.matchAll(/<line x1="[\d.]+" y1="([\d.]+)" x2="[\d.]+" y2="([\d.]+)"/g),
    ]
      .filter((m) => m[1] === m[2])
      .map((m) => Number(m[1]));
    expect(Math.min(...horizontalYs)).toBeCloseTo(topLabel.y, 5);
  });

  it("keeps a square grid by default and shortens rows when rowHeightRatio is set", () => {
    const cell = 14;
    const square = renderShapingMapSvg(SAMPLE_SHAPING_MAP_DATA, { cell, rowNumberInterval: 2 });
    const knit = renderShapingMapSvg(SAMPLE_SHAPING_MAP_DATA, {
      cell,
      rowNumberInterval: 2,
      rowHeightRatio: SHAPING_MAP_KNIT_ROW_HEIGHT_RATIO,
    });
    const invalid = renderShapingMapSvg(SAMPLE_SHAPING_MAP_DATA, {
      cell,
      rowNumberInterval: 2,
      rowHeightRatio: 0,
    });

    const squareNums = parseRowNumberPositions(square);
    const knitNums = parseRowNumberPositions(knit);
    const invalidNums = parseRowNumberPositions(invalid);
    const squarePair = squareNums.filter((n) => n.row === 248 || n.row === 250);
    const knitPair = knitNums.filter((n) => n.row === 248 || n.row === 250);
    expect(squarePair).toHaveLength(2);
    expect(knitPair).toHaveLength(2);
    const squareDy = Math.abs(squarePair[0]!.y - squarePair[1]!.y);
    const knitDy = Math.abs(knitPair[0]!.y - knitPair[1]!.y);
    expect(squareDy).toBe(cell * 2);
    expect(knitDy).toBeCloseTo(cell * SHAPING_MAP_KNIT_ROW_HEIGHT_RATIO * 2, 5);

    const squareWidth = viewBoxWidth(square);
    const knitWidth = viewBoxWidth(knit);
    expect(knitWidth).toBe(squareWidth);
    const squareHeight = Number(square.match(/viewBox="0 0 [\d.]+ ([\d.]+)"/)?.[1]);
    const knitHeight = Number(knit.match(/viewBox="0 0 [\d.]+ ([\d.]+)"/)?.[1]);
    expect(knitHeight).toBeLessThan(squareHeight);

    const invalidPair = invalidNums.filter((n) => n.row === 248 || n.row === 250);
    expect(Math.abs(invalidPair[0]!.y - invalidPair[1]!.y)).toBe(cell * 2);
  });
});

describe("formatCenterStitchesLabel", () => {
  it("formats the shared center bind-off callout with the dynamic stitch count", () => {
    expect(formatCenterStitchesLabel(20)).toBe("Bind off 20 center stitches");
    expect(formatCenterStitchesLabel(34)).toBe("Bind off 34 center stitches");
    expect(formatCenterStitchesLabel(1)).toBe("Bind off 1 center stitch");
    expect(formatCenterStitchesLabel(12)).toBe("Bind off 12 center stitches");
  });
});

describe("formatCenterBindOffChartLabel", () => {
  it("uses the short on-chart center bind-off wording", () => {
    expect(formatCenterBindOffChartLabel(6)).toBe("-6 center sts");
    expect(formatCenterBindOffChartLabel(10)).toBe("-10 center sts");
  });
});

describe("formatChartCompactNotation", () => {
  it("strips s/r/x suffixes for on-chart JP", () => {
    expect(formatChartCompactNotation("2s-2r-1x")).toBe("2-2-1");
    expect(formatChartCompactNotation("1s-2r-2x")).toBe("1-2-2");
    expect(formatChartCompactNotation("3s-2r-3x")).toBe("3-2-3");
  });
});

describe("formatShapingMapCompactLegendItems", () => {
  it("returns the compact BO / Dec / Center key", () => {
    expect(formatShapingMapCompactLegendItems(6)).toEqual({
      bindOff: "BO = bind off",
      decrease: "Dec = decrease",
      center: "Center: bind off 6 stitches",
    });
    expect(formatShapingMapCompactLegendItems(1).center).toBe("Center: bind off 1 stitch");
  });
});
