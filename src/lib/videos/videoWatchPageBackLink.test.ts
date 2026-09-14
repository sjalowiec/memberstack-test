import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  bindVideosWatchPageBackLinks,
  handleVideosWatchBackLinkClick,
  isVideosCatalogPath,
  isVideosCatalogReferrer,
  shouldUseVideosCatalogHistoryBack,
  videosCatalogHrefFromWatchSearch,
  videosWatchBackLabelSuffix,
  videosWatchBackLinkText,
  type VideosWatchBackLinkElement,
} from "./videoWatchPageBackLink";

const ORIGIN = "https://knititnow.com";
const pageSource = readFileSync(
  join(process.cwd(), "src", "pages", "videos", "[id].astro"),
  "utf8",
);

function clickEvent(
  overrides: Partial<{
    metaKey: boolean;
    ctrlKey: boolean;
    shiftKey: boolean;
    altKey: boolean;
    button: number;
    defaultPrevented: boolean;
  }> = {},
) {
  const preventDefault = vi.fn();
  return {
    preventDefault,
    defaultPrevented: overrides.defaultPrevented ?? false,
    button: overrides.button ?? 0,
    metaKey: overrides.metaKey ?? false,
    ctrlKey: overrides.ctrlKey ?? false,
    shiftKey: overrides.shiftKey ?? false,
    altKey: overrides.altKey ?? false,
  };
}

function fakeLink(id = "back-to-videos"): VideosWatchBackLinkElement & {
  listeners: Array<(event: ReturnType<typeof clickEvent>) => void>;
} {
  const listeners: Array<(event: ReturnType<typeof clickEvent>) => void> = [];
  return {
    id,
    href: "/videos",
    textContent: "← Back to Videos",
    listeners,
    addEventListener(_type, listener) {
      listeners.push(listener as (event: ReturnType<typeof clickEvent>) => void);
    },
  };
}

describe("videosCatalogHrefFromWatchSearch", () => {
  it("keeps the socks search query on the catalog fallback URL", () => {
    expect(videosCatalogHrefFromWatchSearch("?q=socks")).toBe("/videos?q=socks");
  });

  it("preserves category, search, and sort query strings as-is", () => {
    expect(videosCatalogHrefFromWatchSearch("?cat=Shaping")).toBe("/videos?cat=Shaping");
    expect(
      videosCatalogHrefFromWatchSearch("?cat=Mittens%2C%20Socks%2C%20Hats&q=socks&sort=title"),
    ).toBe("/videos?cat=Mittens%2C%20Socks%2C%20Hats&q=socks&sort=title");
  });

  it("falls back to /videos when the watch URL has no query", () => {
    expect(videosCatalogHrefFromWatchSearch("")).toBe("/videos");
    expect(videosCatalogHrefFromWatchSearch("?")).toBe("/videos?");
  });
});

describe("videosWatchBackLabelSuffix", () => {
  it("labels a search return as Back to Search Results", () => {
    expect(videosWatchBackLabelSuffix("?q=socks")).toBe("Search Results");
    expect(videosWatchBackLinkText({ id: "back-to-videos", search: "?q=socks" })).toBe(
      "← Back to Search Results",
    );
    expect(videosWatchBackLinkText({ id: "", search: "?q=socks" })).toBe("Back to Search Results");
  });

  it("labels a category-filtered return as Back to [category] Videos", () => {
    expect(videosWatchBackLabelSuffix("?cat=Shaping")).toBe("Shaping Videos");
    expect(
      videosWatchBackLinkText({ id: "back-to-videos", search: "?cat=Shaping" }),
    ).toBe("← Back to Shaping Videos");
  });

  it("labels a plain catalog return as Back to Videos", () => {
    expect(videosWatchBackLabelSuffix("")).toBe("Videos");
    expect(videosWatchBackLinkText({ id: "back-to-videos", search: "" })).toBe(
      "← Back to Videos",
    );
  });
});

