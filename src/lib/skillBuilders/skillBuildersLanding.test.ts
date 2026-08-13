import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const catalog = readFileSync(
  join(process.cwd(), "src/pages/learn/skill-builders.astro"),
  "utf8",
);

describe("Skill Builders catalog landing", () => {
  it("uses a compact intro with the shared page header, then Free Skill Builder", () => {
    expect(catalog).toContain('<SkillBuilderPageHeader title="Skill Builders" />');
    expect(catalog).toContain("Practice one machine-knitting skill at a time.");
    expect(catalog).toContain(
      "Short, focused exercises help you build confidence before you use the skill in a project.",
    );
    expect(catalog).toMatch(
      /skill-builders-hero__signature[\s\S]*<SkillBuilderPageHeader title="Skill Builders" \/>[\s\S]*skill-builders-hero__subtitle[\s\S]*skill-builders-hero__copy[\s\S]*id="skill-builders-free"[\s\S]*Free Skill Builder/,
    );
  });

  it("places a quiet handwritten signature above the title row, not a pull-quote below the intro", () => {
    expect(catalog).toContain(
      "Don’t practice until you get it right. Practice until you can’t get it wrong.",
    );
    expect(catalog).not.toContain('"Don’t practice');
    expect(catalog).not.toContain("“Don’t practice");
    expect(catalog).not.toContain("&ldquo;");
    expect(catalog).not.toContain(
      "Choose a skill. Follow the practice plan. Knit with confidence.",
    );
    expect(catalog).not.toContain("skill-builders-hero__closing");
    expect(catalog).toContain('font-family: "Handlee", "Shadows Into Light Two", cursive');
    expect(catalog).toContain("color: #A94F3D");
    expect(catalog).not.toContain("color: #C2614E");
    expect(catalog).toContain("white-space: nowrap");
    expect(catalog).toContain("white-space: normal");
    expect(catalog).toMatch(
      /\.skill-builders-hero__signature \{[\s\S]*?font-weight: 400;[\s\S]*?color: #A94F3D;/,
    );
    expect(catalog).toMatch(
      /@media \(min-width: 64rem\) \{[\s\S]*?\.skill-builders-hero__signature \{[\s\S]*?font-size: 1\.5rem;[\s\S]*?line-height: 1\.2;/,
    );
    expect(catalog).toMatch(
      /\.skill-builders-hero__signature \{[\s\S]*?text-transform: none;/,
    );
    const signatureCss = catalog.match(
      /\.skill-builders-hero__signature \{[^}]+\}/,
    )?.[0] ?? "";
    expect(signatureCss).toContain("font-weight: 400");
    expect(signatureCss).not.toContain("font-weight: 600");
    expect(signatureCss).not.toContain("font-weight: bold");
    expect(signatureCss).not.toContain("text-shadow");
    expect(signatureCss).not.toContain("text-stroke");
    expect(signatureCss).not.toContain("background");
    expect(signatureCss).not.toContain("border");
    expect(catalog).toMatch(
      /skill-builders-hero__signature[\s\S]*<SkillBuilderPageHeader title="Skill Builders" \/>/,
    );
  });

  it("does not include the intro photo, course copy, or How Skill Builders Work steps", () => {
    expect(catalog).not.toContain("skill-buider.png");
    expect(catalog).not.toContain("skill-builders-body__image");
    expect(catalog).not.toMatch(/\bcourses?\b/i);
    expect(catalog).not.toContain("How Skill Builders Work");
    expect(catalog).not.toContain("howItWorksSteps");
    expect(catalog).not.toContain("skill-builders-steps");
  });

  it("keeps Coming Soon after the membership-aware catalog groups", () => {
    expect(catalog).toMatch(
      /Free Skill Builder[\s\S]*Member Skill Builders[\s\S]*data-sb-catalog="member"[\s\S]*Coming Soon/,
    );
    expect(catalog).toContain("data-sb-state");
    expect(catalog).toContain("Skill Builders are included with Knit it Now membership.");
    expect(catalog).not.toContain("Free Practice");
    expect(catalog).not.toContain("Available Skill Builders");
  });

  it("presents only Round Neckline Basics as free and the rest as member access", () => {
    const freeConst = catalog.slice(
      catalog.indexOf("const freeSkillBuilder"),
      catalog.indexOf("const memberSkillBuilders"),
    );
    const memberConst = catalog.slice(
      catalog.indexOf("const memberSkillBuilders"),
      catalog.indexOf("const allAvailableSkillBuilders"),
    );
    const guest = catalog.slice(
      catalog.indexOf('data-sb-catalog="guest"'),
      catalog.indexOf('data-sb-catalog="member"'),
    );
    const member = catalog.slice(
      catalog.indexOf('data-sb-catalog="member"'),
      catalog.indexOf('id="skill-builders-coming-soon"'),
    );
    const freeSection = catalog.slice(
      catalog.indexOf('id="skill-builders-free"'),
      catalog.indexOf('id="skill-builders-members"'),
    );

    expect(freeConst).toContain("/learn/skill-builders/round-neckline-basics");
    expect(freeConst).not.toContain("round-necklines-shaped-shoulders");
    expect(freeConst).not.toContain("join-beautiful-shoulder-seams");
    expect(freeConst).not.toContain("round-neckline-practice");

    expect(memberConst).toContain("/learn/skill-builders/round-necklines-shaped-shoulders");
    expect(memberConst).toContain("/learn/skill-builders/join-beautiful-shoulder-seams");
    expect(memberConst).not.toContain("round-neckline-practice");
    expect(memberConst).not.toContain("round-neckline-basics");

    expect(freeSection).toContain("{freeSkillBuilder.title}");
    expect(freeSection).toContain(">Free</span>");
    expect(freeSection).not.toContain("memberSkillBuilders");

    expect(guest).toContain("Free Skill Builder");
    expect(guest).toContain("Member Skill Builders");
    expect(guest).toContain("memberSkillBuilders.map");
    expect(guest).toContain(">Sign in</span>");
    expect(guest).toContain(">Members only</span>");
    expect(guest).not.toContain('data-sb-state="memberAccess"');

    expect(member).toContain('id="skill-builders-all"');
    expect(member).toContain(">Skill Builders</h2>");
    expect(member).toContain("allAvailableSkillBuilders");
    expect(member).not.toContain(">Free</span>");
    expect(member).not.toContain("Free Skill Builder");
    expect(member).not.toContain("Member Skill Builders");
    expect(member).not.toContain(">Sign in</span>");
    expect(member).not.toContain(">Members only</span>");
    expect(member).not.toContain("skill-builders-card__badge");

    expect(catalog).toContain("getViewerAccessState");
    expect(catalog).toContain("Coming Soon");
    expect(catalog).toMatch(
      /const comingSoonItems = \[[\s\S]*Short Rows Practice[\s\S]*Sleeve Cap Practice[\s\S]*Ribber Practice[\s\S]*Cut & Sew Practice[\s\S]*id="skill-builders-coming-soon"/,
    );
    expect(catalog).toMatch(
      /data-sb-catalog="member"[\s\S]*id="skill-builders-coming-soon"/,
    );
  });

  it("uses a featured full-width free card, a 3/2/1 member card grid, and a muted Coming Soon list", () => {
    const freeSection = catalog.slice(
      catalog.indexOf('id="skill-builders-free"'),
      catalog.indexOf('id="skill-builders-members"'),
    );
    const memberSection = catalog.slice(
      catalog.indexOf('id="skill-builders-members"'),
      catalog.indexOf('data-sb-catalog="member"'),
    );
    const comingSoon = catalog.slice(
      catalog.indexOf('id="skill-builders-coming-soon"'),
      catalog.indexOf("<style>"),
    );

    expect(freeSection).toContain('class="skill-builders-card-list"');
    expect(freeSection).not.toContain("skill-builders-card-list--grid");
    expect(memberSection).toContain("skill-builders-card-list--grid");
    expect(memberSection).toContain(">Sign in</span>");
    expect(memberSection).toContain(">Members only</span>");
    expect(comingSoon).toContain('class="skill-builders-card-list"');
    expect(comingSoon).not.toContain("skill-builders-card-list--grid");
    expect(catalog).toContain("grid-template-columns: repeat(3, minmax(0, 1fr))");
    expect(catalog).toContain("grid-template-columns: repeat(2, minmax(0, 1fr))");
    expect(catalog).toMatch(
      /@media \(max-width: 600px\) \{[\s\S]*?\.skill-builders-card-list--grid \{[\s\S]*?grid-template-columns: 1fr;/,
    );
    expect(catalog).toMatch(
      /\.skill-builders-card__subtitle \{[\s\S]*?font-weight: 400;/,
    );
    expect(catalog).toContain("border-left: 5px solid var(--kbm-accent, #C2614E)");
    expect(catalog).toContain("color-mix(in srgb, var(--kbm-accent, #C2614E) 7%, #ffffff)");
    expect(catalog).toMatch(
      /\.skill-builders-card--planned \{[\s\S]*?opacity: 0\.92;/,
    );
  });
});
