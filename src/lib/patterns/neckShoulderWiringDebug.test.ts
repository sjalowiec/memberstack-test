import { describe, expect, it } from "vitest";
import { DEBUG_CASE_FRONT_53, formatNeckShoulderWiringDebug } from "./neckShoulderWiringDebug";

describe("neckShoulderWiringDebug", () => {
  it("53-st / 38 shoulder case: trace includes stair bindOff and phased shoulder", () => {
    const out = formatNeckShoulderWiringDebug(DEBUG_CASE_FRONT_53);
    expect(out).toContain('"centerBindOff": 18');
    expect(out).toContain("bindOff left inner ×3");
    expect(out).toContain("RC 251"); // first neck stair row after center bind-off at RC 249
    expect(out).toMatch(/decrease left inner/);
  });
});
