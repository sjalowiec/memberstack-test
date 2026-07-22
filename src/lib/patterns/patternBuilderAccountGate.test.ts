import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Default deps come from these modules; mock them so we can assert the gate reuses them
// without pulling in the real Memberstack / DOM stack.
const openMemberstackLoginModal = vi.fn<[string?], void>();

// The strict login check waits for Memberstack, then reads window.$memberstackDom directly. Mock
// only the wait; tests drive the login decision via a stubbed window.$memberstackDom.getCurrentMember.
vi.mock("./sleevelessPatternLoginGate", () => ({
  waitForMemberstackDom: async () => true,
  waitForMemberstackReady: async () => undefined,
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

function makeDialogFixture() {
  const loginBtn = makeButton();
  const dismissBtn = makeButton();
  const buttons: Record<string, ReturnType<typeof makeButton>[]> = {
    "[data-account-gate-login]": [loginBtn],
    "[data-account-gate-dismiss]": [dismissBtn],
  };
  const attrs: Record<string, string> = {};
  const dialog = {
    open: false,
    showModal: vi.fn(() => {
      dialog.open = true;
    }),
    close: vi.fn(() => {
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

describe("ensurePatternBuilderAccount - logged-out visitors see the login prompt", () => {
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

  it("default prompt shows the account gate modal", async () => {
    const { dialog } = makeDialogFixture();
    vi.stubGlobal("document", { querySelector: () => dialog });

    const allowed = await ensurePatternBuilderAccount();

    expect(allowed).toBe(false);
    expect(dialog.showModal).toHaveBeenCalledTimes(1);
  });

  it("fails closed when Memberstack reports no signed-in member (regression: dev-bypass must not open the gate)", async () => {
    const openAccountPrompt = vi.fn();
    // Memberstack present but no member (logged out). Previously the shared login check fell back to
    // the localhost dev bypass and reported this as logged in — letting anonymous users generate.
    vi.stubGlobal("window", {
      $memberstackDom: { getCurrentMember: async () => ({ data: {} }) },
    });

    const allowed = await ensurePatternBuilderAccount({ openAccountPrompt });

    expect(allowed).toBe(false);
    expect(openAccountPrompt).toHaveBeenCalledTimes(1);
  });

  it("fails closed when Memberstack is unavailable (never treats 'not ready' as logged in)", async () => {
    const { dialog } = makeDialogFixture();
    vi.stubGlobal("document", { querySelector: () => dialog });
    vi.stubGlobal("window", {} as Window & typeof globalThis);

    const allowed = await ensurePatternBuilderAccount();

    expect(allowed).toBe(false);
    expect(dialog.showModal).toHaveBeenCalledTimes(1);
  });
});

describe("ensurePatternBuilderAccount - active membership required", () => {
  it("allows generation when membership access is confirmed", async () => {
    const allowed = await ensurePatternBuilderAccount({
      hasAccess: async () => true,
      openAccountPrompt: vi.fn(),
    });
    expect(allowed).toBe(true);
  });

  it("does not open the prompt when membership access is confirmed", async () => {
    const openAccountPrompt = vi.fn();
    const allowed = await ensurePatternBuilderAccount({
      hasAccess: async () => true,
      openAccountPrompt,
    });
    expect(allowed).toBe(true);
    expect(openAccountPrompt).not.toHaveBeenCalled();
  });

  it("blocks logged-in users without membership access", async () => {
    const openAccountPrompt = vi.fn();
    const allowed = await ensurePatternBuilderAccount({
      hasAccess: async () => false,
      openAccountPrompt,
    });
    expect(allowed).toBe(false);
    expect(openAccountPrompt).toHaveBeenCalledTimes(1);
  });

  it("showPatternBuilderAccountGate returns false when dialog is missing", async () => {
    vi.stubGlobal("document", { querySelector: () => null });
    await expect(showPatternBuilderAccountGate()).resolves.toBe(false);
  });
});

describe("initPatternBuilderAccountGate - modal CTAs", () => {
  it("primary CTA opens login", () => {
    const openLogin = vi.fn();
    const { dialog, root, buttons } = makeDialogFixture();

    initPatternBuilderAccountGate(root, { openLogin });

    dialog.open = true;
    buttons["[data-account-gate-login]"][0].click();
    expect(openLogin).toHaveBeenCalledTimes(1);
    expect(dialog.close).toHaveBeenCalledTimes(1);
  });

  it("default login CTA uses Memberstack login modal", () => {
    const { dialog, root, buttons } = makeDialogFixture();

    initPatternBuilderAccountGate(root);

    dialog.open = true;
    buttons["[data-account-gate-login]"][0].click();
    expect(openMemberstackLoginModal).toHaveBeenCalledTimes(1);
  });

  it("is idempotent per dialog instance (binds once)", () => {
    const { root, buttons } = makeDialogFixture();
    initPatternBuilderAccountGate(root, { openLogin: vi.fn() });
    // Second call should no-op because the dialog is already marked bound.
    initPatternBuilderAccountGate(root, { openLogin: vi.fn() });
    expect(buttons["[data-account-gate-login]"][0].wired).toBe(true);
  });
});

describe("installPatternBuilderAccountGate (hat inline-script bridge)", () => {
  it("installs window globals that gate via the shared helper", async () => {
    const { dialog } = makeDialogFixture();
    // No $memberstackDom => strict check fails closed (logged out) and the prompt opens.
    vi.stubGlobal("window", {} as Window & typeof globalThis);
    vi.stubGlobal("document", { querySelector: () => dialog });

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
