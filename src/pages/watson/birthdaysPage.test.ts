import fs from "fs";
import path from "path";

import { describe, expect, it } from "vitest";

describe("Watson Member Birthdays page", () => {
  it("is registered at /watson/birthdays with Member Birthdays title", () => {
    const page = fs.readFileSync(path.resolve("src/pages/watson/birthdays.astro"), "utf8");
    const shell = fs.readFileSync(
      path.resolve("src/components/watson/WatsonPageShell.astro"),
      "utf8",
    );

    expect(page).toContain('heading="Member Birthdays"');
    expect(page).toContain('intro="Active members only"');
    expect(page).toContain("data-birthdays-page");
    expect(page).toContain("initWatsonBirthdays");
    expect(page).toContain('export const prerender = false');
    expect(shell).toContain('href="/watson/birthdays"');
    expect(shell).toContain("Birthdays");
  });

  it("links member records and notes to existing customer routes", () => {
    const source = fs.readFileSync(
      path.resolve("src/lib/watson/birthdayMemberSource.ts"),
      "utf8",
    );
    expect(source).toContain("buildLegacyCustomerProfileUrl");
    expect(source).toContain("#customer-notes");
  });

  it("passes displayed calendar year into card-status reads and writes", () => {
    const script = fs.readFileSync(path.resolve("src/scripts/watsonBirthdays.ts"), "utf8");
    const api = fs.readFileSync(
      path.resolve("src/pages/api/watson/birthday-cards/index.ts"),
      "utf8",
    );

    expect(script).toContain("/api/watson/birthday-cards?year=");
    expect(script).toContain("birthdayYear");
    expect(script).toContain("occurrenceYear");
    expect(script).toContain("data-occurrence-year");
    expect(api).toContain('searchParams.get("year")');
    expect(api).toContain("body.birthdayYear");
  });

  it("is protected by Watson middleware like other Watson pages", () => {
    const middleware = fs.readFileSync(path.resolve("src/middleware.ts"), "utf8");
    const access = fs.readFileSync(path.resolve("src/lib/watson/watsonAccess.ts"), "utf8");

    expect(middleware).toContain("isWatsonSessionAuthenticated");
    expect(access).toContain('pathname === "/watson"');
    expect(access).toContain('pathname.startsWith("/watson/")');
    expect(access).toContain('pathname.startsWith("/api/watson/")');
  });
});
