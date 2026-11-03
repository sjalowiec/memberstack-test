import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { FAVORITE_GROUP_ORDER } from "../../lib/favorites/favoriteCatalog";

const panel = readFileSync(resolve("src/components/dashboard/MyFavoritesPanel.astro"), "utf8");
const account = readFileSync(resolve("src/pages/account.astro"), "utf8");
const script = readFileSync(resolve("src/scripts/account-favorites.ts"), "utf8");

describe("combined account favorites accordion", () => {
  it("uses one collapsed My Favorites accordion for every saved content type", () => {
    expect(account).toContain("MyFavoritesPanel");
    expect(account).not.toContain("AccountSavedFavoritesPanel");
    expect(account).not.toContain("account-saved-favorites");
    expect(panel.match(/<h2\b/g)).toHaveLength(2);
    expect(panel).toContain('id="my-favorites-heading"');
    expect(panel).toContain('id="favorites-help-title"');
    expect(panel).toContain('data-kbm-my-favorites-accordion');
    expect(panel).not.toMatch(/<details[^>]*\sopen[\s>]/);
    expect(FAVORITE_GROUP_ORDER.map((group) => group.label)).toEqual([
      "Videos",
      "Stitches",
      "Reference Pages",
      "Help Hub",
      "Tools",
      "Knit-ables",
    ]);
    expect(panel).toContain('href="/videos"');
    expect(panel).toContain('href="/help-hub"');
    expect(panel).toContain('href="/tip-of-the-week"');
    expect(panel).toContain('href="/knit-ables"');
    expect(panel).toContain("data-kbm-my-favorites-group={group.contentType}");
    expect(panel).not.toContain('data-kbm-my-favorites-group="tip-of-the-week"');
  });

  it("records one accordion open and keeps saved-link and removal tracking", () => {
    expect(script.match(/reportContentFavoritesOpen\(/g)).toHaveLength(1);
    expect(script).toContain("event.target !== accordion");
    expect(script).toContain("reportContentFavoriteOpen");
    expect(script).toContain("trackSavedContentFavoriteChange");
    expect(script).toContain("aAt < bAt ? 1");
    expect(script).toContain("Could not remove that favorite. It is still saved.");
    expect(script).toContain("favoriteStarButtonHtml");
    expect(script).toContain("accountHelpHubFavorites");
    expect(script).toContain("settleTipOfTheWeekFavorites");
    const settleAt = script.indexOf("await settleTipOfTheWeekFavorites()");
    const reloadAt = script.indexOf("loadAllFavorites(), catalogPromise");
    expect(settleAt).toBeGreaterThan(-1);
    expect(reloadAt).toBeGreaterThan(settleAt);
  });
});
