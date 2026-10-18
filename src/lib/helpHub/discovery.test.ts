import { describe, expect, it } from "vitest";
import {
  helpHubDiscoveryEntries,
  helpHubFavoriteContentId,
  helpHubSlugFromFavoriteContentId,
  nextDiscoveryIndex,
} from "./discovery";
import type { HelpHubTipRecord } from "../helpHubPublic";

const published = (overrides: HelpHubTipRecord): HelpHubTipRecord => ({
  status: "published",
  ...overrides,
});

describe("helpHubDiscoveryEntries", () => {
  const tips: HelpHubTipRecord[] = [
    published({
      id: 1,
      slug: "older-tip",
      createdAt: "2026-01-01T00:00:00.000Z",
      question: "Why is the carriage sticking?",
      bubbleAnswer: "Replace the sponge bar.",
    }),
    published({
      id: 3,
      slug: "newer-tip",
      createdAt: "2026-08-01T00:00:00.000Z",
      question: "How do I swatch over every other needle?",
      bubbleAnswer: "<p>Knit the swatch the same way.</p>",
    }),
    published({
      id: 4,
      slug: "missing-answer",
      question: "What if there is no saved reply?",
      bubbleAnswer: "   ",
    }),
    {
      id: 5,
      slug: "draft-tip",
      status: "draft",
      question: "Should a draft appear?",
      bubbleAnswer: "No.",
    },
    {
      id: 6,
      slug: "review-tip",
      status: "review",
      isNew: true,
      question: "Should a review appear?",
      bubbleAnswer: "No.",
    },
    published({
      id: 7,
      slug: "deleted-tip",
      deletedAt: "2026-09-01T00:00:00.000Z",
      question: "Was this removed?",
      bubbleAnswer: "Yes.",
    }),
  ];

  it("uses the saved quick answer from published entries and skips drafts", () => {
    expect(helpHubDiscoveryEntries(tips)).toEqual([
      {
        slug: "newer-tip",
        question: "How do I swatch over every other needle?",
        answer: "Knit the swatch the same way.",
      },
      {
        slug: "older-tip",
        question: "Why is the carriage sticking?",
        answer: "Replace the sponge bar.",
      },
    ]);
  });

  it("does not invent an answer from the explanation", () => {
    const explained: HelpHubTipRecord[] = [
      {
        ...published({
          id: 8,
          slug: "explanation-only",
          question: "Why does this happen?",
        }),
        solutionText: "This explanation is not the quick answer.",
      },
    ];
    expect(helpHubDiscoveryEntries(explained)).toEqual([]);
  });
});

describe("help hub favorite ids", () => {
  it("reuses a reference path for the published Help Hub", () => {
    expect(helpHubFavoriteContentId("newer-tip")).toBe("/help-hub/newer-tip");
    expect(helpHubSlugFromFavoriteContentId("/help-hub/newer-tip")).toBe("newer-tip");
    expect(helpHubSlugFromFavoriteContentId("/reference/abbreviations")).toBeNull();
  });
});

describe("nextDiscoveryIndex", () => {
  it("does not repeat an entry until the rest have been shown", () => {
    let seen = new Set<number>([0]);
    const shown = [0];
    const rolls = [0, 0, 0, 0];
    for (const roll of rolls) {
      const next = nextDiscoveryIndex(3, shown[shown.length - 1], seen, () => roll);
      expect(next).not.toBeNull();
      if (!next) return;
      shown.push(next.index);
      seen = next.seen;
    }
    expect(new Set(shown.slice(0, 3)).size).toBe(3);
    expect(shown[1]).not.toBe(0);
    expect(shown[2]).not.toBe(shown[1]);
    expect(shown[3]).not.toBe(shown[2]);
  });

  it("stays put when only one published entry is available", () => {
    expect(nextDiscoveryIndex(1, 0, new Set([0]), () => 0)).toBeNull();
  });
});
