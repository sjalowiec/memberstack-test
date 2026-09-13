import { describe, expect, it } from "vitest";
import {
  documentsMatch,
  fieldsFromTipDocument,
  normalizeRelatedLessonRefs,
  tipFromRow,
} from "./document";
import type { HelpHubTipRow } from "./types";

describe("Help Hub document helpers", () => {
  it("keeps numeric related lesson ids as numbers", () => {
    expect(normalizeRelatedLessonRefs([259, "368", "colorwork-first-steps"])).toEqual([
      259,
      368,
      "colorwork-first-steps",
    ]);
  });

  it("does not invent a category on import of a tip that never had one", () => {
    const fields = fieldsFromTipDocument(
      {
        id: 1010,
        slug: "slip-stitch-on-the-lk150",
        status: "published",
        title: "How do I knit slip stitch on the LK150?",
        relatedLessons: [370],
      },
      {
        id: 1010,
        slug: "slip-stitch-on-the-lk150",
        status: "published",
        title: "How do I knit slip stitch on the LK150?",
        category: "",
      },
    );
    expect(fields.category).toBeNull();
    expect("category" in fields.document).toBe(false);
    expect(
      documentsMatch(
        {
          id: 1010,
          slug: "slip-stitch-on-the-lk150",
          status: "published",
          title: "How do I knit slip stitch on the LK150?",
          relatedLessons: [370],
        },
        fields.document,
      ),
    ).toBe(true);
  });

  it("reads the saved jsonb document without overlaying empty hybrid columns", () => {
    const row: HelpHubTipRow = {
      id: 1008,
      slug: "patterns-for-lk150",
      status: "draft",
      sort_order: 51,
      category: "pattern-design-confusion",
      title: "Where can I find patterns for my LK150?",
      question: "Where can I find patterns for my LK150?",
      is_new: null,
      featured: null,
      document: {
        id: 1008,
        slug: "patterns-for-lk150",
        status: "draft",
        title: "Where can I find patterns for my LK150?",
        relatedLessons: [259, 368],
      },
      created_at: new Date("2026-09-08T00:00:00Z"),
      updated_at: new Date("2026-09-08T00:00:00Z"),
      updated_by: "sue@knititnow.com",
      deleted_at: null,
    };
    expect(tipFromRow(row).relatedLessons).toEqual([259, 368]);
    expect(tipFromRow(row).deletedAt).toBeUndefined();
  });
});
