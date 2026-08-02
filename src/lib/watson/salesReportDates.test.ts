import { describe, it, expect } from "vitest";

import {
  addCivilDays,
  civilDayKey,
  civilToString,
  eachCivilDay,
  laCivilDateOf,
  laCivilMidnightUtc,
  parseCivil,
  resolveDayRange,
} from "./salesReportDates";

// 2026-08-01T20:00:00Z is 2026-08-01 13:00 in Los Angeles (PDT, UTC-7).
const NOW_SUMMER = new Date("2026-08-01T20:00:00Z");
// 2026-01-15T20:00:00Z is 2026-01-15 12:00 in Los Angeles (PST, UTC-8).
const NOW_WINTER = new Date("2026-01-15T20:00:00Z");

describe("Los Angeles calendar-day boundaries", () => {
  it("computes the current LA civil date across the UTC day boundary", () => {
    // 2026-08-02T05:00:00Z = 2026-08-01 22:00 PDT ? still Aug 1 in LA.
    expect(civilToString(laCivilDateOf(new Date("2026-08-02T05:00:00Z")))).toBe("2026-08-01");
    // 2026-08-02T07:30:00Z = 2026-08-02 00:30 PDT ? Aug 2 in LA.
    expect(civilToString(laCivilDateOf(new Date("2026-08-02T07:30:00Z")))).toBe("2026-08-02");
  });

  it("returns LA midnight as the correct UTC instant (DST-aware)", () => {
    // PDT: LA midnight Aug 1 = 07:00 UTC.
    expect(laCivilMidnightUtc({ year: 2026, month: 8, day: 1 }).toISOString()).toBe(
      "2026-08-01T07:00:00.000Z",
    );
    // PST: LA midnight Jan 15 = 08:00 UTC.
    expect(laCivilMidnightUtc({ year: 2026, month: 1, day: 15 }).toISOString()).toBe(
      "2026-01-15T08:00:00.000Z",
    );
  });

  it("buckets timestamps into the correct LA calendar day", () => {
    expect(civilDayKey(new Date("2026-08-01T06:59:00Z"))).toBe("2026-07-31");
    expect(civilDayKey(new Date("2026-08-01T07:01:00Z"))).toBe("2026-08-01");
  });

  it("parses and rejects civil dates strictly", () => {
    expect(parseCivil("2026-02-28")).toEqual({ year: 2026, month: 2, day: 28 });
    expect(parseCivil("2026-02-31")).toBeNull();
    expect(parseCivil("2026-13-01")).toBeNull();
    expect(parseCivil("garbage")).toBeNull();
    expect(parseCivil("")).toBeNull();
  });

  it("adds civil days across month and DST boundaries", () => {
    expect(addCivilDays({ year: 2026, month: 7, day: 31 }, 1)).toEqual({
      year: 2026,
      month: 8,
      day: 1,
    });
    expect(addCivilDays({ year: 2026, month: 3, day: 8 }, 1)).toEqual({
      year: 2026,
      month: 3,
      day: 9,
    });
  });
});

describe("resolveDayRange presets", () => {
  it("defaults to Last 3 Days including today plus the previous two LA days", () => {
    const result = resolveDayRange({}, NOW_SUMMER);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.range.preset).toBe("last3");
    expect(result.range.fromCivil).toBe("2026-07-30");
    expect(result.range.toCivil).toBe("2026-08-01");
    expect(result.range.todayCivil).toBe("2026-08-01");
    expect(eachCivilDay(result.range.fromCivil, result.range.toCivil)).toEqual([
      "2026-07-30",
      "2026-07-31",
      "2026-08-01",
    ]);
  });

  it("unknown preset falls back to Last 3 Days", () => {
    const result = resolveDayRange({ preset: "bogus" }, NOW_SUMMER);
    expect(result.ok && result.range.preset).toBe("last3");
  });

  it("resolves today and yesterday", () => {
    const today = resolveDayRange({ preset: "today" }, NOW_SUMMER);
    expect(today.ok && today.range.fromCivil).toBe("2026-08-01");
    expect(today.ok && today.range.toCivil).toBe("2026-08-01");

    const yesterday = resolveDayRange({ preset: "yesterday" }, NOW_SUMMER);
    expect(yesterday.ok && yesterday.range.fromCivil).toBe("2026-07-31");
    expect(yesterday.ok && yesterday.range.toCivil).toBe("2026-07-31");
  });

  it("resolves last7 and this month (month-to-date)", () => {
    const last7 = resolveDayRange({ preset: "last7" }, NOW_SUMMER);
    expect(last7.ok && last7.range.fromCivil).toBe("2026-07-26");
    expect(last7.ok && last7.range.toCivil).toBe("2026-08-01");

    const month = resolveDayRange({ preset: "month" }, NOW_WINTER);
    expect(month.ok && month.range.fromCivil).toBe("2026-01-01");
    expect(month.ok && month.range.toCivil).toBe("2026-01-15");
  });

  it("marks today as the in-progress boundary in a range", () => {
    const result = resolveDayRange({ preset: "last3" }, NOW_SUMMER);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const days = eachCivilDay(result.range.fromCivil, result.range.toCivil);
    const inProgress = days.filter((d) => d === result.range.todayCivil);
    expect(inProgress).toEqual(["2026-08-01"]);
  });
});

describe("custom range validation", () => {
  it("accepts a valid custom range", () => {
    const result = resolveDayRange(
      { preset: "custom", from: "2026-07-01", to: "2026-07-15" },
      NOW_SUMMER,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.range.fromCivil).toBe("2026-07-01");
    expect(result.range.toCivil).toBe("2026-07-15");
  });

  it("rejects missing or malformed dates", () => {
    expect(resolveDayRange({ preset: "custom", from: "2026-07-01" }, NOW_SUMMER).ok).toBe(false);
    expect(resolveDayRange({ preset: "custom", from: "x", to: "y" }, NOW_SUMMER).ok).toBe(false);
  });

  it("rejects from after to", () => {
    const result = resolveDayRange(
      { preset: "custom", from: "2026-07-15", to: "2026-07-01" },
      NOW_SUMMER,
    );
    expect(result.ok).toBe(false);
  });

  it("rejects a To date in the future", () => {
    const result = resolveDayRange(
      { preset: "custom", from: "2026-07-01", to: "2026-09-01" },
      NOW_SUMMER,
    );
    expect(result.ok).toBe(false);
  });

  it("rejects an over-long range", () => {
    const result = resolveDayRange(
      { preset: "custom", from: "2020-01-01", to: "2026-08-01" },
      NOW_SUMMER,
    );
    expect(result.ok).toBe(false);
  });
});
