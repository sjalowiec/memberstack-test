import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import tipConfig from "../data/tip-of-the-week.json";
import { resolveTipCatalogVideo, tipOfTheWeek } from "../lib/tipOfTheWeek";
import { TIP_REACTIONS } from "../lib/tipOfTheWeekReactions";
import { formatTipAvailabilityDate } from "../lib/tipOfTheWeek/map";

const pageDir = dirname(fileURLToPath(import.meta.url));
const pageSource = readFileSync(join(pageDir, "tip-of-the-week.astro"), "utf8");
const reactionsSource = readFileSync(
  join(pageDir, "../components/tip-of-the-week/TipReactions.astro"),
  "utf8",
);
const watsonPage = readFileSync(
  join(pageDir, "watson/tip-of-the-week.astro"),
  "utf8",
);
const watsonShell = readFileSync(
  join(pageDir, "../components/watson/WatsonPageShell.astro"),
  "utf8",
);
const headerSource = readFileSync(
  join(pageDir, "../components/Header.astro"),
  "utf8",
);

describe("Tip of the Week page route", () => {
  it("defines the permanent /tip-of-the-week page with runtime Watson loading", () => {
    expect(pageSource).toContain('export const prerender = false');
    expect(pageSource).toContain("loadPublicTipOfTheWeekPage");
    expect(pageSource).toContain("data-tip-of-the-week");
    expect(pageSource).toContain("totw--coming-soon");
    expect(pageSource).toContain("The next Tip of the Week is coming soon");
  });

  it("renders required Tip of the Week sections when featured", () => {
    expect(pageSource).toContain("totw-intro");
    expect(pageSource).toContain("totw-video");
    expect(pageSource).toContain("TipReactions");
    expect(pageSource).toContain("totw-learn-heading");
    expect(pageSource).toContain("totw-try-heading");
    expect(pageSource).toContain("totw-sue-heading");
    expect(pageSource).toContain("totw-related-heading");
    expect(pageSource).toContain("totw-footer");
  });

  it("places What You’ll Learn above the featured video", () => {
    const learnIdx = pageSource.indexOf('id="totw-learn-heading"');
    const videoIdx = pageSource.indexOf('class="totw-video"');
    const reactionsIdx = pageSource.indexOf("<TipReactions");
    const tryIdx = pageSource.indexOf('id="totw-try-heading"');
    expect(learnIdx).toBeGreaterThan(-1);
    expect(videoIdx).toBeGreaterThan(learnIdx);
    expect(reactionsIdx).toBeGreaterThan(videoIdx);
    expect(tryIdx).toBeGreaterThan(reactionsIdx);
    expect(pageSource).toContain("totw-section--learn");
    // Single learn section only (no duplicate after reactions).
    expect(pageSource.split('id="totw-learn-heading"').length - 1).toBe(1);
  });

  it("widens the page and tightens top spacing locally", () => {
    expect(pageSource).toContain("totw.page-wrap");
    expect(pageSource).toContain("max-width: min(var(--max-content-width, 1100px), 960px)");
    expect(pageSource).toContain("padding-top: 0.75rem");
    expect(pageSource).toContain('bodyClass="page--tight-header"');
  });

  it("keeps availability dates on one shared tip.availableThrough value", () => {
    expect(pageSource).toContain("data-tip-available-through={tip.availableThrough}");
    expect(pageSource).toContain("availableThroughDisplay");
    expect(pageSource).toContain("availabilityFooter");
    expect(pageSource).not.toMatch(/Available through August/);
  });

  it("resolves Learning Library video 339 from the catalog", () => {
    const video = resolveTipCatalogVideo({ videoContentId: 339 });
    expect(video?.vimeoId).toBe("151857510");
    expect(video?.posterUrl).toContain("vimeocdn.com");
    expect(video?.catalogTitle).toBe("Taming the Curl");
  });

  it("only keeps real related-resource paths in seed/dev JSON", () => {
    for (const link of tipOfTheWeek.relatedLinks) {
      expect(link.href.startsWith("/")).toBe(true);
      expect(link.href).not.toContain("example.com");
    }
    expect(tipConfig.availableThrough).toBe("2026-08-14");
    expect(tipConfig.availableFrom).toBe("2026-08-08");
    expect(formatTipAvailabilityDate("2026-08-14")).toBe("August 14, 2026");
  });

  it("supports Watson-authenticated preview of draft/scheduled tips", () => {
    expect(pageSource).toContain("loadTipOfTheWeekPreview");
    expect(pageSource).toContain("isWatsonSessionAuthenticated");
    expect(pageSource).toContain('searchParams.get("preview")');
    expect(pageSource).toContain("totw-preview-banner");
    expect(pageSource).toContain("Watson preview");
    expect(watsonPage).toContain("/tip-of-the-week?preview=");
  });

  it("wires accessible video trigger props when a catalog video is found", () => {
    expect(pageSource).toContain("kbm-kin-catalog-video");
    expect(pageSource).toContain("data-vimeo-id={video.vimeoId}");
    expect(pageSource).toContain('data-testid="totw-video-trigger"');
  });

  it("shows the decorative Tip of the Week lightbulb beside the intro heading", () => {
    expect(pageSource).toContain('src="/images/tow_lightbulb.svg"');
    expect(pageSource).toContain('data-totw-intro-layout');
    expect(pageSource).toContain("totw-intro__layout");
    expect(pageSource).toContain("totw-intro__icon");
    expect(pageSource).toContain("totw-intro__copy");
    expect(pageSource).toMatch(
      /src="\/images\/tow_lightbulb\.svg"[\s\S]*?alt=""[\s\S]*?aria-hidden="true"/,
    );
    expect(pageSource).toContain("@media (max-width: 480px)");
  });
});

describe("Tip of the Week reactions", () => {
  it("keeps the will_try key and uses the smiling-face emoji", () => {
    const willTry = TIP_REACTIONS.find((r) => r.id === "will_try");
    expect(willTry?.id).toBe("will_try");
    expect(willTry?.emoji).toBe("🙂");
    expect(willTry?.emoji).not.toBe("🧶");
    expect(willTry?.label).toContain("going to try it");
  });

  it("keeps reaction markup accessible and wired", () => {
    expect(reactionsSource).toContain("Was this tip helpful?");
    expect(reactionsSource).toContain("TIP_REACTIONS.map");
    expect(reactionsSource).toContain("selectTipReaction");
    expect(reactionsSource).toContain("hydrateTipReactions");
  });
});

describe("Tip of the Week navigation", () => {
  it("includes public Help dropdown and Watson manager links", () => {
    expect(headerSource).toContain('href="/tip-of-the-week"');
    expect(headerSource).toContain('data-testid="nav-tip-of-the-week"');
    expect(watsonShell).toContain('href="/watson/tip-of-the-week"');
    expect(watsonShell).toContain("Tip of the Week");
  });
});

describe("Watson Tip of the Week manager", () => {
  it("is a server-rendered Watson page with form and lists", () => {
    expect(watsonPage).toContain('export const prerender = false');
    expect(watsonPage).toContain("WatsonPageShell");
    expect(watsonPage).toContain("listAllTipOfTheWeek");
    expect(watsonPage).toContain("data-totw-form");
    expect(watsonPage).toContain("What You’ll Learn");
    expect(watsonPage).toContain("Reaction totals");
    expect(watsonPage).toContain("initWatsonTipOfTheWeek");
    expect(watsonPage).toContain("America/Los_Angeles");
  });
});
