import { describe, expect, it } from "vitest";

import { isOnOrAfterImportStart, parseAcDateTime } from "./dates";
import { IMPORT_START_DATE } from "./constants";

describe("marketing calendar dates", () => {
  it("keeps an offset send time and the October 1 Los Angeles boundary", () => {
    const included = parseAcDateTime("2026-10-01T00:30:00-07:00", null);
    const excluded = parseAcDateTime("2026-09-30T23:30:00-07:00", null);
    expect(included.kind).toBe("instant");
    expect(excluded.kind).toBe("instant");
    if (included.kind !== "instant" || excluded.kind !== "instant") return;
    expect(isOnOrAfterImportStart(included.instant)).toBe(true);
    expect(isOnOrAfterImportStart(excluded.instant)).toBe(false);
    expect(IMPORT_START_DATE).toBe("2026-10-01");
  });

  it("interprets a naive time in the account zone and compares it in Los Angeles", () => {
    const parsed = parseAcDateTime("2026-10-15 09:00:00", "America/Los_Angeles");
    expect(parsed.kind).toBe("instant");
    if (parsed.kind !== "instant") return;
    expect(parsed.instant.toISOString()).toBe("2026-10-15T16:00:00.000Z");

    const eastern = parseAcDateTime("2026-10-01 00:30:00", "America/New_York");
    expect(eastern.kind).toBe("instant");
    if (eastern.kind !== "instant") return;
    expect(isOnOrAfterImportStart(eastern.instant)).toBe(false);
  });

  it("does not invent a time for an empty, zero, or date-only value", () => {
    expect(parseAcDateTime(null, "America/Los_Angeles").kind).toBe("empty");
    expect(parseAcDateTime("0000-00-00 00:00:00", "America/Los_Angeles").kind).toBe("empty");
    expect(parseAcDateTime("2026-10-15", "America/Los_Angeles")).toEqual({
      kind: "unparsed",
      reason: "date-without-time",
    });
    expect(parseAcDateTime("2026-10-15 09:00:00", null)).toEqual({
      kind: "unparsed",
      reason: "missing-timezone",
    });
  });

  it("rejects a daylight-saving gap and an overlap instead of guessing", () => {
    expect(parseAcDateTime("2026-03-08 02:30:00", "America/Los_Angeles").kind).toBe("unparsed");
    expect(parseAcDateTime("2026-11-01 01:30:00", "America/Los_Angeles")).toEqual({
      kind: "unparsed",
      reason: "ambiguous",
    });
  });
});
