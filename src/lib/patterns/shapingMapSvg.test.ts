import { describe, expect, it } from "vitest";
import {
  SAMPLE_SHAPING_MAP_DATA,
  SHAPING_MAP_STEP_LABEL_FONT_PX,
  SHAPING_MAP_STEP_LABEL_OUTLINE_OFFSET_PX,
  formatCenterStitchesLabel,
  renderShapingMapSvg,
  stepLabelCenterY,
} from "./shapingMapSvg";

describe("renderShapingMapSvg (shared shaping-map renderer)", () => {
  it("renders dynamic center-stitch annotation from centerStitches data", () => {
    const data = { ...SAMPLE_SHAPING_MAP_DATA, centerStitches: 20 };
    const svg = renderShapingMapSvg(data);
    expect(svg).toContain(`>${formatCenterStitchesLabel(20)}<`);
    expect(svg).toContain('class="shaping-map-center-label"');
  });

  it("uses shared step-label class for shaping counts", () => {
    const svg = renderShapingMapSvg(SAMPLE_SHAPING_MAP_DATA);
    expect(svg).toContain('class="shaping-map-step-label"');
    expect(svg).toContain(">-1<");
    expect(svg).toContain(">-6<");
  });

  it("offsets step labels above the outline using the shared constant gap", () => {
    const yPx = (row: number): number => 20 + (110 - row) * 14;
    const labelY = stepLabelCenterY(110, yPx);
    const outlineY = yPx(110);
    expect(labelY).toBeLessThan(outlineY);
    expect(outlineY - labelY).toBe(
      SHAPING_MAP_STEP_LABEL_OUTLINE_OFFSET_PX + SHAPING_MAP_STEP_LABEL_FONT_PX / 2,
    );
    const svg = renderShapingMapSvg(SAMPLE_SHAPING_MAP_DATA);
    expect(svg).toContain('class="shaping-map-step-label"');
  });

  it("expands viewBox width when center-stitch label would clip on the left (mirrored)", () => {
    const wideCenter = {
      ...SAMPLE_SHAPING_MAP_DATA,
      centerStitches: 120,
    };
    const normal = renderShapingMapSvg(wideCenter, { mirror: false });
    const mirrored = renderShapingMapSvg(wideCenter, { mirror: true });
    const widthOf = (svg: string): number => {
      const m = svg.match(/viewBox="0 0 ([\d.]+) /);
      return m ? Number(m[1]) : 0;
    };
    expect(widthOf(mirrored)).toBeGreaterThanOrEqual(widthOf(normal));
    expect(mirrored).toContain(`>${formatCenterStitchesLabel(120)}<`);
  });

  it("reserves extra left margin for long center-stitch counts (unmirrored)", () => {
    const narrow = {
      title: "test",
      rowMin: 10,
      rowMax: 12,
      centerStitches: 200,
      paths: [
        {
          id: "neck",
          label: "Neck",
          edge: "left",
          rowDirection: "down",
          startX: 0,
          startRow: 12,
          steps: [{ stitches: 1, rows: 1 }],
        },
      ],
      edgeLabels: { neck: "Neck Edge" },
    };
    const svg = renderShapingMapSvg(narrow, { mirror: false, cell: 14 });
    const width = Number(svg.match(/viewBox="0 0 ([\d.]+) /)![1]);
    const label = formatCenterStitchesLabel(200);
    expect(svg).toContain(`>${label}<`);
    expect(width).toBeGreaterThan(120);
  });
});

describe("formatCenterStitchesLabel", () => {
  it("formats the shared center-stitch callout", () => {
    expect(formatCenterStitchesLabel(20)).toBe("20 Center Stitches");
    expect(formatCenterStitchesLabel(34)).toBe("34 Center Stitches");
  });
});
