import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const catalog = readFileSync(
  join(process.cwd(), "src/pages/learn/skill-builders.astro"),
  "utf8",
);

describe("Skill Builders catalog landing", () => {
  it("uses a compact intro with the shared page header, then Try a Skill Builder Free", () => {
    expect(catalog).toContain('<SkillBuilderPageHeader title="Skill Builders" />');
    expect(catalog).toContain("Practice one machine-knitting skill at a time.");
    expect(catalog).toContain(
      "Short, focused exercises help you build confidence before you use the skill in a project.",
    );
    expect(catalog).toMatch(
      /<SkillBuilderPageHeader title="Skill Builders" \/>[\s\S]*skill-builders-hero__subtitle[\s\S]*skill-builders-hero__copy[\s\S]*skill-builders-hero__signature[\s\S]*id="skill-builders-free"[\s\S]*Try a Skill Builder Free/,
    );
  });

  it("keeps the handwritten quote after the intro, stronger but still secondary to the page title", () => {
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
    expect(catalog).toContain('font-family: "Kalam", cursive');
    expect(catalog).not.toContain('font-family: "Handlee"');
    expect(catalog).toContain("color: #A94F3D");
    expect(catalog).not.toContain("color: #C2614E");
    expect(catalog).toContain("white-space: nowrap");
    expect(catalog).toContain("white-space: normal");
    expect(catalog).toMatch(
      /\.skill-builders-hero__signature \{[\s\S]*?font-weight: 400;[\s\S]*?color: #A94F3D;/,
    );
    expect(catalog).toMatch(
      /@media \(min-width: 64rem\) \{[\s\S]*?\.skill-builders-hero__signature \{[\s\S]*?font-size: 1\.5rem;[\s\S]*?line-height: 1\.35;/,
    );
    expect(catalog).toMatch(
      /\.skill-builders-hero__signature \{[\s\S]*?text-transform: none;/,
    );
    const signatureCss = catalog.match(
      /\.skill-builders-hero__signature \{[^}]+\}/,
    )?.[0] ?? "";
    expect(signatureCss).toContain("font-weight: 400");
    expect(signatureCss).toContain('font-family: "Kalam", cursive');
    expect(signatureCss).toContain("font-size: clamp(1.28rem, 3.4vw, 1.5rem)");
    expect(signatureCss).not.toContain("font-weight: 600");
    expect(signatureCss).not.toContain("font-weight: bold");
    expect(signatureCss).not.toContain("text-shadow");
    expect(signatureCss).not.toContain("text-stroke");
    expect(signatureCss).not.toContain("background");
    expect(signatureCss).not.toContain("border");
    expect(catalog).toMatch(
      /<SkillBuilderPageHeader title="Skill Builders" \/>[\s\S]*skill-builders-hero__signature/,
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
      /Try a Skill Builder Free[\s\S]*More Skill Builders[\s\S]*data-sb-catalog="member"[\s\S]*Coming Soon/,
    );
    expect(catalog).toContain("data-sb-state");
    expect(catalog).toContain("Continue building your skills with Knit it Now membership.");
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
      catalog.indexOf('class="sb-featured"'),
      catalog.indexOf('id="skill-builders-members"'),
    );

    expect(freeConst).toContain("/learn/skill-builders/round-neckline-basics");
    expect(freeConst).not.toContain("round-necklines-shaped-shoulders");
    expect(freeConst).not.toContain("join-beautiful-shoulder-seams");
    expect(freeConst).not.toContain("e-wrap-cast-on-basics");
    expect(freeConst).not.toContain("round-neckline-practice");

    expect(memberConst).toContain("/learn/skill-builders/round-necklines-shaped-shoulders");
    expect(memberConst).toContain("/learn/skill-builders/join-beautiful-shoulder-seams");
    expect(memberConst).toContain("/learn/skill-builders/e-wrap-cast-on-basics");
    expect(memberConst).toContain("Round Neckline with Shaped Shoulders");
    expect(memberConst).toContain("E-Wrap Cast On Basics");
    expect(memberConst).toContain("Practice a quick, stretchy cast on that works on any knitting machine.");
    expect(memberConst).not.toContain("round-neckline-practice");
    expect(memberConst).not.toContain("round-neckline-basics");

    expect(freeConst).toContain("Round Neckline with Straight Shoulders");
    expect(freeConst).toContain(
      "Practice center bind-off, neckline decreases, and working each side separately.",
    );
    expect(freeConst).not.toContain("Practice shaping a round neckline with straight shoulders.");
    expect(memberConst).toContain(
      "Practice neckline shaping while working stepped shoulder shaping at the same time.",
    );
    expect(memberConst).not.toContain("Practice shaping a round neckline with shaped shoulders.");
    expect(freeConst).toContain(
      "/images/skill-builders/round-neckline-shallow-straight-shoulders.png",
    );
    expect(freeConst).not.toContain("round-neckline-deep-");
    expect(memberConst).toContain(
      "/images/skill-builders/round-neckline-shallow-shaped-shoulders.png",
    );
    expect(memberConst).toContain("/images/skill-builders/join-shoulder-seams.png");
    expect(memberConst).toContain("/images/skill-builders/e-wrap-cast-on.png");
    expect(memberConst).not.toContain("round-neckline-deep-");
    expect(memberConst).not.toContain("round-neckline-shallow-straight-shoulders");
    expect(freeSection).toContain("Learn to Shape a Round Neckline");
    expect(freeSection).toContain(
      "Practice the essential steps for shaping a round neckline before you use them in a sweater.",
    );
    expect(freeSection).toContain("<strong>Video Tutorial</strong>");
    expect(freeSection).toContain("Watch the technique up close on the knitting machine.");
    expect(freeSection).toContain("<strong>Printable Worksheet</strong>");
    expect(freeSection).toContain("Step-by-step instructions to keep beside your machine.");
    expect(freeSection).toContain("<strong>Use Your Own Gauge</strong>");
    expect(freeSection).toContain("Practice using your machine, yarn, and gauge.");
    expect(freeSection).not.toContain("Two hands-on practices");
    expect(freeSection).toContain("START FREE SKILL BUILDER");
    expect(freeSection).toContain("{freeSkillBuilder.href}");
    expect(freeSection).toContain(">Free</span>");
    expect(freeSection).not.toContain("{freeSkillBuilder.title}");
    expect(freeSection).not.toContain("memberSkillBuilders");
    expect(freeSection).not.toContain("Shallow Back Neckline");
    expect(freeSection).not.toContain("Deep Front Neckline");

    expect(guest).toContain("Try a Skill Builder Free");
    expect(guest).toContain("More Skill Builders");
    expect(guest).toContain("memberSkillBuilders.map");
    expect(guest).toContain(">Members only</span>");
    expect(guest).not.toContain(">Sign in</span>");
    expect(guest).not.toContain('data-sb-state="memberAccess"');

    expect(member).toContain('id="skill-builders-all"');
    expect(member).toContain(">Skill Builders</h2>");
    expect(member).toContain("allAvailableSkillBuilders");
    expect(member).toContain("skill-builders-card--visual");
    expect(member).toContain("skill-builders-card__media");
    expect(member).toContain("{item.image}");
    expect(member).not.toContain(">Free</span>");
    expect(member).not.toContain("Try a Skill Builder Free");
    expect(member).not.toContain("More Skill Builders");
    expect(member).not.toContain("Learn to Shape a Round Neckline");
    expect(member).not.toContain("band.jpg");
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

  it("uses a featured free panel, a quieter guest member grid, and compact guest Coming Soon", () => {
    const freeSection = catalog.slice(
      catalog.indexOf('class="sb-featured"'),
      catalog.indexOf('id="skill-builders-members"'),
    );
    const guest = catalog.slice(
      catalog.indexOf('data-sb-catalog="guest"'),
      catalog.indexOf('data-sb-catalog="member"'),
    );
    const memberSection = catalog.slice(
      catalog.indexOf('id="skill-builders-members"'),
      catalog.indexOf('data-sb-catalog="member"'),
    );
    const comingSoon = catalog.slice(
      catalog.indexOf('id="skill-builders-coming-soon"'),
      catalog.indexOf("<style>"),
    );

    expect(freeSection).toContain("sb-featured__panel");
    expect(freeSection).toContain("sb-featured__visual");
    expect(freeSection).toContain('src="/images/skill-builders/band.jpg"');
    expect(freeSection).toContain('alt="Finished machine-knit round neckline"');
    expect(freeSection).toContain("sb-featured__title");
    expect(freeSection).toContain("sb-featured__cta");
    expect(freeSection).not.toContain("skill-builders-card-list--grid");
    expect(freeSection).not.toContain("skill-builders-card--try");
    expect(memberSection).toContain("skill-builders-card-list--grid");
    expect(memberSection).toContain(">Members only</span>");
    expect(memberSection).not.toContain(">Sign in</span>");
    expect(guest).toContain('id="skill-builders-upcoming"');
    expect(guest).toContain('comingSoonItems.join(" · ")');
    expect(guest).not.toContain("skill-builders-card--planned");
    expect(guest).not.toContain("skill-builders-card--visual");
    expect(guest).not.toContain("Image coming");
    expect(comingSoon).toContain('class="skill-builders-card-list"');
    expect(comingSoon).toContain("skill-builders-card--planned");
    expect(comingSoon).not.toContain("skill-builders-card-list--grid");
    expect(comingSoon).not.toContain("skill-builders-card--visual");
    expect(comingSoon).not.toContain("Image coming");
    expect(catalog).toContain("[data-sb-catalog=\"member\"] .skill-builders-card__media");
    expect(catalog).toContain("aspect-ratio: 4 / 3");
    expect(catalog).toContain("object-fit: cover");
    expect(catalog).toContain("skill-builders-card__media--contain");
    expect(catalog).toContain("object-fit: contain");
    expect(guest).not.toContain("round-neckline-shallow-straight-shoulders.png");
    expect(guest).not.toContain("round-neckline-shallow-shaped-shoulders.png");
    expect(guest).not.toContain("join-shoulder-seams.png");
    expect(guest).not.toContain("e-wrap-cast-on.png");
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
    expect(catalog).toContain("border-left: 6px solid var(--kbm-accent, #C2614E)");
    expect(catalog).toMatch(
      /\.sb-featured__cta \{[\s\S]*?font-size: 0\.88rem;[\s\S]*?background: var\(--kbm-accent, #C2614E\);/,
    );
    expect(catalog).toContain("var(--kbm-accent-hover, #a94e3d)");
    expect(catalog).toContain(".sb-featured__visual");
    expect(catalog).toContain("[data-sb-catalog=\"guest\"] .skill-builders-card-list--grid .skill-builders-card--link");
    expect(catalog).toMatch(
      /\.skill-builders-card--planned \{[\s\S]*?opacity: 0\.92;/,
    );
  });
});
