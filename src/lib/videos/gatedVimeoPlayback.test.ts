import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { FREE_ACCESS_MEMBERSHIPS, MEMBERSHIPS } from "../../config/memberships";
import { hasMemberAccess } from "../memberAccess";
import { catalogVideoPlaybackAccess } from "./catalogVideoPlaybackAccess";
import {
  decideGatedVimeoPlayback,
  gatedVimeoEmbedDelivery,
} from "./gatedVimeoEmbedDelivery";
import { resolveCatalogVideoEmbed } from "./resolveCatalogVideoEmbed";
import type { PublicVideoRow } from "../lessonVideo";
import { videoCatalogClientCards } from "./videoCatalogClientCards";

const LEGACY = FREE_ACCESS_MEMBERSHIPS.legacyMembership.memberstackPlanId;
const PAID = MEMBERSHIPS.membership.memberstackPlanId;

function payload(planId: string, status = "ACTIVE") {
  return {
    data: {
      id: "mem_1",
      auth: { email: "test@knititnow.com" },
      planConnections: [{ planId, status }],
    },
  };
}

const memberVideo = {
  content_id: 257,
  access_level: "member",
  vimeoId: "151849234",
  privacyHash: "abc123",
};

const publicVideo = {
  content_id: 258,
  access_level: "public",
  vimeoId: "151849999",
};

describe("catalogVideoPlaybackAccess", () => {
  it("treats public, open, free, and the featured tip as playable without membership", () => {
    expect(catalogVideoPlaybackAccess({ access_level: "public" })).toBe("open");
    expect(catalogVideoPlaybackAccess({ access_level: "open" })).toBe("open");
    expect(catalogVideoPlaybackAccess({ access_level: "free" })).toBe("open");
    expect(
      catalogVideoPlaybackAccess({ access_level: "member", isTipOfWeek: true }),
    ).toBe("open");
  });

  it("treats omitted or member access_level as member-only", () => {
    expect(catalogVideoPlaybackAccess({})).toBe("member");
    expect(catalogVideoPlaybackAccess({ access_level: "member" })).toBe("member");
  });
});

describe("hasMemberAccess for catalog video playback", () => {
  it("denies logged-out viewers", () => {
    expect(hasMemberAccess(null)).toBe(false);
  });

  it("denies expired legacy members", () => {
    expect(
      hasMemberAccess(payload(LEGACY), {
        legacyPaidThroughYmd: "2020-01-01",
        todayYmd: "2026-09-08",
      }),
    ).toBe(false);
  });

  it("grants active legacy members", () => {
    expect(
      hasMemberAccess(payload(LEGACY), {
        legacyPaidThroughYmd: "2026-12-01",
        todayYmd: "2026-09-08",
      }),
    ).toBe(true);
  });

  it("grants active paid members", () => {
    expect(hasMemberAccess(payload(PAID))).toBe(true);
  });
});

describe("gatedVimeoEmbedDelivery", () => {
  it("keeps the Vimeo player off the delivered page for member-only videos", () => {
    const delivery = gatedVimeoEmbedDelivery({
      accessLevel: "member",
      videoId: memberVideo.vimeoId,
      contentId: String(memberVideo.content_id),
      privacyHash: memberVideo.privacyHash,
    });
    expect(delivery.renderIframe).toBe(false);
    expect(delivery.iframeSrcAttr).toBeNull();
    expect(delivery.videoIdAttr).toBeNull();
    expect(delivery.contentIdAttr).toBe("257");
    expect(JSON.stringify(delivery.iframeSrcAttr)).not.toContain("player.vimeo.com");
  });

  it("renders the player on the delivered page for intentionally public videos", () => {
    const delivery = gatedVimeoEmbedDelivery({
      accessLevel: catalogVideoPlaybackAccess(publicVideo),
      videoId: publicVideo.vimeoId,
      contentId: String(publicVideo.content_id),
    });
    expect(delivery.renderIframe).toBe(true);
    expect(delivery.iframeSrcAttr).toContain("player.vimeo.com/video/151849999");
  });
});

