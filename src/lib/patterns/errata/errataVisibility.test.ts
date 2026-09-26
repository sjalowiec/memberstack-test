import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  BABY_KIDS_LENGTH_ERRATA_TITLE,
  BABY_KIDS_LENGTH_KNITTER_ACTION,
  BABY_KIDS_LENGTH_MATCH_RULES,
  BABY_KIDS_LENGTH_WHAT_CHANGED,
} from "./babyKidsLengthErrata";
import {
  noticesForSavedPattern,
  publishedPatternErrata,
  savedPatternNoticeText,
  SAVED_PATTERN_ERRATA_NOTICE_TEXT,
} from "./errataVisibility";
import type { PatternErrataRecord } from "./types";

function row(status: PatternErrataRecord["status"]): PatternErrataRecord {
  return {
    id: "6f3c1a90-7b24-4e1d-9a55-0c8e2b7d4f61",
    slug: "baby-kids-finished-length",
    status,
    title: "Baby and kids finished sweater lengths",
    whatChanged: BABY_KIDS_LENGTH_WHAT_CHANGED,
    knitterAction: BABY_KIDS_LENGTH_KNITTER_ACTION,
    publishedOn: status === "published" ? "2026-09-26" : null,
    affectedBuilders: ["drop-shoulder", "sleeveless"],
    affectedSizes: { baby: ["3 mo"] },
    matchRules: BABY_KIDS_LENGTH_MATCH_RULES,
    createdAt: "2026-09-26T13:00:00.000Z",
    updatedAt: "2026-09-26T13:00:00.000Z",
    updatedBy: null,
  };
}

const oldBaby = {
  id: "saved-1",
  createdAt: "2026-01-15T00:00:00.000Z",
  pattern: {
    patternType: "sleeveless",
    style: {
      construction: "drop-shoulder",
      constructionAuthored: "drop-shoulder",
      recipientCategory: "baby",
    },
    fit: {
      sizingChart: "baby",
      selectedSize: "3 mo",
      selectedMeasurements: { back_neck_to_hem: 6 },
    },
  },
};

describe("pattern errata visibility", () => {
  it("hides drafts from the public list", () => {
    expect(publishedPatternErrata([row("draft"), row("published")]).map((item) => item.status)).toEqual([
      "published",
    ]);
  });

  it("shows a notice only for a published correction on a saved pattern that still has the old default", () => {
    expect(noticesForSavedPattern([row("draft")], oldBaby, "saved-1")).toEqual([]);
    expect(noticesForSavedPattern([row("published")], oldBaby, "")).toEqual([]);
    expect(
      noticesForSavedPattern(
        [row("published")],
        {
          ...oldBaby,
          pattern: {
            ...oldBaby.pattern,
            fit: {
              ...oldBaby.pattern.fit,
              selectedMeasurements: { back_neck_to_hem: 9 },
            },
          },
        },
        "saved-1",
      ),
    ).toEqual([]);

    const notices = noticesForSavedPattern([row("published")], oldBaby, "saved-1");
    expect(notices).toHaveLength(1);
    expect(notices[0]?.href).toBe("/patterns/errata#baby-kids-finished-length");
    expect(notices[0]?.knitterAction).toContain("create a new pattern");
    expect(notices[0]?.title).toBe("Baby and kids finished sweater lengths");
    expect(notices[0]?.matchedMeasurements).toEqual(["finished-length"]);
    expect(savedPatternNoticeText(notices[0]!)).toBe(SAVED_PATTERN_ERRATA_NOTICE_TEXT);
    expect(savedPatternNoticeText(notices[0]!)).not.toMatch(/centimeter|8\.75|was 6/i);
  });

  it("keeps a draft hidden when only the Kids 2 upper arm matches, and names that measurement once published", () => {
    const kidsUpperArmOnly = {
      id: "saved-2",
      createdAt: "2026-01-15T00:00:00.000Z",
      pattern: {
        patternType: "sleeveless",
        style: {
          construction: "drop-shoulder",
          constructionAuthored: "drop-shoulder",
          recipientCategory: "kids",
        },
        fit: {
          sizingChart: "kids",
          selectedSize: "2 yr",
          selectedMeasurements: { back_neck_to_hem: 13, upper_arm: 6 },
        },
      },
    };
    expect(noticesForSavedPattern([row("draft")], kidsUpperArmOnly, "saved-2")).toEqual([]);
    const notices = noticesForSavedPattern([row("published")], kidsUpperArmOnly, "saved-2");
    expect(notices).toHaveLength(1);
    expect(notices[0]?.matchedMeasurements).toEqual(["upper-arm"]);
    expect(notices[0]?.lengthInches).toBe(13);
    expect(notices[0]?.upperArmInches).toBe(6);
    expect(savedPatternNoticeText(notices[0]!)).toBe(
      "This saved pattern may contain an older measurement. Saved measurements do not update automatically.",
    );
    expect(savedPatternNoticeText(notices[0]!)).not.toMatch(/centimeter|11\.25|upper arm \(6/i);
  });

  it("keeps the draft seed unpublished and does not send mail or edit saved patterns", () => {
    const sql = readFileSync("scripts/sql/pattern-errata.sql", "utf8");
    const migration = readFileSync("supabase/migrations/20260926140000_pattern_errata.sql", "utf8");
    for (const source of [sql, migration]) {
      expect(source).toContain("CREATE TABLE IF NOT EXISTS public.pattern_errata");
      expect(source).toContain("ENABLE ROW LEVEL SECURITY");
      expect(source).not.toContain("CREATE POLICY");
      expect(source).not.toMatch(/ALTER TABLE[\s\S]*FORCE ROW LEVEL SECURITY/i);
      expect(source).not.toMatch(/\bDELETE\s+FROM\b/i);
      expect(source).not.toMatch(/\bDROP\s+TABLE\b/i);
      expect(source).toContain("'draft'");
      expect(source).toContain("baby-kids-finished-length");
      expect(source).toContain("ON CONFLICT (id) DO NOTHING");
      expect(source).toContain('"size":"2 yr","oldLengthInches":18,"newLengthInches":11.25,"oldUpperArmInches":6,"newUpperArmInches":7.5');
      expect(source).toContain("published_on");
      expect(source).toContain(BABY_KIDS_LENGTH_WHAT_CHANGED.split("\n")[0]);
      expect(source).not.toMatch(/inches\/centimeters|centimeters control/i);
      expect(source).toContain("V-neck");
      expect(source).not.toMatch(/sendMail|nodemailer|UPDATE custom-pattern/i);
    }
    expect(sql).toContain(BABY_KIDS_LENGTH_KNITTER_ACTION.replaceAll("'", "''"));
    for (const copy of [BABY_KIDS_LENGTH_ERRATA_TITLE, BABY_KIDS_LENGTH_WHAT_CHANGED, BABY_KIDS_LENGTH_KNITTER_ACTION, SAVED_PATTERN_ERRATA_NOTICE_TEXT]) {
      expect(copy).not.toMatch(/inches\/centimeters|centimeters control/i);
    }
    expect(BABY_KIDS_LENGTH_WHAT_CHANGED).toContain("7.5 in upper arm");
    expect(BABY_KIDS_LENGTH_WHAT_CHANGED).toContain("V-neck");
  });
});
