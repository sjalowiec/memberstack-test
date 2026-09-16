import { describe, expect, it } from "vitest";
import { helpHubCategoryChoices, helpHubCategoryLabel } from "./categories";
import {
  helpHubIndexCardCopy,
  helpHubIndexCategorySections,
  helpHubIndexNewCards,
} from "./publicIndex";
import type { HelpHubTipRecord } from "../helpHubPublic";
import { searchPublicHelpHubTips } from "../helpHubPublic";

const everyOtherNeedle: HelpHubTipRecord = {
  id: 1012,
  slug: "every-other-needle-swatch",
  status: "published",
  isNew: true,
  category: "gauge-swatching",
  question: "I’m knitting over every other needle. How do I swatch?",
  title: "I’m knitting over every other needle. How do I swatch?",
};

const sandwichBand: HelpHubTipRecord = {
  id: 1002,
  slug: "sandwich-neckband-finish",
  status: "published",
  isNew: true,
  sortOrder: 10,
  category: "edges-finishing-assembly",
  question: "How do I create a clean, professional band finish for my neckline?",
  title: "The Perfect Sandwich Band",
};

const cutAndSew: HelpHubTipRecord = {
  id: 1001,
  slug: "cut-and-sew-shaping",
  status: "published",
  isNew: true,
  sortOrder: 5,
  category: "edges-finishing-assembly",
  question: "How do I shape a neckline without losing my lace or tuck pattern?",
  title: "Shape when knitting in pattern with Cut 'n Sew",
};

const gettingStarted: HelpHubTipRecord = {
  id: 1007,
  slug: "choosing-a-knitting-machine",
  status: "published",
  isNew: false,
  category: "getting-started",
  question: "How do I choose the right knitting machine?",
  title: "How do I choose the right knitting machine?",
};

const draftTip: HelpHubTipRecord = {
  id: 1099,
  slug: "draft-gauge-tip",
  status: "draft",
  isNew: true,
  category: "gauge-swatching",
  question: "Draft gauge question",
  title: "Draft gauge title",
};

const reviewTip: HelpHubTipRecord = {
  id: 1098,
  slug: "review-edges-tip",
  status: "review",
  isNew: true,
  category: "edges-finishing-assembly",
  question: "Needs review question",
  title: "Needs review title",
};

const unknownCategoryPublished: HelpHubTipRecord = {
  id: 1009,
  slug: "how-do-i-knit-tuck-stitch-on-my-lk150",
  status: "published",
  isNew: true,
  category: "machine-knitting-techniques",
  question: "How do I knit tuck stitch on my LK150?",
  title: "Easy, beautiful texture with tuck stitch",
};

const lk150Tuck: HelpHubTipRecord = {
  id: 1011,
  slug: "lk150-tuck-swatch",
  status: "published",
  isNew: true,
  category: "lk150",
  question: "How do I knit tuck stitch on my LK150?",
  title: "Easy, beautiful texture with tuck stitch",
};

const machinesChoice: HelpHubTipRecord = {
  id: 1013,
  slug: "choosing-a-knitting-machine-published",
  status: "published",
  isNew: false,
  category: "machines",
  question: "How do I choose the right knitting machine?",
  title: "Machine Selection Guide",
};

const somethingNotWorking: HelpHubTipRecord = {
  id: 1014,
  slug: "stuck-carriage",
  status: "published",
  isNew: false,
  category: "machine-not-working",
  question: "Help! My carriage is jammed",
  title: "The Stuck Carriage Rescue",
};

describe("helpHubIndexCardCopy", () => {
  it("shows the question only, even when the stored title differs", () => {
    expect(helpHubIndexCardCopy(everyOtherNeedle)).toEqual({
      heading: "I’m knitting over every other needle. How do I swatch?",
    });
    expect(helpHubIndexCardCopy(sandwichBand)).toEqual({
      heading: "How do I create a clean, professional band finish for my neckline?",
    });
    expect(helpHubIndexCardCopy(sandwichBand)).not.toEqual(
      expect.objectContaining({ heading: "The Perfect Sandwich Band" }),
    );
  });
});

