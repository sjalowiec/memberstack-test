import { describe, expect, it } from "vitest";
import {
  canCopySavedCustomPattern,
  SAVED_CUSTOM_PATTERN_COPY_DISABLED_TEXT,
  syncSavedCustomPatternCopyAccess,
} from "./savedCustomPatternCopyAccess";

function makeFakeButton() {
  const classes = new Set<string>();
  const attrs = new Map<string, string>();
  return {
    disabled: false,
    textContent: "Save a Copy",
    classList: {
      add: (c: string) => classes.add(c),
      remove: (c: string) => classes.delete(c),
      toggle: (c: string, on?: boolean) => {
        const next = on ?? !classes.has(c);
        if (next) classes.add(c);
        else classes.delete(c);
        return next;
      },
      contains: (c: string) => classes.has(c),
    },
    setAttribute: (k: string, v: string) => attrs.set(k, v),
    removeAttribute: (k: string) => attrs.delete(k),
    getAttribute: (k: string) => attrs.get(k) ?? null,
    hasClass: (c: string) => classes.has(c),
    hasAttr: (k: string) => attrs.has(k),
  };
}

function makeFakeHelper() {
  return {
    textContent: "",
    hidden: true,
    classList: { add: () => undefined, remove: () => undefined, toggle: () => undefined },
    setAttribute: () => undefined,
    removeAttribute: () => undefined,
  };
}

const MEMBER_URL = new URL("https://knit.test/patterns?customize=1");
const FREE_URL = new URL("https://knit.test/patterns?customize=0");

describe("canCopySavedCustomPattern", () => {
  it("is enabled for an active member / paid owner (edit access)", () => {
    expect(canCopySavedCustomPattern(MEMBER_URL)).toBe(true);
  });

  it("is disabled for a free / non-owner knitter", () => {
    expect(canCopySavedCustomPattern(FREE_URL)).toBe(false);
  });
});

describe("syncSavedCustomPatternCopyAccess", () => {
  it("enables the Copy button for members without a disabled tooltip", () => {
    const btn = makeFakeButton();
    const helper = makeFakeHelper();

    const allowed = syncSavedCustomPatternCopyAccess(
      btn as never,
      helper as never,
      MEMBER_URL,
    );

    expect(allowed).toBe(true);
    expect(btn.disabled).toBe(false);
    expect(btn.hasClass("is-disabled")).toBe(false);
    expect(btn.hasAttr("aria-disabled")).toBe(false);
    expect(helper.hidden).toBe(true);
    expect(helper.textContent).toBe("");
  });

  it("keeps Copy visible but disabled with helper text for free users", () => {
    const btn = makeFakeButton();
    const helper = makeFakeHelper();

    const allowed = syncSavedCustomPatternCopyAccess(
      btn as never,
      helper as never,
      FREE_URL,
    );

    expect(allowed).toBe(false);
    // Button stays clickable (native disabled=false) so the unlock modal can open;
    // visual/ARIA lock uses is-disabled + aria-disabled.
    expect(btn.textContent).toBe("Save a Copy");
    expect(btn.disabled).toBe(false);
    expect(btn.hasClass("is-disabled")).toBe(true);
    expect(btn.getAttribute("aria-disabled")).toBe("true");
    expect(btn.getAttribute("title")).toBe(SAVED_CUSTOM_PATTERN_COPY_DISABLED_TEXT);
    expect(helper.hidden).toBe(false);
    expect(helper.textContent).toBe(SAVED_CUSTOM_PATTERN_COPY_DISABLED_TEXT);
  });
});
