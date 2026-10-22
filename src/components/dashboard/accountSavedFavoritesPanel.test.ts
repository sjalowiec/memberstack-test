import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const panel = readFileSync(
  resolve("src/components/dashboard/AccountSavedFavoritesPanel.astro"),
  "utf8",
);
const account = readFileSync(resolve("src/pages/account.astro"), "utf8");
const script = readFileSync(resolve("src/scripts/account-saved-favorites.ts"), "utf8");

describe("account saved favorites accordion", () => {
  it("adds one collapsed My Favorites accordion without replacing the existing panel", () => {
    expect(panel).toContain("<details");
    expect(panel).not.toContain(" open");
    expect(panel).toContain("My Favorites");
    expect(account).toContain("AccountSavedFavoritesPanel");
    expect(account).toContain("MyFavoritesPanel");
    expect(account.indexOf("AccountSavedFavoritesPanel")).toBeGreaterThan(
      account.indexOf("AccountPurchaseHistoryPanel"),
    );
    expect(script).toContain("Tips of the Week");
    expect(script).toContain("Knit-ables");
    expect(panel).toContain('href="/tip-of-the-week"');
    expect(panel).toContain('href="/knit-ables"');
    expect(script).toContain("createdAt < b.createdAt");
    expect(script).toContain("Could not remove that favorite. It is still saved.");
  });
});
