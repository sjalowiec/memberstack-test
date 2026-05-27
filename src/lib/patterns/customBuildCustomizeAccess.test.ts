import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  canAccessCustomBuildStyleAndShaping,
  CUSTOM_BUILD_STYLE_STEP_LOCKED_TITLE,
  CUSTOM_BUILD_WORKSPACE_CUSTOMIZE_LOCKED_LABEL,
  syncCustomBuildCustomizeAccessChrome,
} from "./customBuildCustomizeAccess";

const DENIED_URL = new URL(
  "https://example.test/patterns/sleeveless/custom-build/design?customize=0",
);

describe("canAccessCustomBuildStyleAndShaping", () => {
  it("allows access by default for dev", () => {
    expect(canAccessCustomBuildStyleAndShaping(new URL("https://example.test/design"))).toBe(true);
  });

  it("denies access when customize=0 is on the URL", () => {
    expect(canAccessCustomBuildStyleAndShaping(DENIED_URL)).toBe(false);
  });
});

describe("syncCustomBuildCustomizeAccessChrome", () => {
  beforeEach(() => {
    vi.stubGlobal("document", {
      documentElement: { classList: { toggle: vi.fn() } },
    });
  });

  it("locks workspace Customize tab and Style pills when access is denied", () => {
    const customizeTab = {
      attrs: {} as Record<string, string>,
      classes: new Set<string>(),
      classList: {
        add: (...tokens: string[]) => tokens.forEach((c) => customizeTab.classes.add(c)),
        remove: (...tokens: string[]) => tokens.forEach((c) => customizeTab.classes.delete(c)),
        contains: (c: string) => customizeTab.classes.has(c),
      },
      setAttribute(n: string, v: string) {
        customizeTab.attrs[n] = v;
      },
      getAttribute(n: string) {
        return customizeTab.attrs[n] ?? (n === "data-tab" ? "custom" : null);
      },
      removeAttribute(n: string) {
        delete customizeTab.attrs[n];
      },
      hasAttribute(n: string) {
        return n in customizeTab.attrs;
      },
    };

    const stylePill = {
      attrs: {} as Record<string, string>,
      classList: { add: vi.fn(), remove: vi.fn() },
      getAttribute(n: string) {
        if (n === "data-cb-flow-pill") return "2";
        if (n === "data-cb-flow-label") return "Style & Shaping";
        return stylePill.attrs[n] ?? null;
      },
      setAttribute(n: string, v: string) {
        stylePill.attrs[n] = v;
      },
      removeAttribute(n: string) {
        delete stylePill.attrs[n];
      },
    };

    const continueLink = {
      attrs: {} as Record<string, string>,
      classList: { add: vi.fn(), remove: vi.fn() },
      setAttribute(n: string, v: string) {
        continueLink.attrs[n] = v;
      },
      removeAttribute(n: string) {
        delete continueLink.attrs[n];
      },
      getAttribute(n: string) {
        return continueLink.attrs[n] ?? null;
      },
    };

    const root = {
      querySelectorAll(sel: string) {
        if (sel === '[data-tab="custom"]') return [customizeTab];
        if (sel === "[data-cb-flow-pill]") return [stylePill];
        if (sel === "[data-cb-continue-link]") return [continueLink];
        return [];
      },
    };

    syncCustomBuildCustomizeAccessChrome(root as unknown as ParentNode, DENIED_URL);

    expect(customizeTab.classes.has("kbm-customize-tab--locked")).toBe(true);
    expect(customizeTab.attrs["aria-disabled"]).toBe("true");
    expect(customizeTab.attrs.title).toBe(CUSTOM_BUILD_WORKSPACE_CUSTOMIZE_LOCKED_LABEL);
    expect(stylePill.attrs["aria-disabled"]).toBe("true");
    expect(stylePill.attrs.title).toBe(CUSTOM_BUILD_STYLE_STEP_LOCKED_TITLE);
    expect(continueLink.attrs["data-cb-customize-entitlement-locked"]).toBe("true");
  });
});
