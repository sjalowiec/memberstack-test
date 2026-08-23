import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  applyHomeHeroPromo,
  HOME_CTA_GUEST_COPY,
  HOME_CTA_GUEST_HEADING,
  HOME_HERO_GUEST_COPY,
  HOME_HERO_GUEST_HEADING,
  HOME_HERO_MEMBER_COPY,
  HOME_HERO_MEMBER_HEADING,
  HOME_HERO_MEMBER_SECONDARY_HREF,
  HOME_HERO_MEMBER_SECONDARY_LABEL,
  HOME_HERO_PROMO_BOUND_ATTR,
  initHomeHeroPromo,
  resetHomeHeroPromoBindForTests,
  resolveHomeHeroPromoMode,
} from "./homeHeroPromo";

const here = dirname(fileURLToPath(import.meta.url));
const indexAstro = readFileSync(join(here, "../../pages/index.astro"), "utf8");
const promoSource = readFileSync(join(here, "homeHeroPromo.ts"), "utf8");

type StubEl = {
  hidden: boolean;
  dataset: Record<string, string>;
  attrs: Map<string, string>;
  setAttribute: (name: string, value: string) => void;
  getAttribute: (name: string) => string | null;
  querySelector: (selector: string) => StubEl | null;
};

function el(): StubEl {
  const attrs = new Map<string, string>();
  const dataset: Record<string, string> = {};
  const node: StubEl = {
    hidden: false,
    dataset,
    attrs,
    setAttribute(name, value) {
      attrs.set(name, value);
      if (name === "data-home-promo-state") dataset.homePromoState = value;
      if (name === HOME_HERO_PROMO_BOUND_ATTR) attrs.set(name, value);
    },
    getAttribute(name) {
      return attrs.get(name) ?? null;
    },
    querySelector() {
      return null;
    },
  };
  return node;
}

function makePromoTree() {
  const guest = el();
  const member = el();
  member.hidden = true;
  const box = el();
  box.dataset.homePromoState = "pending";
  box.setAttribute("data-home-promo-state", "pending");
  box.querySelector = (selector: string) => {
    if (selector.includes('="guest"')) return guest;
    if (selector.includes('="member"')) return member;
    return null;
  };

  const hero = el();
  hero.setAttribute("aria-labelledby", "home-hero-heading");

  const root = {
    querySelectorAll(selector: string) {
      if (selector.includes("data-home-promo") && !selector.includes("panel")) {
        return [box] as unknown as NodeListOf<HTMLElement>;
      }
      return [] as unknown as NodeListOf<HTMLElement>;
    },
    querySelector(selector: string) {
      if (selector === "[data-home-hero]") return hero as unknown as HTMLElement;
      if (selector === "[data-home-cta]") return null;
      if (selector.includes("data-home-promo") && !selector.includes("panel")) {
        return box as unknown as HTMLElement;
      }
      return box.querySelector(selector) as unknown as HTMLElement | null;
    },
  } as unknown as ParentNode;

  return { root, box, guest, member, hero };
}

describe("resolveHomeHeroPromoMode", () => {
  it("stays pending until the sitewide snapshot exists", () => {
    expect(resolveHomeHeroPromoMode(null)).toBe("pending");
    expect(resolveHomeHeroPromoMode(undefined)).toBe("pending");
    expect(resolveHomeHeroPromoMode({})).toBe("pending");
  });

  it("shows the member welcome only for active member access", () => {
    expect(
      resolveHomeHeroPromoMode({
        hasMemberAccess: true,
        viewerAccessState: "memberAccess",
      }),
    ).toBe("member");
    expect(resolveHomeHeroPromoMode({ hasMemberAccess: true })).toBe("member");
    expect(resolveHomeHeroPromoMode({ viewerAccessState: "memberAccess" })).toBe("member");
  });

  it("keeps the join invitation for guests and logged-in non-members", () => {
    expect(
      resolveHomeHeroPromoMode({
        hasMemberAccess: false,
        viewerAccessState: "loggedOut",
      }),
    ).toBe("guest");
    expect(
      resolveHomeHeroPromoMode({
        hasMemberAccess: false,
        viewerAccessState: "loggedInNoAccess",
      }),
    ).toBe("guest");
  });
});

describe("applyHomeHeroPromo", () => {
  it("suppresses the entire promo card while pending", () => {
    const { root, box, guest, member } = makePromoTree();
    applyHomeHeroPromo(root, "pending");

    expect(box.dataset.homePromoState).toBe("pending");
    expect(box.getAttribute("aria-busy")).toBe("true");
    expect(box.getAttribute("aria-hidden")).toBe("true");
    expect(guest.hidden).toBe(true);
    expect(guest.getAttribute("aria-hidden")).toBe("true");
    expect(member.hidden).toBe(true);
  });

  it("reveals the guest invitation only after auth resolves as guest", () => {
    const { root, box, guest, member, hero } = makePromoTree();
    applyHomeHeroPromo(root, "guest");

    expect(box.getAttribute("aria-hidden")).toBe("false");
    expect(guest.hidden).toBe(false);
    expect(guest.getAttribute("aria-hidden")).toBe("false");
    expect(member.hidden).toBe(true);
    expect(hero.getAttribute("aria-labelledby")).toBe("home-hero-heading");
  });

  it("swaps to the member welcome without leaving the join CTA visible", () => {
    const { root, box, guest, member, hero } = makePromoTree();
    applyHomeHeroPromo(root, "member");

    expect(guest.hidden).toBe(true);
    expect(guest.getAttribute("aria-hidden")).toBe("true");
    expect(member.hidden).toBe(false);
    expect(box.getAttribute("aria-hidden")).toBe("false");
    expect(member.getAttribute("aria-hidden")).toBe("false");
    expect(hero.getAttribute("aria-labelledby")).toBe("home-hero-heading-member");
  });
});

