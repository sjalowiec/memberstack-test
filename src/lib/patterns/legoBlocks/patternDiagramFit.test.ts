import { describe, expect, it } from "vitest";
import { DS_BODY_MAX_H, DS_BODY_MAX_W, DS_VB_W } from "../dropShoulderPatternDiagramSvgShared";
import {
  diagramSilhouettePanelHeightShare,
  diagramSilhouetteWidthShare,
  fitPatternDiagramViewBox,
  PATTERN_DIAGRAM_REFERENCE_PANEL_HEIGHT_SHARE,
  PATTERN_DIAGRAM_REFERENCE_WIDTH_SHARE,
  unionDiagramRects,
} from "./patternDiagramFit";

describe("pattern diagram fit", () => {
  it("matches the Drop Shoulder body's share of its panel", () => {
    expect(PATTERN_DIAGRAM_REFERENCE_WIDTH_SHARE).toBeCloseTo(DS_BODY_MAX_W / DS_VB_W, 5);
    expect(PATTERN_DIAGRAM_REFERENCE_PANEL_HEIGHT_SHARE).toBeCloseTo(DS_BODY_MAX_H / DS_VB_W, 5);
    expect(PATTERN_DIAGRAM_REFERENCE_WIDTH_SHARE).toBeGreaterThan(0.45);
    expect(PATTERN_DIAGRAM_REFERENCE_PANEL_HEIGHT_SHARE).toBeGreaterThan(0.8);
  });

  it("fits the viewBox to the silhouette and outside labels without extra gutters", () => {
    const silhouette = { x: 100, y: 40, width: 200, height: 360 };
    const labels = { x: 20, y: 8, width: 340, height: 420 };
    const content = unionDiagramRects([silhouette, labels]);
    const viewBox = fitPatternDiagramViewBox(content, 12);
    expect(viewBox.x).toBe(8);
    expect(viewBox.y).toBe(-4);
    expect(viewBox.width).toBe(364);
    expect(viewBox.height).toBe(444);
    expect(viewBox.x).toBeLessThanOrEqual(labels.x);
    expect(viewBox.y).toBeLessThanOrEqual(labels.y);
    expect(viewBox.x + viewBox.width).toBeGreaterThanOrEqual(labels.x + labels.width);
    expect(viewBox.y + viewBox.height).toBeGreaterThanOrEqual(labels.y + labels.height);
    expect(diagramSilhouetteWidthShare(silhouette, viewBox)).toBeGreaterThan(0.5);
    expect(diagramSilhouettePanelHeightShare(silhouette, viewBox)).toBeGreaterThan(
      PATTERN_DIAGRAM_REFERENCE_PANEL_HEIGHT_SHARE,
    );
  });
});
