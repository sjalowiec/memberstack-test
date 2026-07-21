import fs from "fs";
import path from "path";

import { describe, expect, it } from "vitest";

describe("Watson Responses page", () => {
  it("defines a static canned-response page with copy interaction", () => {
    const page = fs.readFileSync(path.resolve("src/pages/watson/responses.astro"), "utf8");
    const shell = fs.readFileSync(
      path.resolve("src/components/watson/WatsonPageShell.astro"),
      "utf8",
    );
    const middleware = fs.readFileSync(path.resolve("src/middleware.ts"), "utf8");

    expect(page).toContain('export const prerender = false');
    expect(page).toContain("WatsonPageShell");
    expect(page).toContain('heading="Responses"');
    expect(page).toContain("DAK License Delivery");
    expect(page).toContain("Copy Response");
    expect(page).toContain("Copied");
    expect(page).toContain("readonly");
    expect(page).toContain("data-response-text");
    expect(page).toContain("data-copy-response");
    expect(page).toContain('aria-live="polite"');
    expect(page).toContain("navigator.clipboard.writeText");
    expect(page).toContain("Hello {Customer Name},");
    expect(page).toContain("DesignaKnit 9 {Version}");
    expect(page).toContain("{License Number}");
    expect(page).toContain("knitcraft@knitcraft.com");
    expect(page).toContain("https://softbyte.co.uk/_dk9webinst/MiniSetup_D9_US.exe");
    expect(page).toContain("https://learndesignaknit.com/courses/designaknit-quick-start/");

    expect(page).not.toContain("/api/watson/responses");
    expect(page).not.toContain("getStore");
    expect(page).not.toContain("Netlify");
    expect(page).not.toContain("replace(");
    expect(fs.existsSync(path.resolve("src/pages/api/watson/responses/index.ts"))).toBe(false);
    expect(fs.existsSync(path.resolve("src/pages/api/watson/responses.ts"))).toBe(false);

    expect(shell).toContain('<a href="/watson/responses">Responses</a>');

    expect(middleware).toContain("isWatsonRoute");
    expect(middleware).toContain("isWatsonSessionAuthenticated");
    expect(middleware).toContain("/watson/login?next=");
  });

  it("is covered by Watson route auth like other Watson pages", () => {
    const access = fs.readFileSync(path.resolve("src/lib/watson/watsonAccess.ts"), "utf8");

    expect(access).toContain('pathname === "/watson" || pathname.startsWith("/watson/")');
  });
});