describe("helpHubIndexNewCards", () => {
  it("still displays published entries marked new", () => {
    const cards = helpHubIndexNewCards([
      everyOtherNeedle,
      sandwichBand,
      gettingStarted,
      draftTip,
    ]);
    expect(cards.map((card) => card.slug)).toEqual([
      "sandwich-neckband-finish",
      "every-other-needle-swatch",
    ]);
    expect(cards.find((card) => card.slug === "every-other-needle-swatch")?.heading).toBe(
      "I’m knitting over every other needle. How do I swatch?",
    );
    expect(cards.find((card) => card.slug === "sandwich-neckband-finish")?.heading).toBe(
      "How do I create a clean, professional band finish for my neckline?",
    );
    expect(cards.every((card) => !("subtitle" in card))).toBe(true);
  });
});

describe("helpHubIndexCategorySections", () => {
  it("groups published entries under their assigned catalog categories", () => {
    const sections = helpHubIndexCategorySections([
      everyOtherNeedle,
      sandwichBand,
      cutAndSew,
      gettingStarted,
      draftTip,
      reviewTip,
      unknownCategoryPublished,
    ]);

    expect(sections.map((section) => section.key)).toEqual([
      "edges-finishing-assembly",
      "getting-started",
      "gauge-swatching",
    ]);
    expect(sections.map((section) => section.label)).toEqual([
      "Edges, Finishing & Assembly",
      "Getting Started",
      "Gauge & Swatching",
    ]);
  });

  it("displays the every-other-needle entry under Gauge & Swatching", () => {
    const sections = helpHubIndexCategorySections([everyOtherNeedle, sandwichBand, draftTip]);
    const gauge = sections.find((section) => section.key === "gauge-swatching");
    expect(gauge?.label).toBe("Gauge & Swatching");
    expect(gauge?.cards).toEqual([
      {
        slug: "every-other-needle-swatch",
        heading: "I’m knitting over every other needle. How do I swatch?",
      },
    ]);
  });

  it("follows the shared category catalog order", () => {
    const catalogKeys = helpHubCategoryChoices().map((choice) => choice.key);
    const sections = helpHubIndexCategorySections([
      everyOtherNeedle,
      gettingStarted,
      sandwichBand,
    ]);
    const sectionKeys = sections.map((section) => section.key);
    const catalogPositions = sectionKeys.map((key) => catalogKeys.indexOf(key));
    expect(catalogPositions.every((pos) => pos >= 0)).toBe(true);
    expect([...catalogPositions].sort((a, b) => a - b)).toEqual(catalogPositions);
    expect(sectionKeys.indexOf("getting-started")).toBeLessThan(
      sectionKeys.indexOf("gauge-swatching"),
    );
  });

  it("hides draft and needs-review entries from public category sections", () => {
    const sections = helpHubIndexCategorySections([
      everyOtherNeedle,
      draftTip,
      reviewTip,
    ]);
    const slugs = sections.flatMap((section) => section.cards.map((card) => card.slug));
    expect(slugs).toEqual(["every-other-needle-swatch"]);
    expect(slugs).not.toContain("draft-gauge-tip");
    expect(slugs).not.toContain("review-edges-tip");
  });

  it("omits catalog categories that have no published entries", () => {
    const sections = helpHubIndexCategorySections([everyOtherNeedle]);
    expect(sections.map((section) => section.key)).toEqual(["gauge-swatching"]);
    expect(sections.some((section) => section.key === "machines")).toBe(false);
    expect(helpHubCategoryLabel("machines")).toBe("Machines");
  });

  it("lets an isNew entry appear in New and again in its category", () => {
    const tips = [everyOtherNeedle, sandwichBand];
    const newSlugs = helpHubIndexNewCards(tips).map((card) => card.slug);
    const categorySlugs = helpHubIndexCategorySections(tips).flatMap((section) =>
      section.cards.map((card) => card.slug),
    );
    expect(newSlugs).toContain("every-other-needle-swatch");
    expect(categorySlugs).toContain("every-other-needle-swatch");
  });

  it("displays published LK150 entries under the LK150 heading after Machines", () => {
    const sections = helpHubIndexCategorySections([
      lk150Tuck,
      machinesChoice,
      everyOtherNeedle,
    ]);
    expect(sections.map((section) => section.key)).toEqual([
      "gauge-swatching",
      "machines",
      "lk150",
    ]);
    expect(sections.map((section) => section.label)).toEqual([
      "Gauge & Swatching",
      "Machines",
      "LK150",
    ]);
    const lk150 = sections.find((section) => section.key === "lk150");
    expect(lk150?.cards).toEqual([
      {
        slug: "lk150-tuck-swatch",
        heading: "How do I knit tuck stitch on my LK150?",
      },
    ]);
    expect(lk150?.cards[0]).not.toEqual(
      expect.objectContaining({ subtitle: "Easy, beautiful texture with tuck stitch" }),
    );
  });

  it("does not show the removed My Knitting Doesn’t Look Right category", () => {
    const sections = helpHubIndexCategorySections([
      somethingNotWorking,
      {
        ...somethingNotWorking,
        id: 1097,
        slug: "orphan-look-right",
        category: "knitting-doesnt-look-right",
        question: "Why does my knitting look wrong?",
        title: "Look Right",
      },
    ]);
    expect(sections.map((section) => section.key)).toEqual(["machine-not-working"]);
    expect(sections.map((section) => section.label)).toEqual(["Something’s Not Working"]);
    expect(sections.some((section) => section.key === "knitting-doesnt-look-right")).toBe(false);
    expect(sections.flatMap((section) => section.cards.map((card) => card.slug))).toEqual([
      "stuck-carriage",
    ]);
  });

  it("uses the admin-managed category order on the public index", () => {
    const managed = [
      { id: 9, key: "lk150", label: "LK150", sortOrder: 10, retiredAt: null },
      { id: 7, key: "machines", label: "Machines", sortOrder: 20, retiredAt: null },
      {
        id: 2,
        key: "knitting-doesnt-look-right",
        label: "My Knitting Doesn’t Look Right",
        sortOrder: 30,
        retiredAt: "seeded",
      },
    ];
    const sections = helpHubIndexCategorySections([lk150Tuck, machinesChoice], managed);
    expect(sections.map((section) => section.key)).toEqual(["lk150", "machines"]);
    expect(sections.map((section) => section.label)).toEqual(["LK150", "Machines"]);
  });
});

