import { describe, expect, it } from "vitest";
import {
  applyMembershipHeroHeading,
  MEMBERSHIP_HERO_HEADING_DEFAULT,
  membershipHeroWelcomeHeading,
} from "./membershipHero";

type StubEl = {
  textContent: string;
  attrs: Map<string, string>;
  setAttribute: (name: string, value: string) => void;
  getAttribute: (name: string) => string | null;
  matches: (selector: string) => boolean;
};

function el(matchers: string[]): StubEl {
  const attrs = new Map<string, string>();
  return {
    textContent: MEMBERSHIP_HERO_HEADING_DEFAULT,
    attrs,
    setAttribute: (name, value) => {
      attrs.set(name, value);
    },
    getAttribute: (name) => attrs.get(name) ?? null,
    matches: (selector) => matchers.includes(selector),
  };
}

function makeRoot(nodes: StubEl[]): ParentNode {
  const list = (selector: string) => nodes.filter((node) => node.matches(selector));
  return {
    querySelector: (selector: string) => list(selector)[0] ?? null,
    querySelectorAll: (selector: string) => list(selector) as unknown as NodeListOf<Element>,
  } as unknown as ParentNode;
}

describe("membershipHero", () => {
  it("personalizes with trimmed first name only", () => {
    expect(
      membershipHeroWelcomeHeading({
        data: { customFields: { "first-name": " Sue " } },
      }),
    ).toBe("Welcome back, Sue!");
    expect(
      membershipHeroWelcomeHeading({
        data: { auth: { firstName: "Mary" } },
      }),
    ).toBe("Welcome back, Mary!");
  });

  it("falls back to Welcome back! without exposing email", () => {
    expect(
      membershipHeroWelcomeHeading({
        data: { auth: { email: "sue@example.com" } },
      }),
    ).toBe("Welcome back!");
    expect(membershipHeroWelcomeHeading({ data: {} })).toBe("Welcome back!");
  });

  it("applies welcome vs default heading on the hero element", () => {
    const heading = el(["#membership-hero-heading"]);
    const root = makeRoot([heading]);

    applyMembershipHeroHeading("welcome", root, {
      data: { customFields: { "first-name": "John" } },
    });
    expect(heading.textContent).toBe("Welcome back, John!");
    expect(heading.getAttribute("data-membership-hero-heading")).toBe("welcome");

    applyMembershipHeroHeading("default", root);
    expect(heading.textContent).toBe("Knit it Now Membership");
    expect(heading.getAttribute("data-membership-hero-heading")).toBe("default");
  });
});
