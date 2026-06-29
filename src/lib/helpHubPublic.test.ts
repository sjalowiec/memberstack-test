import { describe, expect, it } from "vitest";
import {
  filterPublicHelpHubTips,
  findPublicHelpHubTipBySlug,
  findPublicHelpHubTipsForVideo,
  helpHubTipIsPublic,
  publicHelpHubTipsForClientSearch,
  searchPublicHelpHubTips,
  type HelpHubTipRecord,
} from "./helpHubPublic";

const publishedTip: HelpHubTipRecord = {
  slug: "change-colors-lk150",
  status: "published",
  title: "Changing Colors on the LK150",
  question: "How do I change colors on my LK150?",
  mediaUrl: "change-colors-lk150",
  isNew: true,
};

const draftTip: HelpHubTipRecord = {
  slug: "change-colors-lk150",
  status: "draft",
  title: "Changing Colors on the LK150",
  question: "How do I change colors on my LK150?",
  mediaUrl: "change-colors-lk150",
  isNew: true,
};

const reviewTip: HelpHubTipRecord = {
  slug: "needs-review-tip",
  status: "review",
  title: "Review me",
};

describe("helpHubTipIsPublic", () => {
  it("treats published tips as public", () => {
    expect(helpHubTipIsPublic(publishedTip)).toBe(true);
  });

  it("hides draft tips", () => {
    expect(helpHubTipIsPublic(draftTip)).toBe(false);
  });

  it("hides review tips", () => {
    expect(helpHubTipIsPublic(reviewTip)).toBe(false);
  });

  it("does not let active:true override draft status", () => {
    expect(helpHubTipIsPublic({ ...draftTip, active: true })).toBe(false);
  });

  it("respects active:false on published tips", () => {
    expect(helpHubTipIsPublic({ ...publishedTip, active: false })).toBe(false);
  });

  it("treats legacy empty status as public", () => {
    expect(helpHubTipIsPublic({ slug: "legacy-tip" })).toBe(true);
  });
});

describe("filterPublicHelpHubTips", () => {
  it("removes draft and review entries", () => {
    const tips = [publishedTip, draftTip, reviewTip];
    expect(filterPublicHelpHubTips(tips)).toEqual([publishedTip]);
  });
});

describe("findPublicHelpHubTipBySlug", () => {
  it("returns published tips by slug", () => {
    expect(findPublicHelpHubTipBySlug([publishedTip, draftTip], "change-colors-lk150")).toEqual(
      publishedTip,
    );
  });

  it("returns undefined for draft slugs", () => {
    expect(findPublicHelpHubTipBySlug([draftTip], "change-colors-lk150")).toBeUndefined();
  });
});

describe("searchPublicHelpHubTips", () => {
  it("matches published tips and excludes drafts", () => {
    const results = searchPublicHelpHubTips([publishedTip, draftTip], "change color");
    expect(results).toEqual([publishedTip]);
  });

  it("returns empty for draft-only catalogs", () => {
    expect(searchPublicHelpHubTips([draftTip], "change color")).toEqual([]);
  });
});

describe("findPublicHelpHubTipsForVideo", () => {
  it("links published tips to catalog videos by slug or content id", () => {
    const bySlug = findPublicHelpHubTipsForVideo([publishedTip, draftTip], {
      content_id: 5001,
      slug: "change-colors-lk150",
    });
    expect(bySlug).toEqual([publishedTip]);

    const byContentIdMedia = findPublicHelpHubTipsForVideo(
      [{ ...publishedTip, mediaUrl: "5001", slug: "other-slug" }],
      { content_id: 5001 },
    );
    expect(byContentIdMedia).toHaveLength(1);
  });

  it("excludes draft tips related to a video", () => {
    expect(
      findPublicHelpHubTipsForVideo([draftTip], {
        content_id: 5001,
        slug: "change-colors-lk150",
      }),
    ).toEqual([]);
  });
});

describe("publicHelpHubTipsForClientSearch", () => {
  it("returns only public search rows", () => {
    expect(publicHelpHubTipsForClientSearch([publishedTip, draftTip])).toEqual([
      {
        slug: "change-colors-lk150",
        title: "Changing Colors on the LK150",
        question: "How do I change colors on my LK150?",
      },
    ]);
  });
});
