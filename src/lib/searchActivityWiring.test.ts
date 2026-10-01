import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

function source(relativePath: string): string {
  return readFileSync(resolve(relativePath), "utf8");
}

function sliceBetween(text: string, start: string, end: string): string {
  const from = text.indexOf(start);
  const to = text.indexOf(end, from + start.length);
  expect(from).toBeGreaterThanOrEqual(0);
  expect(to).toBeGreaterThan(from);
  return text.slice(from, to);
}

describe("search tracking is tied to a committed search", () => {
  it("does not record opening the header search or the ?search=open shortcut", () => {
    const header = source("src/components/Header.astro");
    const opener = source("src/lib/siteSearchOpenFromUrl.ts");
    const openModal = sliceBetween(header, "function openModal", "function closeModal");
    expect(openModal).not.toContain("noteGlobalSearchCommit");
    expect(opener).not.toContain("searchActivity");
    expect(opener).not.toContain("noteGlobalSearchCommit");
    const unavailable = sliceBetween(header, "function showUnavailable", "async function getPagefind");
    expect(unavailable).not.toContain("noteGlobalSearchCommit");
  });

  it("records a finished global search, including no matches", () => {
    const header = source("src/components/Header.astro");
    const run = sliceBetween(header, "async function runSearch", "form.addEventListener");
    expect(run).toContain("noteGlobalSearchCommit(term, 0)");
    expect(run).toContain("noteGlobalSearchCommit(term, allResults.length)");
    expect(header).toContain("installSearchCommitLogger");
  });

  it("records the video library search from the field, not from the address or a result click", () => {
    const page = source("src/pages/videos/index.astro");
    const updateUrl = sliceBetween(page, "function updateUrl()", "function categoryLabel");
    expect(updateUrl).not.toContain("queueSearchCommit");
    const render = sliceBetween(page, "function render(cat)", "function isCatalogCategory");
    expect(render).toContain("queueSearchCommit");
    expect(page).toContain("rememberSearchCommit({ area: \"video\", term: initialQ, resultCount: 0 })");
    expect(page).toContain("queueSearchCommit({");
    expect(page.match(/queueSearchCommit\(/g)).toHaveLength(5);
    expect(page).toContain('if (e.key !== "Enter") return;');
    expect(page).toContain("installSearchCommitLogger");
  });

  it("records an in-video search when the visitor commits it, not on page load", () => {
    const page = source("src/pages/video-search.astro");
    const commit = sliceBetween(page, "function queueVideoSearchCommit", "function runVideoSearch");
    expect(commit).toContain('reason === "main-input"');
    expect(commit).toContain('reason === "main-enter"');
    expect(page).toContain("queueVideoSearchCommit(queryRaw, topMatches.length, reason)");
    expect(page).not.toContain("queueVideoSearchCommit(queryRaw, matches.length, reason)");
    expect(commit).not.toContain('reason === "init"');
    const openModal = sliceBetween(page, "function openModal", "function closeModal");
    expect(openModal).not.toContain("queueVideoSearchCommit");
    expect(page).not.toContain("console.log('[video-search] runVideoSearch'");
    expect(page).not.toContain("console.log('[video-search] matches'");
    expect(page).toContain("installSearchCommitLogger");
  });

  it("records a settled Help Hub search on the shared logger", () => {
    const client = source("src/scripts/helpHubIndexClient.ts");
    const page = source("src/pages/help-hub/index.astro");
    const input = sliceBetween(client, 'querySelector("#help-hub-search-input")', "const siteSearch");
    expect(input).toContain("applyHelpHubIndexQuery");
    expect(input).toContain('area: "help-hub"');
    expect(input).toContain("queueSearchCommit");
    expect(input).toContain('if (event.key !== "Enter") return;');
    expect(input).toContain("__kinFlushSearchCommit");
    const siteSearch = sliceBetween(client, "const siteSearch", "}");
    expect(siteSearch).not.toContain("queueSearchCommit");
    expect(page).toContain("installSearchCommitLogger");
    const report = source("src/pages/watson/search-activity.astro");
    expect(report).toContain("SEARCH_ACTIVITY_AREAS");
    expect(report).toContain("searchActivityAreaLabel");
    expect(source("src/lib/searchActivity.ts")).toContain('"help-hub": "Help Hub"');
  });

  it("does not log search terms from the save route", () => {
    const route = source("src/pages/api/search-activity.ts");
    expect(route).not.toContain("console.log");
    expect(route).toContain("search activity write failed");
    expect(route).toContain("error.name");
    expect(route).not.toContain("error.message");
    const report = source("src/pages/watson/search-activity.astro");
    expect(report).toContain("SEARCH_TRACKING_START_NOTE");
    expect(report).toContain("SEARCH_SETTLE_NOTE");
    expect(report).toContain("Most common terms");
    expect(report).toContain("Terms with zero results");
    expect(report).toContain(
      "Search activity could not be read. This is not a count of zero searches.",
    );
  });
});
