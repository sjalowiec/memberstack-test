import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const indexSource = readFileSync(join(here, "index.astro"), "utf8");
const slugSource = readFileSync(join(here, "[slug].astro"), "utf8");
const previewSource = readFileSync(join(here, "preview.astro"), "utf8");

describe("Help Hub public SSR", () => {
  it("server-renders the index from published database content", () => {
    expect(indexSource).toContain("export const prerender = false");
    expect(indexSource).toContain("loadPublicHelpHubTips");
    expect(indexSource).not.toMatch(/from ["'].*help-hub\.json["']/);
  });

  it("groups published entries into catalog categories and omits hardcoded filler cards", () => {
    expect(indexSource).toContain("helpHubIndexCategorySections");
    expect(indexSource).toContain("helpHubIndexNewCards");
    expect(indexSource).toContain("loadPublicHelpHubCategories");
    expect(indexSource).toContain("New in the Help Hub");
    expect(indexSource).not.toContain("fixCategories");
    expect(indexSource).not.toContain("Stuck Carriage Rescue");
    expect(indexSource).not.toContain("The Gravity Check");
    expect(indexSource).not.toContain("fix-bubble--inactive");
  });

  it("omits the Start here eyebrow and keeps the New in the Help Hub section", () => {
    expect(indexSource).toContain("New in the Help Hub");
    expect(indexSource).toContain("helpHubIndexNewCards");
    expect(indexSource).not.toMatch(/start here/i);
    expect(indexSource).not.toContain("help-hub-orientation-label");
  });

  it("renders catalog questions as closed accordion rows with favorite stars", () => {
    expect(indexSource).toContain("<strong>{item.heading}</strong>");
    expect(indexSource).toContain("<strong>{card.heading}</strong>");
    expect(indexSource).not.toContain("item.subtitle");
    expect(indexSource).not.toContain("card.subtitle");
    expect(indexSource).toContain("help-hub-question-row");
    expect(indexSource).toContain("help-hub-question-summary");
    expect(indexSource).toContain("fix-category-summary");
    expect(indexSource).toContain("helpHubFavoriteContentId(item.slug)");
    expect(indexSource).toContain("helpHubFavoriteContentId(card.slug)");
    expect(indexSource).toContain('class="fix-category-section fix-category-section--new"');
    expect(indexSource).toContain("data-help-hub-new");
    expect(indexSource).not.toContain("bubble-question");
    expect(indexSource).not.toContain("fix-bubble-grid");
    const detailsTags = indexSource.match(/<details[\s\S]*?>/g) ?? [];
    expect(detailsTags.length).toBeGreaterThan(0);
    for (const tag of detailsTags) {
      expect(tag).not.toMatch(/\sopen(?:\s|=|>)/);
    }
  });

  it("searches Help Hub content in place and expands answers without leaving the page", () => {
    expect(indexSource).toContain('for="help-hub-search-input"');
    expect(indexSource).toContain("Search the Help Hub");
    expect(indexSource).toContain("Search for a problem, technique, or machine...");
    expect(indexSource).toContain("helpHubTipSearchText");
    expect(indexSource).toContain("initHelpHubIndex");
    expect(indexSource).toContain("data-help-hub-category");
    expect(indexSource).toContain("data-help-hub-answer");
    expect(indexSource).toContain("No Help Hub answer yet.");
    expect(indexSource).toContain("data-help-hub-open-site-search");
    expect(indexSource).toContain("HelpHubTipContent");
    expect(indexSource).toContain("deferMedia");
    expect(indexSource).toContain("data-pagefind-ignore");
    expect(indexSource).not.toContain("/pagefind/");
    expect(indexSource).not.toContain("pagefind.js");
    expect(indexSource).toContain("href={`/help-hub/${item.slug}`}");
    expect(indexSource).toContain("href={`/help-hub/${card.slug}`}");
    expect(indexSource).toContain("data-help-hub-browse");
    expect(indexSource).toContain("data-help-hub-article-panel");
    expect(indexSource).toContain("Back to Help Hub questions");
    expect(indexSource).toContain("data-help-hub-article-title");
  });

  it("shows one published question and quick answer below search and above New in the Help Hub", () => {
    expect(indexSource).toContain("helpHubDiscoveryEntries");
    expect(indexSource).toContain("data-help-hub-discovery");
    expect(indexSource).toContain("Featured Help Hub");
    expect(indexSource).toContain("help-hub-discovery__eyebrow");
    expect(indexSource).toContain("Read full answer →");
    expect(indexSource).toContain("help-hub-discovery__question-line");
    expect(indexSource).not.toContain("kbm-btn-primary help-hub-discovery__explore");
    expect(indexSource).toContain("kbm-btn kbm-btn-outline help-hub-discovery__surprise");
    expect(indexSource).toContain("font-size: 16px");
    expect(indexSource).toContain("min-height: 44px");
    expect(indexSource).not.toContain("Read more");
    expect(indexSource).not.toContain("Explore this topic");
    expect(indexSource).toContain("border-right: 16px solid #52682d");
    expect(indexSource).toContain("border-left: 16px solid color-mix");
    expect(indexSource).toContain(".fix-category-summary::before");
    expect(indexSource).toContain("content: none;");
    expect(indexSource).not.toContain("border-right: 11px solid #52682d");
    expect(indexSource).toContain("data-help-hub-discovery-explore");
    expect(indexSource).toContain('target="_self"');
    expect(indexSource).not.toContain('target="_blank"');
    expect(indexSource).toContain("initHelpHubLandingReturn");
    expect(indexSource).toContain("<FavoriteStar");
    expect(indexSource).toContain("actionTooltip");
    expect(indexSource).not.toContain("Save to Favorites");
    expect(indexSource).toContain("Surprise Me");
    expect(indexSource).toContain("fa-solid fa-shuffle");
    expect(indexSource).toContain('data-tooltip="Show another random question"');
    expect(indexSource).toContain('class="fa-solid fa-shuffle help-hub-discovery__surprise-icon" aria-hidden="true"');
    expect(indexSource).toContain("data-help-hub-discovery-question");
    expect(indexSource).toContain("data-help-hub-discovery-answer-text");
    expect(indexSource).toContain('contentType="reference"');
    expect(indexSource.indexOf('id="help-hub-search-input"')).toBeLessThan(
      indexSource.indexOf("data-help-hub-discovery"),
    );
    expect(indexSource.indexOf("data-help-hub-discovery")).toBeLessThan(
      indexSource.indexOf('id="help-hub-new-heading"'),
    );
    expect(indexSource.indexOf('id="help-hub-new-heading"')).toBeLessThan(
      indexSource.indexOf('id="help-hub-favorites-heading"'),
    );
    expect(indexSource).toContain("<strong>{item.heading}</strong>");
    expect(indexSource).toContain("<strong>{card.heading}</strong>");
  });

  it("links every published tip in the initial HTML, outside the closed accordions", () => {
    expect(indexSource).toContain("helpHubPublishedPermalinks");
    expect(indexSource).toContain('aria-label="All Help Hub answers"');
    expect(indexSource).toContain("data-help-hub-permalinks");
    expect(indexSource).toContain("help-hub-question-permalink");
    expect(indexSource).toContain("href={`/help-hub/${link.slug}`}");
    const navAt = indexSource.indexOf('data-help-hub-permalinks');
    const listAt = indexSource.indexOf('class="fix-category-list"');
    expect(navAt).toBeGreaterThan(-1);
    expect(listAt).toBeGreaterThan(navAt);
    expect(indexSource.slice(navAt, listAt)).not.toContain("<details");
    const newSummary = indexSource.slice(
      indexSource.indexOf("newHelpHubItems.map"),
      indexSource.indexOf("help-hub-inline-answer"),
    );
    expect(newSummary).toContain("href={`/help-hub/${item.slug}`}");
    expect(newSummary).toContain("<summary");
  });

  it("adds My Favorites after New and marks New with the existing logo", () => {
    expect(indexSource).toContain('src="/images/logos/kin_logo.svg"');
    expect(indexSource).toContain('class="help-hub-accordion-icon"');
    expect(indexSource).toContain('aria-hidden="true"');
    expect(indexSource).toContain("My Favorites");
    expect(indexSource).toContain("data-help-hub-favorites");
    expect(indexSource).toContain("fa-solid fa-star help-hub-accordion-icon");
    expect(indexSource).toContain("HELP_HUB_FAVORITES_EMPTY_MESSAGE");
    expect(indexSource).toContain("Sign in to see your saved Help Hub tips.");
    expect(indexSource).toContain("data-help-hub-favorites-login");
    expect(indexSource).toContain("initHelpHubFavorites");
    expect(indexSource).not.toContain('href="/account"');
    expect(indexSource.indexOf('id="help-hub-new-heading"')).toBeLessThan(
      indexSource.indexOf('id="help-hub-favorites-heading"'),
    );
    expect(indexSource.indexOf('id="help-hub-favorites-heading"')).toBeLessThan(
      indexSource.indexOf("categorySections.map"),
    );
  });

  it("omits the catalog-only Work with Sue promotion without removing the help form", () => {
    expect(indexSource).not.toContain("/help-hub/work-with-sue");
    expect(indexSource).not.toContain("If you’re in a hurry or you want a 1-on-1 fix");
    expect(indexSource).not.toContain("for more personal support");
    expect(indexSource).not.toContain("help-hub-cta");
    expect(indexSource).toContain("help-hub-question-form");
    expect(indexSource).toContain("Not finding your answer?");
  });

  it("puts the shared favorite star beside the article title and restores the landing visit", () => {
    const tipPageSource = readFileSync(
      join(here, "..", "..", "components", "help-hub", "HelpHubTipPage.astro"),
      "utf8",
    );
    const tipContentSource = readFileSync(
      join(here, "..", "..", "components", "help-hub", "HelpHubTipContent.astro"),
      "utf8",
    );
    expect(tipPageSource).toContain('PageBackLink href="/help-hub" text="Back to Help Hub"');
    expect(tipPageSource).toContain("FavoritesRuntime");
    expect(tipPageSource).toContain("initHelpHubArticleReturn");
    expect(tipPageSource).toContain("data-help-hub-article-slug");
    expect(tipContentSource).toContain("help-hub-article-question");
    expect(tipContentSource).toContain("helpHubFavoriteContentId");
    const titleAt = tipContentSource.indexOf("help-hub-article-question");
    const hookAt = tipContentSource.indexOf("tuesday-tip-hero__hook");
    expect(titleAt).toBeGreaterThan(-1);
    expect(hookAt).toBeGreaterThan(titleAt);
    expect(tipContentSource).not.toContain('target="_blank"');
    const questionBlock = tipContentSource.slice(
      tipContentSource.indexOf("!embedded && (tip.question || tip.title)"),
      tipContentSource.indexOf("tip.bubbleAnswer"),
    );
    expect(questionBlock).toContain("<FavoriteStar");
    expect(questionBlock).toContain('contentType="reference"');
  });

  it("404s unpublished slugs and uses the shared tip renderer", () => {
    expect(slugSource).toContain("export const prerender = false");
    expect(slugSource).toContain("publicOnly: true");
    expect(slugSource).toContain("HelpHubTipPage");
    expect(slugSource).not.toMatch(/from ["'].*help-hub\.json["']/);
  });

  it("renders authenticated preview with the same HelpHubTipPage implementation", () => {
    expect(previewSource).toContain("requireAdminForRequest");
    expect(previewSource).toContain("HelpHubTipPage");
    expect(previewSource).toContain("preview={true}");
    expect(previewSource).toContain("resolveHelpHubPreviewTip");
    expect(previewSource).not.toContain("saveExistingHelpHubTip");
  });
});

describe("Help Hub related lessons public section", () => {
  it("hides the Related Lessons section when none resolve as published", () => {
    const tipPageSource = readFileSync(
      join(here, "..", "..", "components", "help-hub", "HelpHubTipContent.astro"),
      "utf8",
    );
    expect(tipPageSource).toContain("memberResourceCards.length > 0");
    expect(tipPageSource).not.toContain("No lessons linked to this tip yet.");
    expect(tipPageSource).not.toContain("loadPublicLessons");
    expect(tipPageSource).not.toMatch(/from ["'].*lessons\.json["']/);
    expect(slugSource).toContain("loadPublicLessons");
    expect(previewSource).toContain("loadPublicLessons");
  });
});

describe("Help Hub empty media", () => {
  it("does not render the empty media placeholder on preview or published pages", () => {
    const tipPageSource = readFileSync(
      join(here, "..", "..", "components", "help-hub", "HelpHubTipContent.astro"),
      "utf8",
    );
    expect(tipPageSource).toContain("hasHeroMedia");
    expect(tipPageSource).toContain("tuesday-tip-hero__columns--no-media");
    expect(tipPageSource).not.toContain("Media will appear here");
  });

  it("renders a related tool after Try This in the same tab when both fields exist", () => {
    const tipPageSource = readFileSync(
      join(here, "..", "..", "components", "help-hub", "HelpHubTipContent.astro"),
      "utf8",
    );
    const relatedToolSource = readFileSync(
      join(here, "..", "..", "components", "help-hub", "HelpHubRelatedTool.astro"),
      "utf8",
    );
    expect(tipPageSource.indexOf("<HelpHubRelatedTool")).toBeGreaterThan(
      tipPageSource.indexOf("hasTrySection"),
    );
    expect(relatedToolSource).toContain("help-hub-related-tool");
    expect(relatedToolSource).toContain("help-hub-related-tool__eyebrow");
    expect(relatedToolSource).toContain("help-hub-related-tool__title");
    expect(relatedToolSource).toContain("help-hub-related-tool__note");
    expect(relatedToolSource).toContain("href={relatedTool.href}");
    expect(relatedToolSource).toContain("Member Tool");
    expect(relatedToolSource).toContain("relatedTool.memberOnly");
    expect(relatedToolSource).not.toContain('target="_blank"');
  });
});
