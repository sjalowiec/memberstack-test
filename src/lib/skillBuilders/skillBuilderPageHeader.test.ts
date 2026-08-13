import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const componentsDir = join(ROOT, "src/components/skill-builders");
const pagesDir = join(ROOT, "src/pages/learn/skill-builders");
const ICON_SRC = "/icons/tools/skill-builder-steps.svg";

function readComponent(name: string): string {
  return readFileSync(join(componentsDir, name), "utf8");
}

function readPage(...parts: string[]): string {
  return readFileSync(join(pagesDir, ...parts), "utf8");
}

describe("Skill Builder page title icon", () => {
  const header = readComponent("SkillBuilderPageHeader.astro");

  it("puts a 64px decorative steps icon immediately before the h1, top-aligned to the first line", () => {
    expect(header).toMatch(
      /sb-page-title__icon[\s\S]*src="\/icons\/tools\/skill-builder-steps\.svg"[\s\S]*<h1>\{title\}<\/h1>/,
    );
    expect(header).toContain(`src="${ICON_SRC}"`);
    expect(header).toContain('alt=""');
    expect(header).toContain('aria-hidden="true"');
    expect(header).toContain('width="64"');
    expect(header).toContain('height="64"');
    expect(header).toContain("width: 64px");
    expect(header).toContain("height: 64px");
    expect(header).not.toContain("width: 22px");
    expect(header).not.toContain("width: 40px");
    expect(header).toContain("gap: 14px");
    expect(header).toContain("align-items: flex-start");
    expect(header).toContain("align-self: flex-start");
    expect(header).toContain("flex-shrink: 0");
    expect(header).not.toContain("align-items: center");
    expect(header).toContain("flex: 1 1 auto");
    expect(header).toContain("min-width: 0");
  });

  it("crops the steps SVG viewBox tightly around the stairs and arrow", () => {
    const svg = readFileSync(
      join(ROOT, "public/icons/tools/skill-builder-steps.svg"),
      "utf8",
    );
    const match = svg.match(/viewBox="([^"]+)"/);
    expect(match).toBeTruthy();
    const [x, y, w, h] = match![1].split(/\s+/).map(Number);
    expect(x).toBeGreaterThan(20);
    expect(y).toBeGreaterThan(35);
    expect(x + w).toBeLessThan(130);
    expect(y + h).toBeLessThan(135);
    expect(w).toBeLessThan(110);
    expect(h).toBeLessThan(95);
    expect(svg).not.toContain('viewBox="0 0 160 160"');
  });

  it("is used by shared Skill Builder layouts, not copied onto each route file", () => {
    const shared = [
      "JoiningShoulderSeamsSkillBuilder.astro",
      "RoundNecklineSkillBuilderLanding.astro",
      "RoundNecklineSkillBuilderExercise.astro",
      "SkillBuilderLayout.astro",
    ];
    for (const name of shared) {
      expect(readComponent(name)).toContain("SkillBuilderPageHeader");
      expect(readComponent(name)).toContain("<SkillBuilderPageHeader");
    }

    const catalog = readFileSync(join(pagesDir, "..", "skill-builders.astro"), "utf8");
    expect(catalog).toContain("SkillBuilderPageHeader");
    expect(catalog).toContain('<SkillBuilderPageHeader title="Skill Builders" />');
    expect(catalog).not.toContain(ICON_SRC);
    expect(catalog).not.toContain("<h1>");

    const routeFiles = [
      readPage("join-beautiful-shoulder-seams.astro"),
      readPage("round-neckline-basics", "index.astro"),
      readPage("round-neckline-basics", "[exercise].astro"),
      readPage("round-necklines-shaped-shoulders", "index.astro"),
      readPage("round-necklines-shaped-shoulders", "[exercise].astro"),
    ];
    for (const source of routeFiles) {
      expect(source).not.toContain(ICON_SRC);
      expect(source).not.toContain("SkillBuilderPageHeader");
    }
  });
});