describe("decideGatedVimeoPlayback", () => {
  it("does not unlock a member video before membership is resolved", () => {
    expect(
      decideGatedVimeoPlayback({
        accessLevel: "member",
        videoDevBypass: false,
        membershipResolved: false,
        hasMemberAccess: false,
        isLoggedIn: false,
        embedSrc: "https://player.vimeo.com/video/1",
      }),
    ).toEqual({ action: "wait" });
  });

  it("locks logged-out and expired-legacy viewers without an embed URL", () => {
    expect(
      decideGatedVimeoPlayback({
        accessLevel: "member",
        videoDevBypass: false,
        membershipResolved: true,
        hasMemberAccess: false,
        isLoggedIn: false,
        embedSrc: null,
      }),
    ).toEqual({ action: "lock", showLogin: true });
    expect(
      decideGatedVimeoPlayback({
        accessLevel: "member",
        videoDevBypass: false,
        membershipResolved: true,
        hasMemberAccess: false,
        isLoggedIn: true,
        embedSrc: "https://player.vimeo.com/video/1",
      }),
    ).toEqual({ action: "lock", showLogin: false });
  });

  it("unlocks only after confirmed access and an embed URL", () => {
    const src = "https://player.vimeo.com/video/151849234";
    expect(
      decideGatedVimeoPlayback({
        accessLevel: "member",
        videoDevBypass: false,
        membershipResolved: true,
        hasMemberAccess: true,
        isLoggedIn: true,
        embedSrc: src,
      }),
    ).toEqual({ action: "unlock", iframeSrc: src });
    expect(
      decideGatedVimeoPlayback({
        accessLevel: "member",
        videoDevBypass: false,
        membershipResolved: true,
        hasMemberAccess: true,
        isLoggedIn: true,
        embedSrc: null,
      }),
    ).toEqual({ action: "lock", showLogin: false });
  });

  it("unlocks intentionally public videos without membership", () => {
    const src = "https://player.vimeo.com/video/151849999";
    expect(
      decideGatedVimeoPlayback({
        accessLevel: "open",
        videoDevBypass: false,
        membershipResolved: false,
        hasMemberAccess: false,
        isLoggedIn: false,
        embedSrc: src,
      }),
    ).toEqual({ action: "unlock", iframeSrc: src });
  });
});

describe("resolveCatalogVideoEmbed", () => {
  const catalog: PublicVideoRow[] = [
    {
      content_id: 257,
      title: "Member video",
      access_level: "member",
      vimeo_id: 151849234,
      vimeo_hash: "abc123",
      status: "published",
    },
    {
      content_id: 258,
      title: "Public video",
      access_level: "public",
      vimeo_id: 151849999,
      status: "published",
    },
  ];

  it("returns member access without leaking that as a public embed decision", () => {
    const resolved = resolveCatalogVideoEmbed(catalog, "257");
    expect(resolved.ok).toBe(true);
    if (resolved.ok) {
      expect(resolved.access).toBe("member");
      expect(resolved.iframeSrc).toContain("player.vimeo.com/video/151849234");
      expect(resolved.iframeSrc).toContain("h=abc123");
    }
  });

  it("marks public catalog rows as open", () => {
    const resolved = resolveCatalogVideoEmbed(catalog, "258");
    expect(resolved.ok).toBe(true);
    if (resolved.ok) expect(resolved.access).toBe("open");
  });
});

describe("video catalog client cards", () => {
  it("omits Vimeo player ids and hashes from the public catalog payload", () => {
    const cards = videoCatalogClientCards([
      {
        content_id: 257,
        title: "Kitchener",
        access_level: "member",
        posterUrl: "/p.jpg",
        vimeo_id: 151849234,
        vimeo_hash: "abc123",
      } as never,
    ]);
    expect(JSON.stringify(cards)).not.toContain("151849234");
    expect(JSON.stringify(cards)).not.toContain("abc123");
    expect(JSON.stringify(cards)).not.toContain("player.vimeo.com");
    expect(cards[0]?.title).toBe("Kitchener");
  });
});

describe("video page wiring", () => {
  it("does not put a Vimeo iframe on member-only GatedVimeoEmbed markup", () => {
    const embed = readFileSync(
      join(process.cwd(), "src", "components", "videos", "GatedVimeoEmbed.astro"),
      "utf8",
    );
    expect(embed).toContain("gatedVimeoEmbedDelivery");
    expect(embed).toContain("delivery.renderIframe");
    expect(embed).not.toContain("data-iframe-src={iframeSrc}");
  });

  it("passes catalog contentId into the gated embed on /videos/[id]", () => {
    const page = readFileSync(join(process.cwd(), "src", "pages", "videos", "[id].astro"), "utf8");
    expect(page).toContain("contentId={id}");
    expect(page).toContain("catalogVideoPlaybackAccess");
  });
});
