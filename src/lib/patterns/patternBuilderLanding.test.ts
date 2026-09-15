import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  hasPatternBuilderLandingChoices,
  hasPatternBuilderLandingCopy,
  hasPatternBuilderLandingKnitAble,
  hasPatternBuilderLandingMembership,
  type PatternBuilderLandingContent,
} from "./patternBuilderLanding";
import {
  applyPatternBuilderLandingCtaMode,
  resolvePatternBuilderLandingCtaMode,
} from "./patternBuilderLandingCta";
import { MEMBERSHIPS } from "../../config/memberships";

const pageComponent = readFileSync(
  resolve("src/components/patterns/PatternBuilderLandingPage.astro"),
  "utf8",
);
const heroComponent = readFileSync(
  resolve("src/components/patterns/PatternBuilderLandingHero.astro"),
  "utf8",
);

function minimalLanding(
  overrides: Partial<PatternBuilderLandingContent> = {},
): PatternBuilderLandingContent {
  return {
    patternName: "Example Pattern Builder",
    headline: "A pattern for your yarn and gauge",
    intro: "Choose size and gauge.",
    image: { src: "/images/example.png", alt: "Example pattern" },
    seo: {
      title: "Example Pattern Builder | Knit it Now",
      description: "Example landing description.",
      canonicalUrl: "https://knititnow.com/patterns/example",
    },
    cta: {
      memberLabel: "Create My Pattern",
      memberHref: "/patterns/example/builder?new=1",
      prospectLabel: "Become a Member",
      prospectHref: "/membership",
      signInLabel: "Already a member? Sign in",
      membershipHeading: "Included with Knit It Now membership",
      membershipBody: "This Pattern Builder is included with membership.",
      checkingLabel: "Checking membership…",
    },
    ...overrides,
  };
}

function mockHiddenEl(hidden: boolean) {
  return { hidden };
}

