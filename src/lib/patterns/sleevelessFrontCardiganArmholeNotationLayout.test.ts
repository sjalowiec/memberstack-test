import { describe, expect, it } from "vitest";
import {
  CARDIGAN_ARMHOLE_NOTATION_GAP,
  cardiganArmholeNotationYs,
} from "./sleevelessFrontCardiganArmholeNotationLayout";

describe("cardiganArmholeNotationYs", () => {
  it("keeps BO at the armhole-start row and stacks later lines upward", () => {
    expect(CARDIGAN_ARMHOLE_NOTATION_GAP).toBe(18);
    expect(cardiganArmholeNotationYs(208, 3)).toEqual([208, 190, 172]);
  });
});
