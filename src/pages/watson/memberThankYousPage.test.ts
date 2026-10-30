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
    expect(page).toContain("initWatsonMemberThankYous");
    expect(page).not.toContain("<table");
    expect(shell).toContain('href="/watson/member-thank-yous">Thank-Yous</a>');
    expect(admin).toContain('href: "/watson/member-thank-yous"');
    expect(admin).toContain("Member Thank-Yous");
  });

  it("saves through the Watson session API", () => {
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
  });
});
