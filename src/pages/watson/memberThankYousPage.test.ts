import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

describe("Member Thank-Yous page", () => {
  it("is a Watson page linked beside Birthdays and from the main admin", () => {
    const page = fs.readFileSync(path.resolve("src/pages/watson/member-thank-yous.astro"), "utf8");
    const admin = fs.readFileSync(path.resolve("src/pages/admin/index.astro"), "utf8");
    const shell = fs.readFileSync(
      path.resolve("src/components/watson/WatsonPageShell.astro"),
      "utf8",
    );

    expect(page).toContain('export const prerender = false');
    expect(page).toContain("WatsonPageShell");
    expect(page).toContain('heading="Member Thank-Yous"');
    expect(page).toContain("data-member-thank-yous");
    expect(page).toContain("Manage your membership thank-you cards and videos.");
    expect(page).toContain("View details");
    expect(page).toContain("data-thanks-dialog");
    expect(page).toContain("data-thanks-close");
    expect(page).toContain("initWatsonMemberThankYous");
    expect(page).not.toContain("<table");
    expect(shell).toContain('href="/watson/member-thank-yous">Thank-Yous</a>');
    expect(admin).toContain('href: "/watson/member-thank-yous"');
    expect(admin).toContain("Member Thank-Yous");
  });

  it("saves through the Watson session API", () => {
    const page = fs.readFileSync(path.resolve("src/pages/watson/member-thank-yous.astro"), "utf8");
    const api = fs.readFileSync(
      path.resolve("src/pages/api/watson/member-thank-yous.ts"),
      "utf8",
    );
    const script = fs.readFileSync(path.resolve("src/scripts/watsonMemberThankYous.ts"), "utf8");
    expect(api).toContain("requireWatsonAdminJson");
    expect(api).toContain("export const PATCH");
    expect(api).not.toContain("export const GET");
    expect(script).toContain('credentials: "same-origin"');
    expect(script).toContain('method: "PATCH"');
    expect(script).toContain("Saving");
    expect(script).toContain("Saved");
    expect(page).toContain("To Do");
    expect(page).toContain("Completed");
    expect(page).toContain("All");
    expect(page).toContain("Add thank-you video");
    expect(page).toContain('data-thanks-completed');
    expect(page).not.toContain("Mark Complete");
    expect(page).not.toContain("Reopen");
    expect(page).toContain("Copy subject");
    expect(page).toContain("Copy message");
    expect(page).toContain('data-thanks-video-preview');
    expect(page).toContain('target="_blank"');
    const copyFn = script.slice(
      script.indexOf("async function copyThankYouText"),
      script.indexOf("async function saveThankYouAction"),
    );
    expect(copyFn).not.toContain("mark_video_email_sent");
    expect(copyFn).not.toContain("save_video");
    expect(copyFn).not.toContain("complete");
  });
});
