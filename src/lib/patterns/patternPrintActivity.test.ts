import { describe, expect, it } from "vitest";

import {
  resetPatternPrintActivityDedupe,
  shouldRecordPatternPrint,
} from "./patternPrintActivity";

describe("pattern print activity", () => {
  it("records one print when several calls happen in the same action", () => {
    resetPatternPrintActivityDedupe();
    const start = 1_700_000_000_000;
    expect(shouldRecordPatternPrint(start)).toBe(true);
    expect(shouldRecordPatternPrint(start + 50)).toBe(false);
    expect(shouldRecordPatternPrint(start + 900)).toBe(false);
    expect(shouldRecordPatternPrint(start + 1600)).toBe(true);
  });
});