describe("shouldUseVideosCatalogHistoryBack", () => {
  it("uses browser history after /videos?q=socks → video", () => {
    expect(
      shouldUseVideosCatalogHistoryBack({
        referrer: `${ORIGIN}/videos?q=socks`,
        historyLength: 2,
        currentOrigin: ORIGIN,
      }),
    ).toBe(true);
  });

  it("uses browser history after a category-filtered Videos catalog visit", () => {
    expect(
      shouldUseVideosCatalogHistoryBack({
        referrer: `${ORIGIN}/videos?cat=Shaping`,
        historyLength: 3,
        currentOrigin: ORIGIN,
      }),
    ).toBe(true);
    expect(isVideosCatalogPath("/videos/")).toBe(true);
    expect(
      isVideosCatalogReferrer(`${ORIGIN}/videos/?cat=free`, ORIGIN),
    ).toBe(true);
  });

  it("does not use history.back() for a direct / pasted / bookmarked video URL", () => {
    expect(
      shouldUseVideosCatalogHistoryBack({
        referrer: "",
        historyLength: 1,
        currentOrigin: ORIGIN,
      }),
    ).toBe(false);
    expect(
      shouldUseVideosCatalogHistoryBack({
        referrer: "",
        historyLength: 4,
        currentOrigin: ORIGIN,
      }),
    ).toBe(false);
    expect(
      shouldUseVideosCatalogHistoryBack({
        referrer: `${ORIGIN}/videos?q=socks`,
        historyLength: 1,
        currentOrigin: ORIGIN,
      }),
    ).toBe(false);
  });

  it("does not use unrelated previous history", () => {
    expect(
      shouldUseVideosCatalogHistoryBack({
        referrer: `${ORIGIN}/tools`,
        historyLength: 5,
        currentOrigin: ORIGIN,
      }),
    ).toBe(false);
    expect(
      shouldUseVideosCatalogHistoryBack({
        referrer: `${ORIGIN}/learn/skill-builders/short-rows`,
        historyLength: 5,
        currentOrigin: ORIGIN,
      }),
    ).toBe(false);
    expect(
      shouldUseVideosCatalogHistoryBack({
        referrer: `${ORIGIN}/videos/332?q=socks`,
        historyLength: 5,
        currentOrigin: ORIGIN,
      }),
    ).toBe(false);
    expect(
      shouldUseVideosCatalogHistoryBack({
        referrer: "https://www.google.com/search?q=socks",
        historyLength: 5,
        currentOrigin: ORIGIN,
      }),
    ).toBe(false);
    expect(isVideosCatalogPath("/videos/332")).toBe(false);
    expect(isVideosCatalogPath("/video-search")).toBe(false);
  });
});

describe("handleVideosWatchBackLinkClick", () => {
  it("prevents default and history.back() from a Videos search result", () => {
    const event = clickEvent();
    const back = vi.fn();
    const usedHistory = handleVideosWatchBackLinkClick(event, {
      referrer: `${ORIGIN}/videos?q=socks`,
      historyLength: 2,
      currentOrigin: ORIGIN,
      back,
    });
    expect(usedHistory).toBe(true);
    expect(event.preventDefault).toHaveBeenCalledTimes(1);
    expect(back).toHaveBeenCalledTimes(1);
  });

  it("leaves the reconstructed href fallback for direct visits and modified clicks", () => {
    const direct = clickEvent();
    const directBack = vi.fn();
    expect(
      handleVideosWatchBackLinkClick(direct, {
        referrer: "",
        historyLength: 1,
        currentOrigin: ORIGIN,
        back: directBack,
      }),
    ).toBe(false);
    expect(direct.preventDefault).not.toHaveBeenCalled();
    expect(directBack).not.toHaveBeenCalled();

    const newTab = clickEvent({ ctrlKey: true });
    const newTabBack = vi.fn();
    expect(
      handleVideosWatchBackLinkClick(newTab, {
        referrer: `${ORIGIN}/videos?q=socks`,
        historyLength: 2,
        currentOrigin: ORIGIN,
        back: newTabBack,
      }),
    ).toBe(false);
    expect(newTab.preventDefault).not.toHaveBeenCalled();
    expect(newTabBack).not.toHaveBeenCalled();
  });
});

describe("bindVideosWatchPageBackLinks", () => {
  it("writes the socks search fallback href and uses history on click", () => {
    const link = fakeLink();
    const back = vi.fn();
    const href = bindVideosWatchPageBackLinks({
      links: [link],
      search: "?q=socks",
      referrer: `${ORIGIN}/videos?q=socks`,
      historyLength: 2,
      currentOrigin: ORIGIN,
      back,
    });
    expect(href).toBe("/videos?q=socks");
    expect(link.href).toBe("/videos?q=socks");
    expect(link.textContent).toBe("← Back to Search Results");

    const event = clickEvent();
    link.listeners[0]?.(event);
    expect(event.preventDefault).toHaveBeenCalled();
    expect(back).toHaveBeenCalledTimes(1);
  });

  it("keeps the fallback href when previous history is not the Videos catalog", () => {
    const link = fakeLink("not-found");
    const back = vi.fn();
    bindVideosWatchPageBackLinks({
      links: [link],
      search: "?q=socks&sort=title",
      referrer: `${ORIGIN}/patterns`,
      historyLength: 8,
      currentOrigin: ORIGIN,
      back,
    });
    expect(link.href).toBe("/videos?q=socks&sort=title");
    expect(link.textContent).toBe("Back to Search Results");

    const event = clickEvent();
    link.listeners[0]?.(event);
    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(back).not.toHaveBeenCalled();
  });
});

describe("video watch page return-link wiring", () => {
  it("binds the watch-page helper instead of a full document load or a blind history.back()", () => {
    expect(pageSource).toContain('from "../../lib/videos/videoWatchPageBackLink"');
    expect(pageSource).toContain("bindVideosWatchPageBackLinks");
    expect(pageSource).toContain('class="back-link back-to-videos-link"');
    expect(pageSource).toContain('href="/videos"');
    expect(pageSource).toContain("← Back to Videos");
    expect(pageSource).not.toMatch(
      /if\s*\(\s*window\.history\.length\s*>\s*1\s*\)\s*\{\s*event\.preventDefault\(\);\s*window\.history\.back\(\);/,
    );
    expect(pageSource).not.toContain("WizardBackLink");
  });
});
