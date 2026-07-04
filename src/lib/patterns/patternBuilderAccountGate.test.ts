import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Default deps come from these modules; mock them so we can assert the gate reuses them
// without pulling in the real Memberstack / DOM stack.
const isSleevelessPatternMemberLoggedIn = vi.fn<[], Promise<boolean>>();
const showPublicSignupModal = vi.fn<[], boolean>();
const openMemberstackLoginModal = vi.fn<[string?], void>();

vi.mock("./sleevelessPatternLoginGate", () => ({
  isSleevelessPatternMemberLoggedIn: () => isSleevelessPatternMemberLoggedIn(),
}));
vi.mock("../publicSignupModal", () => ({
  showPublicSignupModal: () => showPublicSignupModal(),
}));
vi.mock("../memberstackLogin", () => ({
  openMemberstackLoginModal: (returnPath?: string) => openMemberstackLoginModal(returnPath),
}));

import {
  ensurePatternBuilderAccount,
  initPatternBuilderAccountGate,
  installPatternBuilderAccountGate,
  showPatternBuilderAccountGate,
} from "./patternBuilderAccountGate";

beforeEach(() => {
  isSleevelessPatternMemberLoggedIn.mockReset();
  showPublicSignupModal.mockReset();
  openMemberstackLoginModal.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/** Minimal fake button that records its click handler so tests can trigger it. */
function makeButton() {
  let clickHandler: ((event: { preventDefault: () => void }) => void) | undefined;
  return {
    addEventListener(type: string, fn: (event: { preventDefault: () => void }) => void) {
      if (type === "click") clickHandler = fn;
    },
    click() {
      clickHandler?.({ preventDefault() {} });
    },
    get wired() {
      return typeof clickHandler === "function";
    },
  };
}

/** Minimal fake <dialog> + root container for the account gate modal. */
function makeDialogFixture() {
  const buttons: Record<string, ReturnType<typeof makeButton>[]> = {
    "[data-account-gate-signup]": [makeButton()],
    "[data-account-gate-login]": [makeButton()],
    "[data-account-gate-dismiss]": [makeButton()],
  };
  const attrs: Record<string, string> = {};
  const dialog = {
    open: false,
    showModal: vi.fn(function showModal(this: { open: boolean }) {
      dialog.open = true;
    }),
    close: vi.fn(function close() {
      dialog.open = false;
    }),
    getAttribute: (k: string) => attrs[k] ?? null,
    setAttribute: (k: string, v: string) => {
      attrs[k] = v;
    },
    querySelectorAll: (sel: string) => buttons[sel] ?? [],
    addEventListener: vi.fn(),
  };
  const root = {
    querySelector: (_sel: string) => dialog,
  } as unknown as ParentNode;
  return { dialog, root, buttons };
}

describe("ensurePatternBuilderAccount - logged-out visitors see the signup-first prompt", () => {
  it("Hat Create: blocks generation and opens the account prompt", async () => {
    const openAccountPrompt = vi.fn();
    const allowed = await ensurePatternBuilderAccount({
      isLoggedIn: async () => false,
      openAccountPrompt,
    });
    expect(allowed).toBe(false);
    expect(openAccountPrompt).toHaveBeenCalledTimes(1);
  });

  it("Hat Pattern tab: blocks access and opens the account prompt", async () => {
    const openAccountPrompt = vi.fn();
    const allowed = await ensurePatternBuilderAccount({
      isLoggedIn: async () => false,
      openAccountPrompt,
    });
    expect(allowed).toBe(false);
    expect(openAccountPrompt).toHaveBeenCalledTimes(1);
  });

  it("Blanket Create: blocks generation and opens the account prompt", async () => {
    const openAccountPrompt = vi.fn();
    const allowed = await ensurePatternBuilderAccount({
      isLoggedIn: async () => false,
      openAccountPrompt,
    });
    expect(allowed).toBe(false);
    expect(openAccountPrompt).toHaveBeenCalledTimes(1);
  });

  it("Blanket Pattern tab: blocks access and opens the account prompt", async () => {
    const openAccountPrompt = vi.fn();
    const allowed = await ensurePatternBuilderAccount({
      isLoggedIn: async () => false,
      openAccountPrompt,
    });
    expect(allowed).toBe(false);
    expect(openAccountPrompt).toHaveBeenCalledTimes(1);
  });

  it("treats an errored account check as logged-out (never silently proceeds)", async () => {
    const openAccountPrompt = vi.fn();
    const allowed = await ensurePatternBuilderAccount({
      isLoggedIn: async () => {
        throw new Error("memberstack unavailable");
      },
      openAccountPrompt,
    });
    expect(allowed).toBe(false);
    expect(openAccountPrompt).toHaveBeenCalledTimes(1);
  });

  it("default prompt shows the signup-first gate modal", async () => {
    const { dialog } = makeDialogFixture();
    vi.stubGlobal("document", { querySelector: () => dialog });
    isSleevelessPatternMemberLoggedIn.mockResolvedValue(false);

    const allowed = await ensurePatternBuilderAccount();

    expect(allowed).toBe(false);
    expect(dialog.showModal).toHaveBeenCalledTimes(1);
  });
});

describe("ensurePatternBuilderAccount - logged-in visitors generate for free (no membership gate)", () => {
  it("logged-in with no subscription can generate (no prompt)", async () => {
    const openAccountPrompt = vi.fn();
    const allowed = await ensurePatternBuilderAccount({
      isLoggedIn: async () => true,
      openAccountPrompt,
    });
    expect(allowed).toBe(true);
    expect(openAccountPrompt).not.toHaveBeenCalled();
  });

  it("Member / Beta account can generate (no prompt)", async () => {
    const openAccountPrompt = vi.fn();
    const allowed = await ensurePatternBuilderAccount({
      isLoggedIn: async () => true,
      openAccountPrompt,
    });
    expect(allowed).toBe(true);
    expect(openAccountPrompt).not.toHaveBeenCalled();
  });

  it("applies NO entitlement/free-claim check: login alone (via shared helper) permits generation", async () => {
    // Default deps: the only gate is isSleevelessPatternMemberLoggedIn. A logged-in visitor is
    // allowed regardless of subscription/free claims, and no login/signup modal is shown.
    isSleevelessPatternMemberLoggedIn.mockResolvedValue(true);

    const allowed = await ensurePatternBuilderAccount();

    expect(allowed).toBe(true);
    expect(isSleevelessPatternMemberLoggedIn).toHaveBeenCalledTimes(1);
    expect(showPublicSignupModal).not.toHaveBeenCalled();
    expect(openMemberstackLoginModal).not.toHaveBeenCalled();
  });
});

describe("showPatternBuilderAccountGate", () => {
  it("opens the dialog when present", () => {
    const { dialog, root } = makeDialogFixture();
    expect(showPatternBuilderAccountGate({ root })).toBe(true);
    expect(dialog.showModal).toHaveBeenCalledTimes(1);
  });

  it("returns false when no dialog exists", () => {
    vi.stubGlobal("document", { querySelector: () => null });
    expect(showPatternBuilderAccountGate()).toBe(false);
  });
});

describe("initPatternBuilderAccountGate - modal CTAs", () => {
  it("primary CTA routes to public signup, secondary CTA opens login", () => {
    const openSignup = vi.fn();
    const openLogin = vi.fn();
    const { dialog, root, buttons } = makeDialogFixture();

    initPatternBuilderAccountGate(root, { openSignup, openLogin });

    dialog.open = true; // dialog is shown when the user clicks a CTA
    buttons["[data-account-gate-signup]"][0].click();
    expect(openSignup).toHaveBeenCalledTimes(1);
    expect(openLogin).not.toHaveBeenCalled();
    expect(dialog.close).toHaveBeenCalledTimes(1);

    dialog.open = true;
    buttons["[data-account-gate-login]"][0].click();
    expect(openLogin).toHaveBeenCalledTimes(1);
    expect(openSignup).toHaveBeenCalledTimes(1);
    expect(dialog.close).toHaveBeenCalledTimes(2);
  });

  it("is idempotent per dialog instance (binds once)", () => {
    const { root, buttons } = makeDialogFixture();
    initPatternBuilderAccountGate(root, { openSignup: vi.fn(), openLogin: vi.fn() });
    // Second call should no-op because the dialog is already marked bound.
    initPatternBuilderAccountGate(root, { openSignup: vi.fn(), openLogin: vi.fn() });
    expect(buttons["[data-account-gate-signup]"][0].wired).toBe(true);
  });
});

describe("installPatternBuilderAccountGate (hat inline-script bridge)", () => {
  it("installs window globals that gate via the shared helper", async () => {
    const { dialog } = makeDialogFixture();
    vi.stubGlobal("window", {} as Window & typeof globalThis);
    vi.stubGlobal("document", { querySelector: () => dialog });
    isSleevelessPatternMemberLoggedIn.mockResolvedValue(false);

    installPatternBuilderAccountGate();

    expect(typeof window.kbmEnsurePatternBuilderAccountGate).toBe("function");
    expect(typeof window.kbmOpenPatternBuilderAccountPrompt).toBe("function");
    await expect(window.kbmEnsurePatternBuilderAccountGate!()).resolves.toBe(false);
    expect(dialog.showModal).toHaveBeenCalledTimes(1);
  });

  it("no-ops safely when there is no window (SSR)", () => {
    vi.stubGlobal("window", undefined);
    expect(() => installPatternBuilderAccountGate()).not.toThrow();
  });
});
