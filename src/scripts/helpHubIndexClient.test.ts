import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { helpHubTipSearchText } from "../lib/helpHubPublic";
import { helpHubEntryVisibleForQuery } from "./helpHubIndexClient";

const here = dirname(fileURLToPath(import.meta.url));
const clientSource = readFileSync(join(here, "helpHubIndexClient.ts"), "utf8");

describe("helpHubEntryVisibleForQuery", () => {
  const sponge = helpHubTipSearchText({
    slug: "replace-sponge-bar",
    status: "published",
    title: "Carriage trouble",
    question: "Why is the carriage sticking?",
    bridge: "Replace the <strong>sponge bar</strong> under the needles.",
    appliesTo: ["LK150"],
  });

  it("shows every entry when the query is empty", () => {
    expect(helpHubEntryVisibleForQuery(sponge, "   ")).toBe(true);
  });

  it("matches the same Help Hub text the server search builds", () => {
    expect(helpHubEntryVisibleForQuery(sponge, "Sponge Bar")).toBe(true);
    expect(helpHubEntryVisibleForQuery(sponge, "needles")).toBe(true);
    expect(helpHubEntryVisibleForQuery(sponge, "LK150")).toBe(true);
    expect(helpHubEntryVisibleForQuery(sponge, "fair isle")).toBe(false);
  });
});

describe("Help Hub index client", () => {
  it("filters in place, keeps one answer open, and defers media", () => {
    expect(clientSource).toContain("applyHelpHubIndexQuery");
    expect(clientSource).toContain("[data-help-hub-new]");
    expect(clientSource).toContain("details[data-help-hub-answer]");
    expect(clientSource).toContain("activateHelpHubDeferredMedia");
    expect(clientSource).toContain("stopHelpHubInlineMedia");
    expect(clientSource).toContain("[data-open-search-modal]");
    expect(clientSource).not.toContain("pagefind");
    expect(clientSource).toContain('area: "help-hub"');
    expect(clientSource).toContain("queueSearchCommit");
    expect(clientSource).toContain('event.key !== "Enter"');
    expect(clientSource).toContain("__kinFlushSearchCommit");
    expect(clientSource).toContain("openHelpHubArticle");
    expect(clientSource).toContain("closeHelpHubArticle");
    expect(clientSource).toContain("[data-help-hub-article-back]");
    expect(clientSource).toContain("data-help-hub-article-title");
    expect(clientSource).toContain("scrollMarginTop");
    expect(clientSource).toContain('history.scrollRestoration = "manual"');
    expect(clientSource).toContain("preventScroll: true");
    expect(clientSource).toContain("helpHubReading");
    expect(clientSource).toContain("popstate");
  });
});
