import fs from "fs";
import path from "path";

import { describe, expect, it } from "vitest";

describe("Watson member search pages", () => {
  it("defines server-rendered search and member detail routes", () => {
    const searchPage = fs.readFileSync(
      path.resolve("src/pages/watson/index.astro"),
      "utf8",
    );
    const detailPage = fs.readFileSync(
      path.resolve("src/pages/watson/members/[memberid].astro"),
      "utf8",
    );
    const middleware = fs.readFileSync(path.resolve("src/middleware.ts"), "utf8");

    expect(searchPage).toContain('export const prerender = false');
    expect(searchPage).toContain("searchLegacyMembers");
    expect(searchPage).toContain('data-sortable-table');
    expect(searchPage).toContain("/watson/members/${encodeURIComponent(row.memberid)}");

    expect(detailPage).toContain('export const prerender = false');
    expect(detailPage).toContain("Astro.params.memberid");
    expect(detailPage).toContain('href="/watson"');

    expect(middleware).toContain("isWatsonRoute");
    expect(middleware).toContain("requireAdminForRequest");
    expect(middleware).toContain("watsonAccessDeniedResponse");
  });
});
