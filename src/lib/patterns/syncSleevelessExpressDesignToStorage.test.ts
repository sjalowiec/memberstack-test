import { describe, expect, it } from "vitest";
import { mapExpressNecklineToStorage } from "./syncSleevelessExpressDesignToStorage";

describe("mapExpressNecklineToStorage", () => {
  it("maps v-neck variants to canonical v", () => {
    expect(mapExpressNecklineToStorage("v-neck")).toBe("v");
    expect(mapExpressNecklineToStorage("V-neck")).toBe("v");
    expect(mapExpressNecklineToStorage("v")).toBe("v");
  });

  it("maps round and unknown values to round", () => {
    expect(mapExpressNecklineToStorage("round")).toBe("round");
    expect(mapExpressNecklineToStorage("")).toBe("round");
  });
});
