import { describe, expect, it } from "vitest";

describe("sleevelessPatternPageShared module load", () => {
  it("imports without duplicate-binding SyntaxError", async () => {
    const mod = await import("./sleevelessPatternPageShared.ts");
    expect(typeof mod.initSleevelessPatternBuilderPage).toBe("function");
  });
});
