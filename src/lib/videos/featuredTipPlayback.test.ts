import { describe, expect, it } from "vitest";
import { catalogVideoPlaybackAccess } from "./catalogVideoPlaybackAccess";
import { markCurrentFeaturedTipForPlayback } from "./featuredTipPlayback";
import { resolveCatalogVideoEmbed } from "./resolveCatalogVideoEmbed";
import type { PublicVideoRow } from "../lessonVideo";

const memberTip = {
  content_id: 263,
  access_level: "member",
  vimeo_id: 151856654,
  title: "Mile-a-Minute Hats",
  status: "published",
};

const otherMember = {
  content_id: 257,
  access_level: "member",
  vimeo_id: 151849234,
  title: "Kitchener",
  status: "published",
};

const addedMember = {
  content_id: 5005,
  access_level: "member",
  vimeo_id: 1247443619,
  title: "Slip, Tuck, Fairisle",
  status: "published",
};

const publicVideo = {
  content_id: 258,
  access_level: "public",
  vimeo_id: 151850342,
  title: "Public",
  status: "published",
};

describe("markCurrentFeaturedTipForPlayback", () => {
  it("opens only the current featured tip and leaves other member videos locked", () => {
    const marked = markCurrentFeaturedTipForPlayback(
      [memberTip, otherMember, addedMember, publicVideo],
      "263",
    );
    expect(catalogVideoPlaybackAccess(marked[0] as { access_level?: string; isTipOfWeek?: boolean })).toBe(
      "open",
    );
    expect(catalogVideoPlaybackAccess(marked[1] as { access_level?: string; isTipOfWeek?: boolean })).toBe(
      "member",
    );
    expect(catalogVideoPlaybackAccess(marked[2] as { access_level?: string; isTipOfWeek?: boolean })).toBe(
      "member",
    );
    expect(catalogVideoPlaybackAccess(marked[3] as { access_level?: string; isTipOfWeek?: boolean })).toBe(
      "open",
    );
    expect(memberTip).not.toHaveProperty("isTipOfWeek");
  });

  it("does not open a member video when there is no current tip", () => {
    const marked = markCurrentFeaturedTipForPlayback([memberTip, otherMember], null);
    expect(catalogVideoPlaybackAccess(marked[0] as { access_level?: string })).toBe("member");
    expect(catalogVideoPlaybackAccess(marked[1] as { access_level?: string })).toBe("member");
  });

  it("lets the embed API serve the featured tip without membership", () => {
    const catalog = markCurrentFeaturedTipForPlayback(
      [memberTip, otherMember, addedMember],
      263,
    ) as PublicVideoRow[];
    const tip = resolveCatalogVideoEmbed(catalog, "263");
    const member = resolveCatalogVideoEmbed(catalog, "257");
    const other = resolveCatalogVideoEmbed(catalog, "5005");
    expect(tip.ok && tip.access).toBe("open");
    expect(member.ok && member.access).toBe("member");
    expect(other.ok && other.access).toBe("member");
  });
});
