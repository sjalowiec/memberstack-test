import { describe, expect, it, vi } from "vitest";

import {
  buildSavedPatternDisplay,
  buildSavedPatternName,
  getMemberSavedPatternCount,
  getMemberSavedPatterns,
  getVisibleSavedPatternColumns,
  MEMBER_SAVED_PATTERN_COUNT_SQL,
  MEMBER_SAVED_PATTERNS_SQL,
  MEMBER_SAVED_PATTERN_SORTABLE_COLUMNS,
} from "./memberSavedPatterns";

describe("memberSavedPatterns", () => {
  const memberId = "3B43FD8E-A9F3-4B1A-74CC-255ACCD77E11";

  const firstRow = {
    detailid: 6,
    member_fk: memberId,
    garmentid_fk: null,
    builddate: "2009-08-24T01:36:27.193Z",
    libraryid_fk: "4AE3E4AD-A99D-81F0-F2AF-D2550B390F4C",
    buildnotes: "asdf",
    buildid: "4AE77B60-D5AE-B047-878A-A11A8E907B5D",
    size: null,
    patterntype: null,
    gaugesizing: "1inch",
    challengeid_fk: null,
    challengepatternname: null,
    customfit: 0,
    customname: null,
    sizingsizeid: null,
    issuewithpattern: 0,
    issuewithpatternmarker: 0,
    neckshape: null,
    garmentstyle: null,
    datatoggles: null,
    patternidlist: null,
    fixed: 1,
  };

  const secondRow = {
    detailid: 3,
    member_fk: memberId,
    garmentid_fk: null,
    builddate: "2009-08-24T01:09:20.707Z",
    libraryid_fk: "45534259-BB4C-0BDE-C826-9F80E0FCDCC3",
    buildnotes: "yarn abc",
    buildid: "4ACEE242-BEA9-01E2-EB88-93864D5F57C4",
    size: "8",
    patterntype: "Sweater",
    gaugesizing: "1inch",
    challengeid_fk: "123",
    challengepatternname: "Drop Shoulder",
    customfit: 1,
    customname: "My Custom Vest",
    sizingsizeid: "M",
    issuewithpattern: 0,
    issuewithpatternmarker: 0,
    neckshape: "V",
    garmentstyle: "Vest",
    datatoggles: "toggle-a",
    patternidlist: "1,2,3",
    fixed: 1,
  };

  it("filters saved patterns by member_fk", async () => {
    const queryFn = vi.fn().mockResolvedValueOnce([]);

    await getMemberSavedPatterns(memberId, queryFn);

    expect(queryFn).toHaveBeenCalledWith(MEMBER_SAVED_PATTERNS_SQL, [memberId]);
    expect(MEMBER_SAVED_PATTERNS_SQL).toContain("legacy_member_pattern_details");
    expect(MEMBER_SAVED_PATTERNS_SQL).toContain("WHERE member_fk = $1");
  });

  it("defaults to newest builddate first in SQL", () => {
    expect(MEMBER_SAVED_PATTERNS_SQL).toContain(
      "ORDER BY builddate DESC NULLS LAST, detailid DESC",
    );
  });

  it("counts saved pattern records without loading full rows on the detail page", async () => {
    const queryFn = vi.fn().mockResolvedValueOnce([{ pattern_count: "12" }]);

    const count = await getMemberSavedPatternCount(memberId, queryFn);

    expect(queryFn).toHaveBeenCalledWith(MEMBER_SAVED_PATTERN_COUNT_SQL, [memberId]);
    expect(count).toBe(12);
  });

  it("exposes sortable saved pattern columns for the UI", () => {
    expect(MEMBER_SAVED_PATTERN_SORTABLE_COLUMNS).toContain("detailId");
    expect(MEMBER_SAVED_PATTERN_SORTABLE_COLUMNS).toContain("savedDate");
    expect(MEMBER_SAVED_PATTERN_SORTABLE_COLUMNS).toContain("buildNotes");
  });

  it("preserves multiple historical saved pattern records", async () => {
    const queryFn = vi.fn().mockResolvedValueOnce([firstRow, secondRow]);

    const records = await getMemberSavedPatterns(memberId, queryFn);

    expect(records).toHaveLength(2);
    expect(records.map((record) => record.detailId)).toEqual(["6", "3"]);
  });

  it("prefers custom name over challenge pattern name without merging records", () => {
    expect(buildSavedPatternName(secondRow)).toBe("My Custom Vest");
    expect(buildSavedPatternDisplay(secondRow).challengePatternName).toBe("Drop Shoulder");
  });

  it("handles incomplete legacy data safely", () => {
    const display = buildSavedPatternDisplay({
      ...firstRow,
      builddate: "not-a-date",
      buildnotes: "   ",
      patterntype: "",
    });

    expect(display.savedDate).toBeNull();
    expect(display.savedDateSort).toBe("");
    expect(display.buildNotes).toBeNull();
    expect(display.patternType).toBeNull();
    expect(display.patternName).toBeNull();
  });

  it("hides optional columns when a member has no useful values", () => {
    const visible = getVisibleSavedPatternColumns([
      buildSavedPatternDisplay(firstRow),
      buildSavedPatternDisplay(secondRow),
    ]);

    expect(visible.showGarmentStyle).toBe(true);
    expect(visible.showPatternName).toBe(false);
    expect(visible.showCustomName).toBe(true);
    expect(visible.showChallengePatternName).toBe(true);
    expect(visible.showBuildNotes).toBe(true);
  });
});
