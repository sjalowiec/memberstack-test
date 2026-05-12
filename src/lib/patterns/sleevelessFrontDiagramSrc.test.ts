import { describe, expect, it } from "vitest";
import { isSleevelessVNeckChoice } from "./sleevelessFrontDiagramSrc";

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
