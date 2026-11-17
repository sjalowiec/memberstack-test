import { describe, expect, it } from "vitest";
import { catalogVideoPlaybackAccess } from "./catalogVideoPlaybackAccess";
import {
  featuredTipContentIdForPlayback,
  markCurrentFeaturedTipForPlayback,
} from "./featuredTipPlayback";
import { resolveCatalogVideoEmbed } from "./resolveCatalogVideoEmbed";
import type { PublicVideoRow } from "../lessonVideo";

const previousTip = {
  status: "scheduled" as const,
  availableFrom: "2026-11-07",
  availableThrough: "2026-11-13",
  updatedAt: "2026-11-07T12:00:00.000Z",
  videoContentId: "249",
};

const currentTip = {
  status: "scheduled" as const,
  availableFrom: "2026-11-14",
  availableThrough: "2026-11-20",
  updatedAt: "2026-11-14T12:00:00.000Z",
  videoContentId: "263",
};

const nextTip = {
  status: "scheduled" as const,
  availableFrom: "2026-11-21",
  availableThrough: "2026-11-27",
  updatedAt: "2026-11-14T12:00:00.000Z",
  videoContentId: "527",
};

const memberTip = {
  content_id: 263,
  access_level: "member",
  vimeo_id: 151856654,
  title: "Mile-a-Minute Hats",
  status: "published",
  isTipOfWeek: false,
};

const previousVideo = {
  content_id: 249,
  access_level: "member",
  vimeo_id: 151819909,
  title: "Introduction to Cut and Sew",
  status: "published",
  isTipOfWeek: true,
  tipOfWeek: true,
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
  isTipOfWeek: true,
};

const publicVideo = {
  content_id: 258,
  access_level: "public",
  vimeo_id: 151850342,
  title: "Public",
  status: "published",
};

const nextVideo = {
  content_id: 527,
  access_level: "member",
  vimeo_id: 151900000,
  title: "Next tip",
  status: "published",
};

const catalog = [memberTip, previousVideo, otherMember, addedMember, publicVideo, nextVideo];

function accessFor(contentId: string, featuredContentId: string | null) {
  const marked = markCurrentFeaturedTipForPlayback(catalog, featuredContentId);
  const row = marked.find((video) => String(video.content_id) === contentId);
  return catalogVideoPlaybackAccess(row ?? { access_level: "member" });
}

describe("featured tip schedule and playback", () => {
  it("opens only the scheduled tip and ignores a flag left on the previous video", () => {
    const featuredId = featuredTipContentIdForPlayback(
      [previousTip, currentTip, nextTip],
      "2026-11-17",
    );
    expect(featuredId).toBe("263");
    const marked = markCurrentFeaturedTipForPlayback(catalog, featuredId);
    expect(catalogVideoPlaybackAccess(marked[0])).toBe("open");
    expect(catalogVideoPlaybackAccess(marked[1])).toBe("member");
    expect(catalogVideoPlaybackAccess(marked[2])).toBe("member");
    expect(catalogVideoPlaybackAccess(marked[3])).toBe("member");
    expect(catalogVideoPlaybackAccess(marked[4])).toBe("open");
    expect(catalogVideoPlaybackAccess(marked[5])).toBe("member");
    expect(memberTip.access_level).toBe("member");
    expect(previousVideo.access_level).toBe("member");
    expect(publicVideo.access_level).toBe("public");
    expect(previousVideo.isTipOfWeek).toBe(true);
    expect(memberTip).not.toHaveProperty("featuredTipPlayback");
  });

  it("moves free access when the current tip is replaced with another video", () => {
    const replaced = { ...currentTip, videoContentId: "527", updatedAt: "2026-11-17T18:00:00.000Z" };
    const featuredId = featuredTipContentIdForPlayback([previousTip, replaced], "2026-11-17");
    expect(featuredId).toBe("527");
    expect(accessFor("263", featuredId)).toBe("member");
    expect(accessFor("249", featuredId)).toBe("member");
    expect(accessFor("527", featuredId)).toBe("open");
    expect(accessFor("257", featuredId)).toBe("member");
    expect(accessFor("5005", featuredId)).toBe("member");
    expect(accessFor("258", featuredId)).toBe("open");
  });

  it("keeps the same video open when the free period is extended", () => {
    const extended = { ...currentTip, availableThrough: "2026-11-27" };
    expect(featuredTipContentIdForPlayback([previousTip, extended], "2026-11-17")).toBe("263");
    expect(featuredTipContentIdForPlayback([previousTip, extended], "2026-11-20")).toBe("263");
    expect(featuredTipContentIdForPlayback([previousTip, extended], "2026-11-27")).toBe("263");
    expect(accessFor("263", "263")).toBe("open");
    expect(accessFor("249", "263")).toBe("member");
  });

  it("drops temporary access the day after the free period, with no further publish", () => {
    expect(featuredTipContentIdForPlayback([previousTip, currentTip], "2026-11-20")).toBe("263");
    expect(featuredTipContentIdForPlayback([previousTip, currentTip], "2026-11-21")).toBeNull();
    expect(accessFor("263", null)).toBe("member");
    expect(accessFor("249", null)).toBe("member");
    expect(accessFor("257", null)).toBe("member");
    expect(accessFor("5005", null)).toBe("member");
    expect(accessFor("258", null)).toBe("open");

    const featuredId = featuredTipContentIdForPlayback(
      [previousTip, currentTip, nextTip],
      "2026-11-21",
    );
    expect(featuredId).toBe("527");
    expect(accessFor("263", featuredId)).toBe("member");
    expect(accessFor("527", featuredId)).toBe("open");
  });

  it("does not publish a draft, an archived tip, or a stored tip checkbox", () => {
    expect(
      featuredTipContentIdForPlayback(
        [{ ...currentTip, status: "draft" }],
        "2026-11-17",
      ),
    ).toBeNull();
    expect(
      featuredTipContentIdForPlayback(
        [{ ...currentTip, status: "archived" }],
        "2026-11-17",
      ),
    ).toBeNull();
    expect(
      catalogVideoPlaybackAccess({ access_level: "member", isTipOfWeek: true, tipOfWeek: true }),
    ).toBe("member");
    expect(catalogVideoPlaybackAccess({ access_level: "public", isTipOfWeek: false })).toBe("open");
  });

  it("lets the embed API serve the featured tip without membership", () => {
    const marked = markCurrentFeaturedTipForPlayback(catalog, "263") as PublicVideoRow[];
    const tip = resolveCatalogVideoEmbed(marked, "263");
    const previous = resolveCatalogVideoEmbed(marked, "249");
    const member = resolveCatalogVideoEmbed(marked, "257");
    const other = resolveCatalogVideoEmbed(marked, "5005");
    const alreadyPublic = resolveCatalogVideoEmbed(marked, "258");
    expect(tip.ok && tip.access).toBe("open");
    expect(previous.ok && previous.access).toBe("member");
    expect(member.ok && member.access).toBe("member");
    expect(other.ok && other.access).toBe("member");
    expect(alreadyPublic.ok && alreadyPublic.access).toBe("open");
  });
});
