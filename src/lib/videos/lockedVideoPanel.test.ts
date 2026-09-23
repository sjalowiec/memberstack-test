import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { decideGatedVimeoPlayback } from "./gatedVimeoEmbedDelivery";
import { lockedVideoPanelHtml, permittedCatalogThumbnailUrl } from "./lockedVideoPanel";

const CATALOG_POSTER =
  "https://i.vimeocdn.com/video/551700589-f92f33b7008c3b51c5a0e3258ff683d6870e9ab06d38ef26d33d7fb13fd99926-d_1280x720?r=pad";
const PLAYER = "https://player.vimeo.com/video/151857129?h=secret";

describe("denied video thumbnail panel", () => {
  it("gives denied visitors the catalog thumbnail and no protected player data", () => {
    const html = lockedVideoPanelHtml({
      thumbUrl: CATALOG_POSTER,
      showLogin: true,
      ctaHref: "/membership",
      ctaText: "Become a Member",
    });

    expect(permittedCatalogThumbnailUrl(CATALOG_POSTER)).toBe(CATALOG_POSTER);
    expect(html).toContain(`src="${CATALOG_POSTER}"`);
    expect(html).toContain("kbm-video__thumb");
    expect(html).toContain("kbm-video__locked--thumb");
    expect(html).toContain("Members only");
    expect(html).toContain("This video is available with membership.");
    expect(html).toContain('href="/membership"');
    expect(html).toContain("Become a Member");
    expect(html).toContain("Already a member? Log in");
    expect(html).not.toContain("player.vimeo.com");
    expect(html).not.toContain("<iframe");
    expect(html).not.toContain("151857129");
    expect(html).not.toContain("Begin by casting on");
    expect(html).not.toContain("Jump to");
    expect(html).not.toContain("Helecopter trim");
  });

  it("still unlocks the working player after access is confirmed", () => {
    const decision = decideGatedVimeoPlayback({
      accessLevel: "member",
      videoDevBypass: false,
      membershipResolved: true,
      hasMemberAccess: true,
      isLoggedIn: true,
      embedSrc: PLAYER,
    });
    expect(decision).toEqual({ action: "unlock", iframeSrc: PLAYER });

    const client = readFileSync(
      join(process.cwd(), "src", "scripts", "gatedVimeoEmbedClient.ts"),
      "utf8",
    );
    expect(client).toContain("showUnlockedIframe(decision.iframeSrc)");
    expect(client).toContain("<iframe");
    expect(client).not.toContain("kbm-video__thumb");
  });

  it("keeps the neutral panel when a catalog thumbnail is missing or not permitted", () => {
    const rejected = [
      "",
      "   ",
      "poster.jpg",
      "javascript:alert(1)",
      PLAYER,
      "//i.vimeocdn.com/video/poster.jpg",
      `${CATALOG_POSTER}" onerror="alert(1)`,
    ];
    for (const thumbUrl of rejected) {
      const html = lockedVideoPanelHtml({
        thumbUrl,
        showLogin: true,
        ctaHref: "/membership",
        ctaText: "Become a Member",
      });
      expect(permittedCatalogThumbnailUrl(thumbUrl)).toBe("");
      expect(html).not.toContain("<img");
      expect(html).not.toContain("kbm-video__locked--thumb");
      expect(html).toContain('class="kbm-video__locked"');
      expect(html).toContain("Members only");
      expect(html).toContain("This video is available with membership.");
      expect(html).not.toContain("player.vimeo.com");
    }

    const local = lockedVideoPanelHtml({
      thumbUrl: "/images/catalog-poster.jpg",
      showLogin: false,
      ctaHref: "/membership",
      ctaText: "Become a Member",
    });
    expect(local).toContain('src="/images/catalog-poster.jpg"');
    expect(local).not.toContain("Already a member? Log in");
  });

  it("leaves transcript and jump-link gating in place on the video page", () => {
    const page = readFileSync(join(process.cwd(), "src", "pages", "videos", "[id].astro"), "utf8");
    const embed = readFileSync(
      join(process.cwd(), "src", "components", "videos", "GatedVimeoEmbed.astro"),
      "utf8",
    );

    expect(page).toContain("thumbUrl={posterSrc}");
    expect(page).toContain("posterUrl");
    expect(page).toContain("hydrateGatedTranscript");
    expect(page).toContain("hydrateGatedJumpLinks");
    expect(page).toContain('data-transcript-source="gated"');
    expect(page).toContain("hidden={isOpenPlayback ? undefined : true}");
    expect(page).toContain('id="jumplinks"></div>');
    expect(page).not.toContain("generated/member");
    expect(page).not.toContain("Jump links are available with access");

    expect(embed).toContain("lockedVideoPanelHtml");
    expect(embed).toContain("delivery.renderIframe");
    expect(embed).toContain("object-fit:cover");
    expect(embed).toContain("kbm-video__locked--thumb");
    expect(embed).toContain("min-height:44px");
    expect(embed).not.toContain("player.vimeo.com");
  });
});
