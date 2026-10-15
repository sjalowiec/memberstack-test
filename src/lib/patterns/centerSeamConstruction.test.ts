import { describe, expect, it } from "vitest";
import {
  assessSetInSleeveNeedleCapacity,
  centerSeamHalfStitches,
  readCenterSeams,
} from "./centerSeamConstruction";

describe("center seam construction", () => {
  it("gives the odd stitch to the left half and adds one seam stitch", () => {
    expect(centerSeamHalfStitches(101, "left", true)).toBe(52);
    expect(centerSeamHalfStitches(101, "right", true)).toBe(51);
    expect(centerSeamHalfStitches(101, "left", false) + centerSeamHalfStitches(101, "right", false)).toBe(101);
  });

  it("offers seams only when every resulting piece fits", () => {
    const body = assessSetInSleeveNeedleCapacity({
      availableNeedles: 80,
      cardigan: false,
      centerSeamsAccepted: false,
      backHem: 140,
      backBust: 120,
      sleeveNeedles: 70,
    });
    expect(body.offerSeams).toBe(true);
    expect(body.shouldBlock).toBe(true);

    const sleeve = assessSetInSleeveNeedleCapacity({
      availableNeedles: 80,
      cardigan: false,
      centerSeamsAccepted: false,
      backHem: 140,
      backBust: 120,
      sleeveNeedles: 90,
    });
    expect(sleeve.offerSeams).toBe(false);
    expect(sleeve.seamBlockReason).toMatch(/sleeve/i);

    const accepted = assessSetInSleeveNeedleCapacity({
      availableNeedles: 80,
      cardigan: true,
      centerSeamsAccepted: true,
      backHem: 140,
      backBust: 120,
      cardiganFrontHem: 70,
      cardiganFrontBust: 60,
      sleeveNeedles: 70,
    });
    expect(accepted.seamsFit).toBe(true);
    expect(accepted.shouldBlock).toBe(false);
    expect(readCenterSeams({ centerSeams: true })).toBe(true);
    expect(readCenterSeams({})).toBe(false);
  });

  it("does not block when available needles are missing", () => {
    const open = assessSetInSleeveNeedleCapacity({
      availableNeedles: null,
      cardigan: false,
      centerSeamsAccepted: false,
      backHem: 300,
      backBust: 300,
      sleeveNeedles: 80,
    });
    expect(open.shouldBlock).toBe(false);
    expect(open.fitsAsWritten).toBe(true);
  });
});
