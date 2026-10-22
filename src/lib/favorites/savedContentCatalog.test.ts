import { describe, expect, it } from "vitest";
import { knitAbleSlugFromPath } from "../knit-ables/schedule";
import { KNIT_ABLES_CARDS } from "../knit-ables/knitAblesLanding";
import {
  isMemberVisibleTip,
  knitAbleFavoriteEntries,
  tipFavoriteHref,
  tipSavedMeta,
} from "./savedContentCatalog";
import type { TipOfTheWeekRecord } from "../tipOfTheWeek/types";

function tip(partial: Partial<TipOfTheWeekRecord> & Pick<TipOfTheWeekRecord, "tipId" | "status" | "availableFrom" | "availableThrough">): TipOfTheWeekRecord {
  return {
    id: `row-${partial.tipId}`,
    title: partial.title ?? partial.tipId,
    intro: "",
    introGlossarySlug: "",
    videoContentId: "1",
    availabilityNotice: "",
    availabilityFooterTemplate: "",
    tryCopy: "",
    sueTipCopy: "",
    ctaText: "",
    ctaUrl: "",
    learnPoints: [],
    relatedLinks: [],
    eyebrow: "TIP OF THE WEEK",
    createdAt: "",
    updatedAt: "",
    ...partial,
  };
}

describe("saved content catalog", () => {
  const today = "2026-10-22";

  it("keeps a stable tip id in the saved link", () => {
    expect(tipFavoriteHref("cast-on-basics")).toBe("/tip-of-the-week?tip=cast-on-basics");
  });

  it("shows featured, past, and archived tips, and hides drafts and future tips", () => {
    expect(
      isMemberVisibleTip(
        { tipId: "now", status: "active", availableFrom: "2026-10-19", availableThrough: "2026-10-25" },
        today,
      ),
    ).toBe(true);
    expect(
      isMemberVisibleTip(
        { tipId: "past", status: "active", availableFrom: "2026-09-01", availableThrough: "2026-09-07" },
        today,
      ),
    ).toBe(true);
    expect(
      isMemberVisibleTip(
        { tipId: "old", status: "archived", availableFrom: "2026-08-01", availableThrough: "2026-08-07" },
        today,
      ),
    ).toBe(true);
    expect(
      isMemberVisibleTip(
        { tipId: "draft", status: "draft", availableFrom: "2026-10-01", availableThrough: "2026-10-07" },
        today,
      ),
    ).toBe(false);
    expect(
      isMemberVisibleTip(
        { tipId: "later", status: "scheduled", availableFrom: "2026-11-01", availableThrough: "2026-11-07" },
        today,
      ),
    ).toBe(false);
  });

  it("uses the live title and does not keep a title change from breaking the id", () => {
    const rows = tipSavedMeta(
      [
        tip({
          tipId: "cast-on",
          title: "A new title",
          status: "archived",
          availableFrom: "2026-08-01",
          availableThrough: "2026-08-07",
        }),
        tip({
          tipId: "draft-tip",
          title: "Secret draft",
          status: "draft",
          availableFrom: "2026-08-01",
          availableThrough: "2026-08-07",
        }),
      ],
      today,
    );
    expect(rows).toEqual([
      {
        contentId: "cast-on",
        title: "A new title",
        href: "/tip-of-the-week?tip=cast-on",
      },
    ]);
  });

  it("links only published Knit-ables and still names known unpublished ones", () => {
    const published = new Set(["teenage-kicks-socks"]);
    const rows = knitAbleFavoriteEntries(published);
    const socks = rows.find((row) => row.contentId === "teenage-kicks-socks");
    const vest = rows.find((row) => row.contentId === "vest-in-show");
    expect(socks?.href).toBe("/knit-ables/teenage-kicks-socks");
    expect(socks?.title.length).toBeGreaterThan(0);
    expect(vest?.href).toBe("");
    expect(vest?.title.length).toBeGreaterThan(0);
    expect(rows.map((row) => row.contentId)).toEqual(
      KNIT_ABLES_CARDS.map((card) => knitAbleSlugFromPath(card.href)).filter(
        (slug): slug is string => Boolean(slug),
      ),
    );
  });
});
