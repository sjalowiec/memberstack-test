import { describe, expect, it, vi } from "vitest";

import {
  buildSavedAsName,
  buildSavedPatternDisplay,
  buildSavedPatternName,
  buildGarmentDescription,
  formatGarmentDescriptionPreview,
  FALLBACK_SAVED_PATTERN_NAME,
  getMemberSavedPatternCount,
  getMemberSavedPatterns,
  getVisibleSavedPatternColumns,
  MEMBER_SAVED_PATTERN_COUNT_SQL,
  MEMBER_SAVED_PATTERNS_SQL,
  MEMBER_SAVED_PATTERN_SORTABLE_COLUMNS,
  WATSON_LEGACY_GARMENTS_TABLE,
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
    garment_title: null,
    garment_description: null,
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
    garment_title: null,
    garment_description: null,
  };

  it("filters saved patterns by member_fk and joins garment titles", async () => {
    const queryFn = vi.fn().mockResolvedValueOnce([]);

    await getMemberSavedPatterns(memberId, queryFn);

    expect(queryFn).toHaveBeenCalledWith(MEMBER_SAVED_PATTERNS_SQL, [memberId]);
    expect(MEMBER_SAVED_PATTERNS_SQL).toContain("legacy_member_pattern_details");
    expect(MEMBER_SAVED_PATTERNS_SQL).toContain(WATSON_LEGACY_GARMENTS_TABLE);
    expect(MEMBER_SAVED_PATTERNS_SQL).toContain("g.garment_id = d.garmentid_fk");
    expect(MEMBER_SAVED_PATTERNS_SQL).toContain("g.garment_title");
    expect(MEMBER_SAVED_PATTERNS_SQL).toContain("g.garment_description");
    expect(MEMBER_SAVED_PATTERNS_SQL).toContain("WHERE d.member_fk = $1");
  });

  it("defaults to newest builddate first in SQL", () => {
    expect(MEMBER_SAVED_PATTERNS_SQL).toContain(
      "ORDER BY d.builddate DESC NULLS LAST, d.detailid DESC",
    );
  });

  it("counts saved pattern records without loading full rows on the detail page", async () => {
    const queryFn = vi.fn().mockResolvedValueOnce([{ pattern_count: "12" }]);

    const count = await getMemberSavedPatternCount(memberId, queryFn);

    expect(queryFn).toHaveBeenCalledWith(MEMBER_SAVED_PATTERN_COUNT_SQL, [memberId]);
    expect(count).toBe(12);
  });

  it("exposes sortable saved pattern columns for the UI", () => {
    expect(MEMBER_SAVED_PATTERN_SORTABLE_COLUMNS).toEqual([
      "patternName",
      "savedAs",
      "savedDate",
      "size",
      "buildNotes",
    ]);
    expect(MEMBER_SAVED_PATTERN_SORTABLE_COLUMNS).not.toContain("detailId");
    expect(MEMBER_SAVED_PATTERN_SORTABLE_COLUMNS).not.toContain("patternType");
  });

  it("preserves multiple historical saved pattern records", async () => {
    const queryFn = vi.fn().mockResolvedValueOnce([firstRow, secondRow]);

    const records = await getMemberSavedPatterns(memberId, queryFn);

    expect(records).toHaveLength(2);
    expect(records.map((record) => record.detailId)).toEqual(["6", "3"]);
  });

  it("uses garment title as pattern name and CustomName as saved as", () => {
    const row = {
      ...secondRow,
      detailid: 89604,
      garmentid_fk: "2196",
      customname: "Gauge 6 standard",
      challengepatternname: "Challenge Should Not Win",
      garment_title: "Carnation",
      garment_description:
        "Basic DROP SHOULDER Pullover or Cardigan sweater.\nYour choice:\nRound or V-neck",
    };

    expect(buildSavedPatternName(row)).toBe("Carnation");
    expect(buildSavedAsName(row)).toBe("Gauge 6 standard");
    expect(buildSavedPatternDisplay(row).patternName).toBe("Carnation");
    expect(buildSavedPatternDisplay(row).savedAs).toBe("Gauge 6 standard");
    expect(buildSavedPatternDisplay(row).challengePatternName).toBe("Challenge Should Not Win");
  });

  it("displays garment title, a short description preview, and Saved as together", () => {
    const display = buildSavedPatternDisplay({
      ...secondRow,
      detailid: 89604,
      garmentid_fk: "2196",
      customname: "Gauge 6 standard",
      garment_title: "Carnation",
      garment_description:
        "Basic DROP SHOULDER Pullover or Cardigan sweater. Your choice: Round or V-neck; Straight or shaped shoulders; Optional bust darts. Use this basic shape as a jumping-off point for your own designs.",
    });

    expect(display.patternName).toBe("Carnation");
    expect(display.garmentDescription).toContain("Optional bust darts");
    expect(display.garmentDescriptionPreview).toContain("DROP SHOULDER");
    expect(display.garmentDescriptionPreview).toMatch(/\.\.\.$/);
    expect(display.garmentDescriptionPreview?.length).toBeLessThan(display.garmentDescription?.length ?? 0);
    expect(display.garmentDescriptionPreview?.length).toBeLessThanOrEqual(63);
    expect(display.garmentDescriptionPreview).not.toContain("jumping-off point");
    expect(display.savedAs).toBe("Gauge 6 standard");
  });

  it("truncates garment description previews to about 60 characters with an ellipsis", () => {
    const long =
      '"Keep it Simple" cardigan with modified drop shoulder and extra shaping notes that should not all appear.';
    const preview = formatGarmentDescriptionPreview(long);
    expect(preview).toBe('"Keep it Simple" cardigan with modified drop shoulder and...');
    expect(preview?.endsWith("...")).toBe(true);
    expect(preview?.length).toBeLessThanOrEqual(63);

    expect(formatGarmentDescriptionPreview("Short note")).toBe("Short note");
    expect(formatGarmentDescriptionPreview("   ")).toBeNull();
    expect(formatGarmentDescriptionPreview(null)).toBeNull();
  });

  it("omits description when it is blank or there is no garment match", () => {
    expect(
      buildGarmentDescription({
        garment_title: "Carnation",
        garment_description: "   ",
      }),
    ).toBeNull();
    expect(
      buildSavedPatternDisplay({
        ...firstRow,
        garment_title: "Rose",
        garment_description: null,
      }).garmentDescription,
    ).toBeNull();
    expect(
      buildSavedPatternDisplay({
        ...firstRow,
        customname: "Gauge 6 standard",
        garment_title: null,
        garment_description: "Should not show without a garment match",
      }).garmentDescription,
    ).toBeNull();
  });

  it("shows garment title only when CustomName is blank", () => {
    const known = [
      { detailid: 89397, garmentid_fk: "2194", garment_title: "Rose" },
      { detailid: 88833, garmentid_fk: "2196", garment_title: "Carnation" },
      { detailid: 62805, garmentid_fk: "769", garment_title: "Mauve Pullover" },
      {
        detailid: 62785,
        garmentid_fk: "194",
        garment_title: "Women's Elongated Stitches Cardigan",
      },
    ];

    for (const record of known) {
      const display = buildSavedPatternDisplay({
        ...firstRow,
        ...record,
        customname: "   ",
        challengepatternname: "Should Not Be Primary",
      });
      expect(display.patternName).toBe(record.garment_title);
      expect(display.savedAs).toBeNull();
    }
  });

  it("falls back when garment lookup is missing", () => {
    expect(
      buildSavedPatternName({
        garment_title: null,
        customname: "Gauge 6 standard",
        challengepatternname: "Drop Shoulder",
      }),
    ).toBe("Gauge 6 standard");
    expect(
      buildSavedPatternName({
        garment_title: null,
        customname: "  ",
        challengepatternname: "Drop Shoulder",
      }),
    ).toBe("Drop Shoulder");
    expect(
      buildSavedPatternName({
        garment_title: null,
        customname: null,
        challengepatternname: null,
      }),
    ).toBe(FALLBACK_SAVED_PATTERN_NAME);
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
    expect(display.patternName).toBe(FALLBACK_SAVED_PATTERN_NAME);
    expect(display.savedAs).toBeNull();
  });

  it("shows only support-facing columns and keeps Saved as when CustomName is present", () => {
    const visible = getVisibleSavedPatternColumns([
      buildSavedPatternDisplay(firstRow),
      buildSavedPatternDisplay(secondRow),
    ]);

    expect(visible).toEqual({
      showPatternName: true,
      showSavedAs: true,
      showSavedDate: true,
      showSize: true,
      showBuildNotes: true,
    });
  });

  it("hides saved as, size, and build notes when those values are blank", () => {
    const visible = getVisibleSavedPatternColumns([
      buildSavedPatternDisplay({
        ...firstRow,
        garment_title: "Rose",
        customname: null,
        size: null,
        buildnotes: "   ",
        builddate: "not-a-date",
      }),
    ]);

    expect(visible.showPatternName).toBe(true);
    expect(visible.showSavedAs).toBe(false);
    expect(visible.showSize).toBe(false);
    expect(visible.showBuildNotes).toBe(false);
  });
});
