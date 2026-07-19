import fs from "fs";
import path from "path";

import { describe, expect, it } from "vitest";

describe("Watson Saved Pattern Inspector page", () => {
  it("defines a server-rendered inspector route with Watson shell and lookup form", () => {
    const page = fs.readFileSync(
      path.resolve("src/pages/watson/pattern-inspector.astro"),
      "utf8",
    );
    const shell = fs.readFileSync(
      path.resolve("src/components/watson/WatsonPageShell.astro"),
      "utf8",
    );
    const dashboard = fs.readFileSync(path.resolve("src/pages/watson/index.astro"), "utf8");
    const middleware = fs.readFileSync(path.resolve("src/middleware.ts"), "utf8");

    expect(page).toContain('export const prerender = false');
    expect(page).toContain("WatsonPageShell");
    expect(page).toContain("Saved Pattern Inspector");
    expect(page).toContain("Project ID");
    expect(page).toContain("Find Saved Pattern");
    expect(page).toContain('name="projectId"');
    expect(page).toContain("inspectSavedPatternByProjectId");
    expect(page).toContain("Raw Saved Project JSON");
    expect(page).toContain("<details");
    expect(page).toContain("Member pattern notes");
    expect(page).toContain("Copy Project ID");
    expect(page).toContain("Copy Memberstack ID");
    expect(page).toContain("Copy sanitized pattern settings");
    expect(page).toContain("Open member Watson record");
    expect(page).not.toContain("Regenerate");
    expect(page).not.toContain("Delete");
    expect(page).not.toContain("Impersonat");
    expect(page).not.toContain("set:html");

    expect(shell).toContain('href="/watson/pattern-inspector"');
    expect(shell).toContain("Saved Pattern Inspector");

    expect(dashboard).toContain("Saved Pattern Inspector");
    expect(dashboard).toContain("Inspect a Pattern");
    expect(dashboard).toContain('href="/watson/pattern-inspector"');

    expect(middleware).toContain("isWatsonRoute");
    expect(middleware).toContain("isWatsonSessionAuthenticated");
    expect(middleware).toContain("/watson/login?next=");
  });

  it("is covered by Watson route auth (no public lookup endpoint)", () => {
    const access = fs.readFileSync(path.resolve("src/lib/watson/watsonAccess.ts"), "utf8");
    const page = fs.readFileSync(
      path.resolve("src/pages/watson/pattern-inspector.astro"),
      "utf8",
    );

    expect(access).toContain('pathname === "/watson" || pathname.startsWith("/watson/")');
    expect(page).toContain('action="/watson/pattern-inspector"');
    expect(page).not.toContain("/api/public");
    expect(fs.existsSync(path.resolve("src/pages/api/watson/pattern-inspector.ts"))).toBe(false);
    expect(
      fs.existsSync(path.resolve("netlify/functions/pattern-inspector.js")) ||
        fs.existsSync(path.resolve("netlify/functions/pattern-inspector.ts")),
    ).toBe(false);
  });
});