describe("Help Hub public index search text", () => {
  it("still matches questions, stored titles, category keys, and category labels", () => {
    const tips = [everyOtherNeedle, sandwichBand, draftTip];
    expect(searchPublicHelpHubTips(tips, "every other needle").map((t) => t.slug)).toEqual([
      "every-other-needle-swatch",
    ]);
    expect(searchPublicHelpHubTips(tips, "The Perfect Sandwich Band").map((t) => t.slug)).toEqual([
      "sandwich-neckband-finish",
    ]);
    expect(searchPublicHelpHubTips(tips, "gauge-swatching").map((t) => t.slug)).toEqual([
      "every-other-needle-swatch",
    ]);
    expect(searchPublicHelpHubTips(tips, "Gauge & Swatching").map((t) => t.slug)).toEqual([
      "every-other-needle-swatch",
    ]);
    expect(searchPublicHelpHubTips(tips, "Draft gauge question")).toEqual([]);
  });

  it("matches published LK150 entries by catalog key and label", () => {
    const lk150CatalogTip: HelpHubTipRecord = {
      ...lk150Tuck,
      slug: "lk150-cast-on",
      question: "How do I cast on without the edge collapsing?",
      title: "A clean plastic-bed cast on",
    };
    expect(searchPublicHelpHubTips([lk150CatalogTip, draftTip], "LK150").map((t) => t.slug)).toEqual([
      "lk150-cast-on",
    ]);
    expect(searchPublicHelpHubTips([lk150CatalogTip], "lk150").map((t) => t.slug)).toEqual([
      "lk150-cast-on",
    ]);
    expect(searchPublicHelpHubTips([{ ...lk150CatalogTip, status: "draft" }], "LK150")).toEqual([]);
  });
});
