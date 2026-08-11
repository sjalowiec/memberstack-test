import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  hrefWithoutSiteSearchOpen,
  openSiteSearchFromUrlIfRequested,
  resetSiteSearchOpenFromUrlForTests,
  shouldOpenSiteSearchFromUrl,
  SITE_SEARCH_OPEN_PARAM,
  SITE_SEARCH_OPEN_VALUE,
} from "./siteSearchOpenFromUrl";

const headerSource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../components/Header.astro"),
  "utf8",
);

afterEach(() => {
  resetSiteSearchOpenFromUrlForTests();
});

describe("siteSearchOpenFromUrl", () => {
  it("opens the search modal when ?search=open is present", () => {
    const open = vi.fn();
    const replaceState = vi.fn();

    const opened = openSiteSearchFromUrlIfRequested({
      href: "https://knititnow.com/?search=open",
      open,
      replaceState,
    });

    expect(opened).toBe(true);
    expect(open).toHaveBeenCalledTimes(1);
    expect(replaceState).toHaveBeenCalledWith("/");
  });

  it("does not open when the URL lacks search=open", () => {
    const open = vi.fn();
    const replaceState = vi.fn();

    expect(shouldOpenSiteSearchFromUrl("https://knititnow.com/")).toBe(false);
    expect(shouldOpenSiteSearchFromUrl("https://knititnow.com/?search=yes")).toBe(false);
    expect(shouldOpenSiteSearchFromUrl("?utm=1")).toBe(false);

    const opened = openSiteSearchFromUrlIfRequested({
      href: "https://knititnow.com/?utm_source=newsletter",
      open,
      replaceState,
    });

    expect(opened).toBe(false);
    expect(open).not.toHaveBeenCalled();
    expect(replaceState).not.toHaveBeenCalled();
  });

  it("preserves other query parameters when search=open is removed", () => {
    expect(
      hrefWithoutSiteSearchOpen("https://knititnow.com/?utm_source=newsletter&search=open&ref=home"),
    ).toBe("/?utm_source=newsletter&ref=home");

    expect(
      hrefWithoutSiteSearchOpen("https://knititnow.com/patterns/?search=open#results"),
    ).toBe("/patterns/#results");

    const replaceState = vi.fn();
    openSiteSearchFromUrlIfRequested({
      href: "https://knititnow.com/?foo=1&search=open&bar=2#x",
      open: () => {},
      replaceState,
    });

    expect(replaceState).toHaveBeenCalledWith("/?foo=1&bar=2#x");
  });

  it("does not reopen if boot runs again after consuming search=open", () => {
    const open = vi.fn();
    const replaceState = vi.fn();

    expect(
      openSiteSearchFromUrlIfRequested({
        href: "https://knititnow.com/?search=open",
        open,
        replaceState,
      }),
    ).toBe(true);

    expect(
      openSiteSearchFromUrlIfRequested({
        href: "https://knititnow.com/?search=open",
        open,
        replaceState,
      }),
    ).toBe(false);

    expect(open).toHaveBeenCalledTimes(1);
    expect(replaceState).toHaveBeenCalledTimes(1);
  });

  it("uses search=open as the exact query contract", () => {
    expect(SITE_SEARCH_OPEN_PARAM).toBe("search");
    expect(SITE_SEARCH_OPEN_VALUE).toBe("open");
    expect(shouldOpenSiteSearchFromUrl("?search=open")).toBe(true);
  });
});

describe("Header site search wiring", () => {
  it("keeps the magnifying-glass button on the same openModal path", () => {
    expect(headerSource).toContain('data-open-search-modal');
    expect(headerSource).toContain('data-testid="header-search"');
    expect(headerSource).toMatch(
      /querySelectorAll\("\[data-open-search-modal\]"\)[\s\S]*?addEventListener\("click",\s*\(\)\s*=>\s*openModal\(el\)\)/,
    );
  });

  it("opens from ?search=open by clicking the existing search trigger", () => {
    expect(headerSource).toContain('from "../lib/siteSearchOpenFromUrl"');
    expect(headerSource).toContain("openSiteSearchFromUrlIfRequested");
    expect(headerSource).toContain('querySelector("[data-open-search-modal]")');
    expect(headerSource).toMatch(/trigger\.click\(\)/);
  });
});
