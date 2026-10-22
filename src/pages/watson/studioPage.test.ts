import fs from "fs";
import path from "path";

import { describe, expect, it } from "vitest";

describe("Watson Sue's Studio", () => {
  const page = fs.readFileSync(path.resolve("src/pages/watson/studio.astro"), "utf8");
  const sessionPage = fs.readFileSync(path.resolve("src/pages/studio/[slug].astro"), "utf8");
  const shell = fs.readFileSync(path.resolve("src/components/watson/WatsonPageShell.astro"), "utf8");
  const script = fs.readFileSync(path.resolve("src/scripts/watsonStudioSessions.ts"), "utf8");

  it("adds a Watson editor with draft and published lists", () => {
    expect(page).toContain('export const prerender = false');
    expect(page).toContain("WatsonPageShell");
    expect(page).toContain("listStudioSessions");
    expect(page).toContain("Drafts");
    expect(page).toContain("Published");
    expect(page).toContain("Save Draft");
    expect(page).toContain("Preview");
    expect(page).toContain("Publish");
    expect(page).toContain('name="title"');
    expect(page).toContain('name="introduction"');
    expect(page).toContain('name="video"');
    expect(page).toContain('name="slug"');
    expect(page).toContain("Permanent ID");
    expect(page).toContain("initWatsonStudioSessions");
    expect(page).toContain('data-studio-save="published"');
    expect(shell).toContain('href="/watson/studio"');
    expect(script).toContain('=== "published"');
    expect(script).toContain("/api/watson/studio");
    expect(script).toContain("studioPreviewAction");
    expect(page).toContain("Sue’s Studio sessions could not be loaded");
    expect(page).not.toContain("watson-studio-sessions.sql");
    expect(page).not.toContain("WATSON_DATABASE_URL");
  });

  it("renders the introduction above the video and ties comments to the permanent id", () => {
    const markup = sessionPage.slice(sessionPage.indexOf("<section"));
    expect(markup.indexOf("studio-session__intro")).toBeGreaterThan(-1);
    expect(markup.indexOf("studio-session__intro")).toBeLessThan(markup.indexOf("<VimeoEmbed"));
    expect(sessionPage).toContain("studioSessionDiscussionId");
    expect(sessionPage).toContain("data-studio-discussion-id");
    expect(sessionPage).toContain("studioSessionPrivateMessageHref");
    expect(sessionPage).toContain("Prefer to send me a private message?");
    expect(sessionPage).toContain("Log in to comment");
    expect(sessionPage).toContain('src="/images/sues-studio.svg"');
    expect(sessionPage).toContain('width="120"');
    expect(sessionPage).toContain("<h1>{studioSession.title}</h1>");
    expect(markup.indexOf("<h1>")).toBeLessThan(markup.indexOf("studio-session__logo"));
    expect(markup.indexOf("studio-session__logo")).toBeLessThan(markup.indexOf("studio-session__intro"));
    expect(sessionPage).toContain("isStudioCommentsPocProductionBlocked");
    expect(sessionPage).not.toContain("STUDIO_LOCAL_TEST_VIMEO_ID");
  });
});
