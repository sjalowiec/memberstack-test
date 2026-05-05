import { describe, expect, it } from "vitest";
import { calculateNecklineShaping } from "./necklineShaping";

describe("calculateNecklineShaping", () => {
  it("distributes remainder stitches across steps", () => {
    const steps = calculateNecklineShaping(7, 5);
    const total = steps.reduce((s, x) => s + x.stitches * x.times, 0);
    expect(total).toBe(7);
  });
});