describe("pattern builder landing content model", () => {
  it("accepts pattern-specific copy through the shared content object", () => {
    const hatLike = minimalLanding({
      patternName: "Basic Hat Pattern Builder",
      headline: "A hat that fits",
      cta: {
        ...minimalLanding().cta,
        memberLabel: "Create My Hat Pattern",
        memberHref: "/patterns/hat/builder?new=1",
      },
    });

    expect(hatLike.patternName).toBe("Basic Hat Pattern Builder");
    expect(hatLike.cta.memberHref).toBe("/patterns/hat/builder?new=1");
    expect(pageComponent).toContain("content: PatternBuilderLandingContent");
    expect(pageComponent).toContain("<PatternBuilderLandingHero content={content} />");
    expect(pageComponent).toContain("socksSavedPatternRedirect");
    expect(pageComponent).toContain("data-socks-saved-pattern-landing");
    expect(heroComponent).toContain("{patternName}");
    expect(heroComponent).toContain("{headline}");
    expect(heroComponent).toContain("{cta.memberHref}");
  });

  it("omits optional copy and choice blocks when they are empty", () => {
    const withoutOptional = minimalLanding();
    expect(hasPatternBuilderLandingCopy(withoutOptional.why)).toBe(false);
    expect(hasPatternBuilderLandingChoices(withoutOptional.choices)).toBe(false);
    expect(hasPatternBuilderLandingCopy(withoutOptional.creates)).toBe(false);
    expect(hasPatternBuilderLandingCopy(withoutOptional.anyYarn)).toBe(false);
    expect(hasPatternBuilderLandingKnitAble(withoutOptional.knitAble)).toBe(false);

    expect(hasPatternBuilderLandingCopy({ heading: "Why", body: [] })).toBe(false);
    expect(hasPatternBuilderLandingCopy({ heading: "", body: ["Hello"] })).toBe(false);
    expect(hasPatternBuilderLandingChoices({ heading: "What you choose", items: [] })).toBe(false);
    expect(
      hasPatternBuilderLandingMembership({
        ...withoutOptional.cta,
        membershipHeading: "",
        membershipBody: "",
      }),
    ).toBe(false);

    expect(pageComponent).toContain("hasPatternBuilderLandingCopy(content.why)");
    expect(pageComponent).toContain("hasPatternBuilderLandingChoices(content.choices)");
    expect(pageComponent).toContain("hasPatternBuilderLandingCopy(content.creates)");
    expect(pageComponent).toContain("hasPatternBuilderLandingCopy(content.anyYarn)");
    expect(pageComponent).toContain("hasPatternBuilderLandingKnitAble(content.knitAble)");
    expect(pageComponent).toContain("hasPatternBuilderLandingMembership(content.cta)");
    expect(pageComponent).toContain("{why ? <PatternBuilderLandingWhy section={why} /> : null}");
    expect(pageComponent).toContain(
      "{choices ? <PatternBuilderLandingChoices section={choices} /> : null}",
    );
    expect(pageComponent).toContain(
      "{creates ? <PatternBuilderLandingCreates section={creates} /> : null}",
    );
    expect(pageComponent).toContain(
      "{anyYarn ? <PatternBuilderLandingAnyYarn section={anyYarn} /> : null}",
    );
    expect(pageComponent).toContain(
      "{knitAble ? <PatternBuilderLandingKnitAble section={knitAble} /> : null}",
    );
    expect(pageComponent).toContain(
      "{membership ? <PatternBuilderLandingMembershipCta cta={membership} /> : null}",
    );
    expect(pageComponent).not.toMatch(/<section[^>]*>\s*\{content\.why/);
  });

  it("still accepts optional needles-available choices and extra membership copy for other builders", () => {
    const sweaterLike = minimalLanding({
      choices: {
        heading: "What you choose",
        items: [
          { title: "Size", description: "Choose a size." },
          { title: "Needles available", description: "Enter working needles." },
        ],
      },
      cta: {
        ...minimalLanding().cta,
        membershipNote:
          "Patterns you create remain in your account after membership ends.",
      },
    });

    expect(hasPatternBuilderLandingChoices(sweaterLike.choices)).toBe(true);
    expect(sweaterLike.choices?.items.map((item) => item.title)).toContain("Needles available");
    expect(sweaterLike.cta.membershipNote).toBeTruthy();
    expect(minimalLanding().cta.membershipNote).toBeUndefined();

    const membership = readFileSync(
      resolve("src/components/patterns/PatternBuilderLandingMembershipCta.astro"),
      "utf8",
    );
    expect(membership).toContain("cta.membershipNote?.trim()");
  });

  it("keeps the optional why section available for future Pattern Builder pages", () => {
    const withWhy = minimalLanding({
      why: {
        heading: "Why use this builder?",
        body: ["A future Pattern Builder can still use this section."],
      },
    });
    expect(hasPatternBuilderLandingCopy(withWhy.why)).toBe(true);
    expect(withWhy.why?.heading).toBe("Why use this builder?");
    const whyComponent = readFileSync(
      resolve("src/components/patterns/PatternBuilderLandingWhy.astro"),
      "utf8",
    );
    expect(whyComponent).toContain("PatternBuilderLandingCopySection");
    expect(pageComponent).toContain("PatternBuilderLandingWhy");
  });

  it("renders nothing when no Knit-able configuration is supplied", () => {
    expect(hasPatternBuilderLandingKnitAble(undefined)).toBe(false);
    expect(hasPatternBuilderLandingKnitAble(minimalLanding().knitAble)).toBe(false);
    expect(pageComponent).toContain(
      "{knitAble ? <PatternBuilderLandingKnitAble section={knitAble} /> : null}",
    );
    const knitAbleComponent = readFileSync(
      resolve("src/components/patterns/PatternBuilderLandingKnitAble.astro"),
      "utf8",
    );
    expect(knitAbleComponent).not.toContain("Teenage Kicks");
    expect(knitAbleComponent).not.toContain("/knit-ables/teenage-kicks-socks");
  });
});

describe("pattern builder landing CTA mode", () => {
  it("shows prospect CTAs for visitors and logged-in users without access", () => {
    expect(resolvePatternBuilderLandingCtaMode(null)).toBe("prospect");
    expect(
      resolvePatternBuilderLandingCtaMode({
        data: { id: "ms_nosub", planConnections: [] },
      }),
    ).toBe("prospect");
  });

  it("shows the member CTA only for active members", () => {
    expect(
      resolvePatternBuilderLandingCtaMode({
        data: {
          id: "ms_member",
          planConnections: [
            {
              planId: MEMBERSHIPS.membership.memberstackPlanId,
              status: "ACTIVE",
              active: true,
            },
          ],
        },
      }),
    ).toBe("member");
  });

  it("starts pending so the wrong CTA cannot flash, then reveals one mode", () => {
    const loading = mockHiddenEl(false);
    const member = mockHiddenEl(true);
    const prospect = mockHiddenEl(true);
    const membership = mockHiddenEl(true);
    const root = {
      dataset: {} as Record<string, string>,
      querySelectorAll(selector: string) {
        if (selector === "[data-pattern-builder-landing-cta-loading]") return [loading];
        if (selector === "[data-pattern-builder-landing-cta-member]") return [member];
        if (selector === "[data-pattern-builder-landing-cta-prospect]") return [prospect];
        if (selector === "[data-pattern-builder-landing-membership]") return [membership];
        return [];
      },
    } as unknown as HTMLElement;

    applyPatternBuilderLandingCtaMode(root, "pending");
    expect(root.dataset.ctaMode).toBe("pending");
    expect(loading.hidden).toBe(false);
    expect(member.hidden).toBe(true);
    expect(prospect.hidden).toBe(true);
    expect(membership.hidden).toBe(true);

    applyPatternBuilderLandingCtaMode(root, "prospect");
    expect(loading.hidden).toBe(true);
    expect(member.hidden).toBe(true);
    expect(prospect.hidden).toBe(false);
    expect(membership.hidden).toBe(false);

    applyPatternBuilderLandingCtaMode(root, "member");
    expect(loading.hidden).toBe(true);
    expect(member.hidden).toBe(false);
    expect(prospect.hidden).toBe(true);
    expect(membership.hidden).toBe(true);
  });
});
