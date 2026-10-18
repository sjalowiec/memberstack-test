import { describe, expect, it } from "vitest";
import {
  acknowledgeHelpHubArticleVisit,
  consumeHelpHubArticleBack,
  createHelpHubLandingReturn,
  createHelpHubLandingSnapshot,
  isPlainHelpHubReadMoreClick,
  landingSnapshotToRestore,
  parseHelpHubLandingReturn,
  serializeHelpHubLandingReturn,
} from "./landingReturn";

function storedFor(slug: string) {
  const snapshot = createHelpHubLandingSnapshot({
    slug,
    seenSlugs: ["newest-tip", slug],
    search: "sponge",
    openNew: false,
    openFavorites: true,
    openCategories: ["getting-started"],
    scrollY: 640,
  });
  if (!snapshot) throw new Error("snapshot");
  return createHelpHubLandingReturn(snapshot);
}

describe("Help Hub landing return", () => {
  it("treats a primary Read more click as same-tab navigation", () => {
    expect(isPlainHelpHubReadMoreClick({ button: 0 })).toBe(true);
    expect(isPlainHelpHubReadMoreClick({ button: 1 })).toBe(false);
    expect(isPlainHelpHubReadMoreClick({ button: 0, metaKey: true })).toBe(false);
    expect(isPlainHelpHubReadMoreClick({ button: 0, ctrlKey: true })).toBe(false);
    expect(isPlainHelpHubReadMoreClick({ button: 0, shiftKey: true })).toBe(false);
  });

  it("keeps the discovery tip, search, open categories, and scroll", () => {
    const stored = storedFor("carriage-sticking");
    expect(stored.snapshot).toMatchObject({
      slug: "carriage-sticking",
      search: "sponge",
      openNew: false,
      openFavorites: true,
      openCategories: ["getting-started"],
      scrollY: 640,
    });
    expect(stored.snapshot.seenSlugs).toEqual(["carriage-sticking", "newest-tip"]);
    expect(stored.armed).toBe(true);
    expect(stored.returnSlug).toBeNull();
    expect(stored.consume).toBe(false);
    expect(parseHelpHubLandingReturn(serializeHelpHubLandingReturn(stored))).toEqual(stored);
  });

  it("treats a saved visit from before My Favorites as that accordion closed", () => {
    const stored = storedFor("carriage-sticking");
    const raw = JSON.parse(serializeHelpHubLandingReturn(stored)) as {
      snapshot: { openFavorites?: boolean };
    };
    delete raw.snapshot.openFavorites;
    expect(parseHelpHubLandingReturn(JSON.stringify(raw))?.snapshot.openFavorites).toBe(false);
  });

  it("lets browser Back and the article Back link restore that visit", () => {
    const opened = acknowledgeHelpHubArticleVisit(
      storedFor("carriage-sticking"),
      "carriage-sticking",
      "navigate",
    );
    expect(opened?.returnSlug).toBe("carriage-sticking");
    expect(opened?.armed).toBe(false);

    expect(
      landingSnapshotToRestore({ stored: opened, navigationType: "back_forward" })?.slug,
    ).toBe("carriage-sticking");

    const consumed = consumeHelpHubArticleBack(opened, "carriage-sticking");
    expect(consumed?.consume).toBe(true);
    expect(
      landingSnapshotToRestore({ stored: consumed, navigationType: "navigate" })?.search,
    ).toBe("sponge");
  });

  it("opens the landing page normally for a direct article visit", () => {
    const direct = acknowledgeHelpHubArticleVisit(storedFor("carriage-sticking"), "carriage-sticking", "navigate");
    const laterDirect = acknowledgeHelpHubArticleVisit(direct, "another-tip", "navigate");
    expect(laterDirect?.returnSlug).toBeNull();
    expect(laterDirect?.consume).toBe(false);
    expect(consumeHelpHubArticleBack(laterDirect, "another-tip")).toBeNull();
    expect(
      landingSnapshotToRestore({ stored: laterDirect, navigationType: "navigate" }),
    ).toBeNull();
  });

  it("does not restore a normal landing visit that did not ask to return", () => {
    const stored = storedFor("carriage-sticking");
    expect(landingSnapshotToRestore({ stored, navigationType: "navigate" })).toBeNull();
    expect(landingSnapshotToRestore({ stored, navigationType: "reload" })).toBeNull();
    expect(acknowledgeHelpHubArticleVisit(stored, "carriage-sticking", "reload")).toBe(stored);
  });
});
