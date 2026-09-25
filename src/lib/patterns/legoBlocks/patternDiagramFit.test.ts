import { describe, expect, it } from "vitest";
import { DS_BODY_MAX_H, DS_BODY_MAX_W, DS_VB_W } from "../dropShoulderPatternDiagramSvgShared";
import {
  diagramSilhouettePanelHeightShare,
  diagramSilhouetteWidthShare,
  garmentFirstPatternDiagramViewBox,
  PATTERN_DIAGRAM_REFERENCE_PANEL_HEIGHT_SHARE,
  PATTERN_DIAGRAM_REFERENCE_WIDTH_SHARE,
} from "./patternDiagramFit";

describe("pattern diagram fit", () => {
  it("matches the Drop Shoulder body's share of its panel", () => {
    expect(PATTERN_DIAGRAM_REFERENCE_WIDTH_SHARE).toBeCloseTo(DS_BODY_MAX_W / DS_VB_W, 5);
    expect(PATTERN_DIAGRAM_REFERENCE_PANEL_HEIGHT_SHARE).toBeCloseTo(DS_BODY_MAX_H / DS_VB_W, 5);
    expect(PATTERN_DIAGRAM_REFERENCE_WIDTH_SHARE).toBeGreaterThan(0.45);
    expect(PATTERN_DIAGRAM_REFERENCE_PANEL_HEIGHT_SHARE).toBeGreaterThan(0.8);
  });

  it("sizes the viewBox from the silhouette and ignores outer labels", () => {
    const silhouette = { x: 100, y: 40, width: 200, height: 360 };
    const viewBox = garmentFirstPatternDiagramViewBox(silhouette, 12);
    const expanded = garmentFirstPatternDiagramViewBox(
      { x: 20, y: 8, width: 340, height: 420 },
      12,
    );
    expect(viewBox.width).toBeCloseTo(200 / PATTERN_DIAGRAM_REFERENCE_WIDTH_SHARE, 4);
    expect(diagramSilhouetteWidthShare(silhouette, viewBox)).toBeCloseTo(
      PATTERN_DIAGRAM_REFERENCE_WIDTH_SHARE,
      4,
    );
    expect(diagramSilhouettePanelHeightShare(silhouette, viewBox)).toBeLessThanOrEqual(
      PATTERN_DIAGRAM_REFERENCE_PANEL_HEIGHT_SHARE + 0.001,
    );
    expect(viewBox.width).toBeLessThan(expanded.width);
    expect(viewBox.x).toBeLessThan(silhouette.x);
    expect(viewBox.y).toBeLessThan(silhouette.y);
    expect(viewBox.x + viewBox.width).toBeGreaterThan(silhouette.x + silhouette.width);
    expect(viewBox.y + viewBox.height).toBeGreaterThan(silhouette.y + silhouette.height);
  });
});
