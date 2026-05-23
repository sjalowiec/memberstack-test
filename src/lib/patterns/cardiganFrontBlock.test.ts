import { describe, expect, it } from "vitest";
import {
  cardiganHalfFrontBodySts,
  resolveCardiganHalfFrontWidths,
  splitBodyBackCastOnToSymmetricCardiganHalves,
  splitFullFrontToSymmetricCardiganHalves,
} from "./cardiganFrontBlock";

function expectReconcilesBody(s: {
  bodyBackCastOnSts: number;
  leftFrontWidthSts: number;
  rightFrontWidthSts: number;
  frontOpeningWidthSts: number;
}) {
  expect(s.leftFrontWidthSts + s.rightFrontWidthSts + s.frontOpeningWidthSts).toBe(s.bodyBackCastOnSts);
}

describe("splitBodyBackCastOnToSymmetricCardiganHalves", () => {
  it("splits even body cast-on evenly with zero opening reserve", () => {
    const s = splitBodyBackCastOnToSymmetricCardiganHalves(40);
    expect(s.bodyBackCastOnSts).toBe(40);
    expect(s.frontOpeningWidthSts).toBe(0);
    expect(s.leftFrontWidthSts).toBe(20);
    expect(s.rightFrontWidthSts).toBe(20);
    expectReconcilesBody(s);
  });

  it("assigns odd workable stitches to the left half by default", () => {
    const s = splitBodyBackCastOnToSymmetricCardiganHalves(41);
    expect(s.leftFrontWidthSts).toBe(21);
    expect(s.rightFrontWidthSts).toBe(20);
    expectReconcilesBody(s);
  });

  it("assigns odd workable stitches to the right half when configured", () => {
    const s = splitBodyBackCastOnToSymmetricCardiganHalves(41, { oddStitchLargerSide: "right" });
    expect(s.leftFrontWidthSts).toBe(20);
    expect(s.rightFrontWidthSts).toBe(21);
    expectReconcilesBody(s);
  });

  it("reserves opening stitches before splitting halves", () => {
    const s = splitBodyBackCastOnToSymmetricCardiganHalves(41, { frontOpeningWidthSts: 5 });
    expect(s.frontOpeningWidthSts).toBe(5);
    expect(s.leftFrontWidthSts + s.rightFrontWidthSts).toBe(36);
    expectReconcilesBody(s);
  });

  it("reconciles odd body with odd workable after opening (deterministic)", () => {
    const s = splitBodyBackCastOnToSymmetricCardiganHalves(42, { frontOpeningWidthSts: 5 });
    expect(s.bodyBackCastOnSts).toBe(42);
    expect(s.frontOpeningWidthSts).toBe(5);
    expect(s.leftFrontWidthSts + s.rightFrontWidthSts).toBe(37);
    expect(s.leftFrontWidthSts).toBe(19);
    expect(s.rightFrontWidthSts).toBe(18);
    expectReconcilesBody(s);
  });
});

describe("splitFullFrontToSymmetricCardiganHalves (deprecated alias)", () => {
  it("matches splitBodyBackCastOnToSymmetricCardiganHalves", () => {
    const a = splitBodyBackCastOnToSymmetricCardiganHalves(81, { frontOpeningWidthSts: 1 });
    const b = splitFullFrontToSymmetricCardiganHalves(81, { frontOpeningWidthSts: 1 });
    expect(b).toEqual(a);
  });
});

describe("cardiganHalfFrontBodySts", () => {
  it("selects labeled half stitches", () => {
    const s = splitBodyBackCastOnToSymmetricCardiganHalves(41);
    expect(cardiganHalfFrontBodySts(s, "left")).toBe(s.leftFrontWidthSts);
    expect(cardiganHalfFrontBodySts(s, "right")).toBe(s.rightFrontWidthSts);
  });
});

describe("resolveCardiganHalfFrontWidths", () => {
  it("halves hem, bust, and armhole stitch counts for the left front (140 / 112 example)", () => {
    const left = resolveCardiganHalfFrontWidths(
      { hemCastOnSts: 140, bustBodySts: 112, stitchesAfterArmhole: 60 },
      "left",
    );
    expect(left.hemCastOnSts).toBe(70);
    expect(left.bustBodySts).toBe(56);
    expect(left.stitchesAfterArmhole).toBe(30);
  });
});
