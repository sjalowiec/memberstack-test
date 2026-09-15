import { describe, expect, it } from "vitest";
import { MY_PATTERNS_ACCOUNT_HREF, resolveSavedPatternAccessState } from "./savedPatternAccessState";
import {
  applySocksCatalogCardDestination,
  SOCKS_CATALOG_CARD_ATTR,
  SOCKS_CATALOG_DEFAULT_HREF,
} from "./socksCatalogCardAccess";

const MEMBER_ID = "mem_owner";

function cardRoot(): { root: ParentNode; hrefOf: () => string | null; busyOf: () => string | null } {
  const attrs = new Map<string, string>([["href", SOCKS_CATALOG_DEFAULT_HREF]]);
  const link = {
    setAttribute(name: string, value: string) {
      attrs.set(name, value);
    },
    removeAttribute(name: string) {
      attrs.delete(name);
    },
    getAttribute(name: string) {
      return attrs.get(name) ?? null;
    },
  };
  const root = {
    querySelectorAll(selector: string) {
      if (selector.includes(SOCKS_CATALOG_CARD_ATTR)) return [link];
      return [];
    },
  } as unknown as ParentNode;
  return {
    root,
    hrefOf: () => link.getAttribute("href"),
    busyOf: () => link.getAttribute("aria-busy"),
  };
}

describe("applySocksCatalogCardDestination", () => {
  it("keeps the public landing href while access is loading", () => {
    const { root, hrefOf, busyOf } = cardRoot();
    applySocksCatalogCardDestination(
      root,
      resolveSavedPatternAccessState({
        loading: true,
        loggedIn: true,
        memberId: MEMBER_ID,
        hasActiveAccess: true,
        hasOwnedPatterns: true,
        ownedPatternSystems: ["socks"],
      }),
    );
    expect(hrefOf()).toBe(SOCKS_CATALOG_DEFAULT_HREF);
    expect(busyOf()).toBe("true");
  });

  it("routes active members and former members with Socks to My Patterns", () => {
    const { root, hrefOf } = cardRoot();
    applySocksCatalogCardDestination(
      root,
      resolveSavedPatternAccessState({
        loggedIn: true,
        memberId: MEMBER_ID,
        hasActiveAccess: true,
        hasOwnedPatterns: false,
      }),
    );
    expect(hrefOf()).toBe(MY_PATTERNS_ACCOUNT_HREF);

    applySocksCatalogCardDestination(
      root,
      resolveSavedPatternAccessState({
        loggedIn: true,
        memberId: MEMBER_ID,
        hasActiveAccess: false,
        hasOwnedPatterns: true,
        ownedPatternSystems: ["socks"],
      }),
    );
    expect(hrefOf()).toBe(MY_PATTERNS_ACCOUNT_HREF);
  });

  it("routes logged-out visitors and accounts without Socks to the public landing", () => {
    const { root, hrefOf } = cardRoot();
    applySocksCatalogCardDestination(
      root,
      resolveSavedPatternAccessState({
        loggedIn: false,
        hasActiveAccess: false,
        hasOwnedPatterns: false,
      }),
    );
    expect(hrefOf()).toBe(SOCKS_CATALOG_DEFAULT_HREF);

    applySocksCatalogCardDestination(
      root,
      resolveSavedPatternAccessState({
        loggedIn: true,
        memberId: MEMBER_ID,
        hasActiveAccess: false,
        hasOwnedPatterns: false,
      }),
    );
    expect(hrefOf()).toBe(SOCKS_CATALOG_DEFAULT_HREF);
  });
});
