import { describe, expect, it } from "vitest";
import {
  SET_IN_SLEEVE_PX_PER_INCH,
  buildSetInSleeveLaidOpenGeometry,
  setInSleeveCapEdgeInches,
  setInSleeveFlatWidthInches,
  setInSleeveInchesFromRows,
  setInSleeveInchesFromStitches,
} from "./setInSleeveSchematicGeometry";

describe("laid-open set-in sleeve geometry", () => {
  it("keeps a full 11.75 inch upper arm over a 16.25 inch cuff-to-underarm length", () => {
    const geo = buildSetInSleeveLaidOpenGeometry({
      upperArmInches: 11.75,
      wristInches: 9,
      sleeveLengthInches: 16.25,
      cuffDepthInches: 2,
      capHeightInches: 0,
      topWidthInches: 11.75,
    });
    expect(setInSleeveFlatWidthInches(11.75)).toBe(11.75);
    expect(geo.upperWidthPx).toBeCloseTo(11.75 * SET_IN_SLEEVE_PX_PER_INCH, 4);
    expect(geo.wristWidthPx).toBeCloseTo(9 * SET_IN_SLEEVE_PX_PER_INCH, 4);
    expect(geo.sleeveLengthPx).toBeCloseTo(16.25 * SET_IN_SLEEVE_PX_PER_INCH, 4);
    expect(geo.cuffDepthPx).toBeCloseTo(2 * SET_IN_SLEEVE_PX_PER_INCH, 4);
    expect(geo.cuffDepthPx).toBeLessThan(geo.sleeveLengthPx);
    expect(geo.widthToLength).toBeCloseTo(11.75 / 16.25, 4);
    expect(geo.widthToLength).toBeCloseTo(0.7231, 3);
    expect(geo.upperRight - geo.upperLeft).toBeCloseTo(geo.upperWidthPx, 4);
    expect(geo.wristY - geo.underarmY).toBeCloseTo(geo.sleeveLengthPx, 4);
  });

  it("turns stitches and rows into inches through their own gauges", () => {
    expect(setInSleeveInchesFromStitches(7, 7)).toBeCloseTo(1, 5);
    expect(setInSleeveInchesFromRows(10, 10)).toBeCloseTo(1, 5);
    const edge = setInSleeveCapEdgeInches(
      [
        { rowsFromCapStart: 0, stitches: 82 },
        { rowsFromCapStart: 10, stitches: 75 },
        { rowsFromCapStart: 40, stitches: 22 },
      ],
      7,
      10,
      { upperArmInches: 82 / 7, topWidthInches: 22 / 7, capHeightInches: 4 },
    );
    expect(edge[1]!.widthInches).toBeCloseTo(75 / 7, 5);
    expect(edge[1]!.upInches).toBeCloseTo(1, 5);
    expect(edge[0]!.widthInches).toBeCloseTo(82 / 7, 5);
    expect(edge[2]!.upInches).toBeCloseTo(4, 5);
    const geo = buildSetInSleeveLaidOpenGeometry({
      upperArmInches: 82 / 7,
      wristInches: 9,
      sleeveLengthInches: 16.25,
      cuffDepthInches: 2,
      capHeightInches: 4,
      topWidthInches: 22 / 7,
      capEdgeInches: edge,
    });
    const step = geo.capEdge[1]!;
    const start = geo.capEdge[0]!;
    const widthDrop = start.right - start.left - (step.right - step.left);
    const rise = start.y - step.y;
    expect(widthDrop).toBeCloseTo(SET_IN_SLEEVE_PX_PER_INCH, 4);
    expect(rise).toBeCloseTo(SET_IN_SLEEVE_PX_PER_INCH, 4);
    expect(widthDrop).toBeCloseTo(rise, 4);
  });
});
