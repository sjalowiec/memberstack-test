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
const emailSignupSource = readFileSync(
  join(pageDir, "../components/EmailListSignup.astro"),
  "utf8",
);
const weeklySignupSource = readFileSync(
  join(pageDir, "../components/tip-of-the-week/WeeklyTipSignup.astro"),
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

  it("renders sanitized Try It, Intro, and Sue’s Tip HTML safely", () => {
    expect(pageSource).toContain("sanitizeBillboardHtml");
    expect(pageSource).toContain("billboardMessageHasText");
    expect(pageSource).toContain("set:html={tryCopyHtml}");
    expect(pageSource).toContain("set:html={introHtml}");
    expect(pageSource).toContain("set:html={sueTipHtml}");
    expect(pageSource).toContain('class="totw-section__copy"');
    expect(pageSource).toContain('class="totw-sue__copy"');
    expect(pageSource).toContain('class="totw-lede"');
    expect(pageSource).not.toContain("set:html={tip.sueTipCopy}");
    expect(pageSource).not.toContain("set:html={tip.tryCopy}");
    expect(pageSource).not.toContain("set:html={tip.intro}");
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
    expect(pageSource).toContain("totw-learn-card");
    // Heading lives inside the rounded card, before the bullet list.
    const cardIdx = pageSource.indexOf('class="totw-learn-card kbm-card"');
    const listIdx = pageSource.indexOf('class="totw-learn-list"');
    expect(cardIdx).toBeGreaterThan(-1);
    expect(learnIdx).toBeGreaterThan(cardIdx);
    expect(listIdx).toBeGreaterThan(learnIdx);
    // Single learn section only (no duplicate after reactions).
    expect(pageSource.split('id="totw-learn-heading"').length - 1).toBe(1);
  });

  it("keeps availability beside the TIP OF THE WEEK label in one compact meta row", () => {
    expect(pageSource).toContain('class="totw-meta"');
    expect(pageSource).toContain('class="totw-eyebrow"');
    expect(pageSource).toContain('class="totw-meta__sep"');
    expect(pageSource).toContain("data-tip-available-through={tip.availableThrough}");
    expect(pageSource).toContain("availableThroughDisplay");
    expect(pageSource).toContain("availabilityFooter");
    expect(pageSource).toContain("Free to watch through {availableThroughDisplay}");
    expect(pageSource).not.toContain("totw-availability__badge");
    expect(pageSource).not.toContain("justify-content: space-between");
    expect(pageSource).toMatch(/\.totw-meta\s*\{[^}]*flex-wrap:\s*wrap/);
    expect(pageSource).toMatch(/\.totw-meta\s*\{[^}]*gap:\s*0\.35rem 0\.45rem/);
    const metaIdx = pageSource.indexOf('class="totw-meta"');
    const titleIdx = pageSource.indexOf('class="totw-title"');
    const availabilityIdx = pageSource.indexOf("totw-availability");
    expect(metaIdx).toBeGreaterThan(-1);
    expect(availabilityIdx).toBeGreaterThan(metaIdx);
    expect(titleIdx).toBeGreaterThan(availabilityIdx);
  });

  it("uses normal-weight learn bullets with balanced card padding", () => {
    expect(pageSource).toContain(".totw-learn-list li");
    expect(pageSource).toMatch(/\.totw-learn-list li\s*\{[^}]*font-weight:\s*400/);
    expect(pageSource).toMatch(/\.totw-learn-card__title\s*\{[^}]*font-weight:\s*650/);
    expect(pageSource).toMatch(/\.totw-learn-card\s*\{[^}]*padding:\s*1\.2rem/);
    expect(pageSource).toMatch(/@media \(max-width: 640px\)[\s\S]*?\.totw-learn-card\s*\{[^}]*padding:\s*1rem/);
    expect(pageSource).toMatch(/\.totw-learn-list li\s*\{[^}]*line-height:\s*1\.5/);
  });

  it("widens the page and tightens top spacing locally", () => {
    expect(pageSource).toContain("totw.page-wrap");
    expect(pageSource).toContain("max-width: min(var(--max-content-width, 1100px), 960px)");
    expect(pageSource).toContain("padding-top: 0.75rem");
    expect(pageSource).toContain('bodyClass="page--tight-header"');
  });

  it("resolves Learning Library video 339 from the catalog", () => {
    const video = resolveTipCatalogVideo({ videoContentId: 339 });
    expect(video?.vimeoId).toBe("151857510");
    expect(video?.posterUrl).toContain("vimeocdn.com");
    expect(video?.catalogTitle).toBe("Taming the Curl");
  });

  it("wires Related Help external-link attributes on the public page", () => {
    expect(pageSource).toContain("data-related-type={link.type}");
    expect(pageSource).toContain('target: "_blank"');
    expect(pageSource).toContain('rel: "noopener noreferrer"');
    expect(pageSource).toContain("link.external");
  });

  it("only keeps real related-resource paths in seed/dev JSON", () => {
    for (const link of tipOfTheWeek.relatedLinks) {
      if (link.type === "video") {
        expect(link.videoId).toMatch(/^\d+$/);
        expect(`/videos/${link.videoId}`).not.toContain("example.com");
      } else {
        expect(link.url.startsWith("/") || link.url.startsWith("https://")).toBe(
          true,
        );
        expect(link.url).not.toContain("example.com");
      }
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

describe("Tip of the Week email list signup", () => {
  it("shows compact CTAs and a modal — not the full form in page flow", () => {
    expect(pageSource).toContain("WeeklyTipSignup");
    expect(pageSource).toContain('variant="inline"');
    expect(pageSource).toContain('variant="coming-soon"');
    expect(pageSource).toContain('variant="secondary"');
    expect(pageSource).toContain('variant="modal"');
    expect(pageSource).not.toContain('variant="top"');
    expect(pageSource).not.toMatch(/<EmailListSignup[\s\S]*?<\/EmailListSignup>/);
    expect(weeklySignupSource).toContain("Want next week’s tip?");
    expect(weeklySignupSource).toContain("Get the Weekly Tip");
    expect(weeklySignupSource).toContain("data-weekly-tip-signup-modal");
    expect(weeklySignupSource).toContain("weekly-tip-signup-inline");
    const inlineBlock = weeklySignupSource.match(
      /variant === "inline"[\s\S]*?variant === "coming-soon"/,
    )?.[0];
    expect(inlineBlock).toBeTruthy();
    expect(inlineBlock).not.toContain("Join the email list");
    expect(weeklySignupSource).toContain(
      "Join the email list and I’ll let you know when it’s ready.",
    );
    expect(emailSignupSource).toContain("data-email-list-signup");
    expect(emailSignupSource).not.toContain("Enjoyed this tip?");
  });

  it("places the inline header CTA after availability and before learn/video", () => {
    const metaIdx = pageSource.indexOf('class="totw-meta"');
    const inlineIdx = pageSource.indexOf('variant="inline"');
    const learnIdx = pageSource.indexOf('id="totw-learn-heading"');
    const videoIdx = pageSource.indexOf('class="totw-video"');
    const secondaryIdx = pageSource.indexOf('variant="secondary"');
    const footerIdx = pageSource.indexOf("totw-footer");
    expect(metaIdx).toBeGreaterThan(-1);
    expect(inlineIdx).toBeGreaterThan(metaIdx);
    expect(learnIdx).toBeGreaterThan(inlineIdx);
    expect(videoIdx).toBeGreaterThan(inlineIdx);
    expect(secondaryIdx).toBeGreaterThan(videoIdx);
    expect(footerIdx).toBeGreaterThan(secondaryIdx);
  });

  it("shows the coming-soon invite with explanation and keeps tip content ungated", () => {
    expect(pageSource).toContain("totw--coming-soon");
    expect(pageSource).toContain('data-testid="totw-coming-soon"');
    expect(pageSource.split('variant="coming-soon"').length - 1).toBe(1);
    expect(pageSource.split('variant="inline"').length - 1).toBe(1);
    expect(pageSource.split('variant="modal"').length - 1).toBe(2);
    expect(pageSource).not.toContain("ActiveCampaignForm");
    expect(pageSource).toContain("totw-video");
    expect(pageSource).toContain("TipReactions");
    expect(weeklySignupSource).toContain(".weekly-tip-signup-inline");
    expect(weeklySignupSource).not.toMatch(
      /\.weekly-tip-signup-inline\s*\{[^}]*border:/,
    );
    expect(weeklySignupSource).not.toMatch(
      /\.weekly-tip-signup-inline\s*\{[^}]*background:/,
    );
  });

  it("does not expose ActiveCampaign credentials in page or signup markup", () => {
    expect(pageSource).not.toMatch(/ACTIVECAMPAIGN_API_KEY/);
    expect(pageSource).not.toMatch(/Api-Token/);
    expect(emailSignupSource).not.toMatch(/ACTIVECAMPAIGN/);
    expect(emailSignupSource).not.toMatch(/activehosted\.com/);
    expect(emailSignupSource).not.toMatch(/Api-Token/);
    expect(weeklySignupSource).not.toMatch(/ACTIVECAMPAIGN/);
    expect(weeklySignupSource).not.toMatch(/Api-Token/);
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
