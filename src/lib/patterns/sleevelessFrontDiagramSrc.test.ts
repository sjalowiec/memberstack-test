import { describe, expect, it } from "vitest";
import {
  getSleevelessShoulderNotationIconSrc,
  isSleevelessVNeckChoice,
  SLEEVELESS_SHOULDER_NOTATION_ICON_BACK,
  SLEEVELESS_SHOULDER_NOTATION_ICON_FRONT_ROUND,
  SLEEVELESS_SHOULDER_NOTATION_ICON_FRONT_V,
} from "./sleevelessFrontDiagramSrc";

describe("getSleevelessShoulderNotationIconSrc", () => {
  const vNeckPattern = { style: { neckline: "v-neck" } };
  const roundPattern = { style: { neckline: "round" } };

  it("back always uses shoulder-round-icon.svg (never front V asset)", () => {
    expect(getSleevelessShoulderNotationIconSrc("back", vNeckPattern)).toBe(SLEEVELESS_SHOULDER_NOTATION_ICON_BACK);
    expect(getSleevelessShoulderNotationIconSrc("back", vNeckPattern)).toBe("/images/patterns/shoulder-round-icon.svg");
    expect(getSleevelessShoulderNotationIconSrc("back", roundPattern)).toBe(SLEEVELESS_SHOULDER_NOTATION_ICON_BACK);
  });

  it("front v-neck uses shoulder-front-icon-v.svg", () => {
    expect(getSleevelessShoulderNotationIconSrc("front", vNeckPattern)).toBe(SLEEVELESS_SHOULDER_NOTATION_ICON_FRONT_V);
    expect(getSleevelessShoulderNotationIconSrc("front", vNeckPattern)).toBe("/images/patterns/shoulder-front-icon-v.svg");
  });

  it("front round uses standard shoulder-front-icon.svg", () => {
    expect(getSleevelessShoulderNotationIconSrc("front", roundPattern)).toBe(SLEEVELESS_SHOULDER_NOTATION_ICON_FRONT_ROUND);
    expect(getSleevelessShoulderNotationIconSrc("front", roundPattern)).toBe("/images/patterns/shoulder-front-icon.svg");
  });
});

describe("isSleevelessVNeckChoice", () => {
  it("returns false for round neckline value", () => {
    expect(isSleevelessVNeckChoice({ style: { neckline: "round" } })).toBe(false);
  });

  it("returns true for v-neck builder value", () => {
    expect(isSleevelessVNeckChoice({ style: { neckline: "v-neck" } })).toBe(true);
  });

  it("returns true for legacy flat v", () => {
    expect(isSleevelessVNeckChoice({ style: { neckline: "v" } })).toBe(true);
  });

  it("does not treat arbitrary strings containing letter v as V-neck", () => {
    expect(isSleevelessVNeckChoice({ style: { neckline: "sleeveless" } })).toBe(false);
    expect(isSleevelessVNeckChoice({ style: { neckline: "vertical rib" } })).toBe(false);
  });

  it("treats descriptive round-neck copy as round when it contains the word round", () => {
    expect(
      isSleevelessVNeckChoice({
        style: {
          neckline: "Women's sleeveless pullover with a round neckline",
        },
      }),
    ).toBe(false);
  });
});