describe("initHomeHeroPromo", () => {
  afterEach(() => {
    resetHomeHeroPromoBindForTests();
    vi.unstubAllGlobals();
  });

  it("stays pending with no snapshot and never defaults to the guest message", () => {
    const host = new EventTarget();
    vi.stubGlobal(
      "window",
      Object.assign(host, { __KIN_MEMBER_ACCESS__: undefined }),
    );
    const { root, box, guest } = makePromoTree();

    initHomeHeroPromo(root);

    expect(box.dataset.homePromoState).toBe("pending");
    expect(box.getAttribute("aria-hidden")).toBe("true");
    expect(guest.hidden).toBe(true);
    expect(guest.getAttribute("aria-hidden")).toBe("true");
  });

  it("applies an existing BaseLayout snapshot immediately", () => {
    const host = new EventTarget();
    vi.stubGlobal(
      "window",
      Object.assign(host, {
        __KIN_MEMBER_ACCESS__: {
          hasMemberAccess: true,
          viewerAccessState: "memberAccess",
        },
      }),
    );
    const { root, member, guest } = makePromoTree();

    initHomeHeroPromo(root);

    expect(member.hidden).toBe(false);
    expect(guest.hidden).toBe(true);
  });

  it("listens for kin:member-access instead of fetching Memberstack", () => {
    const host = new EventTarget();
    const fakeWindow = Object.assign(host, { __KIN_MEMBER_ACCESS__: null });
    vi.stubGlobal("window", fakeWindow);
    const { root, box, member, guest } = makePromoTree();

    initHomeHeroPromo(root);
    expect(box.dataset.homePromoState).toBe("pending");
    expect(guest.hidden).toBe(true);

    fakeWindow.dispatchEvent(
      new CustomEvent("kin:member-access", {
        detail: { hasMemberAccess: true, viewerAccessState: "memberAccess" },
      }),
    );

    expect(member.hidden).toBe(false);
    expect(guest.hidden).toBe(true);
  });
});

describe("homepage promo markup contract", () => {
  it("does not add a new Memberstack auth check", () => {
    expect(promoSource).toContain("__KIN_MEMBER_ACCESS__");
    expect(promoSource).toContain("kin:member-access");
    expect(promoSource).not.toContain("getCurrentMember");
    expect(promoSource).not.toContain("getAppAndMember");
    expect(promoSource).not.toContain("$memberstackDom");
  });

  it("keeps the guest hero invitation unchanged", () => {
    expect(HOME_HERO_GUEST_HEADING).toBe(
      "Learn, build skills, and machine knit with confidence.",
    );
    expect(HOME_HERO_GUEST_COPY).toContain("less time guessing and more time knitting");
    expect(HOME_CTA_GUEST_HEADING).toBe("Ready to explore?");
    expect(HOME_CTA_GUEST_COPY).toContain("we'd love to have you join.");
    expect(indexAstro).toContain("{HOME_HERO_GUEST_HEADING}");
    expect(indexAstro).toContain("{HOME_HERO_GUEST_COPY}");
    expect(indexAstro).toContain("{HOME_CTA_GUEST_HEADING}");
    expect(indexAstro).toContain("{HOME_CTA_GUEST_COPY}");
    expect(indexAstro).toMatch(
      /data-home-promo-panel="guest"[\s\S]*?Become a Member[\s\S]*?Already a member\?/,
    );
  });

  it("gives active members a welcome/action message instead of a join CTA", () => {
    expect(HOME_HERO_MEMBER_HEADING).toBe("Welcome back.");
    expect(HOME_HERO_MEMBER_COPY).toContain("Your membership is ready");
    expect(HOME_HERO_MEMBER_SECONDARY_LABEL).toBe("Create a Pattern");
    expect(HOME_HERO_MEMBER_SECONDARY_HREF).toBe("/patterns");
    expect(indexAstro).toContain("{HOME_HERO_MEMBER_HEADING}");
    expect(indexAstro).toContain("{HOME_HERO_MEMBER_COPY}");
    expect(indexAstro).toContain("{HOME_HERO_MEMBER_SECONDARY_LABEL}");
    expect(indexAstro).toContain("href={HOME_HERO_MEMBER_SECONDARY_HREF}");

    const heroMemberStart = indexAstro.indexOf('data-home-promo-panel="member"');
    const heroMemberEnd = indexAstro.indexOf("SECTION 2");
    const heroMember = indexAstro.slice(heroMemberStart, heroMemberEnd);
    expect(heroMember).toContain("HOME_HERO_MEMBER_SECONDARY_LABEL");
    expect(heroMember).not.toContain("Become a Member");
    expect(heroMember).not.toContain("/membership");
  });

  it("starts pending so the entire promo card cannot flash during auth load", () => {
    expect(indexAstro).toContain('data-home-promo-state="pending"');
    expect(indexAstro).toContain("initHomeHeroPromo");
    expect(indexAstro).toMatch(
      /\[data-home-promo\]\[data-home-promo-state="pending"\]\s*\{[\s\S]*?visibility:\s*hidden/,
    );
    expect(indexAstro).toMatch(
      /\[data-home-promo\]\[data-home-promo-state="pending"\]\s*\{[\s\S]*?opacity:\s*0/,
    );
  });
});
