import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const openMemberstackLoginModal = vi.fn<[string?], void>();

vi.mock("./memberstackLogin", () => ({
  openMemberstackLoginModal: (returnPath?: string) => openMemberstackLoginModal(returnPath),
}));

import {
  initPublicSignupModal,
  installPublicSignupModal,
  showPublicSignupModal,
} from "./publicSignupModal";

beforeEach(() => {
  openMemberstackLoginModal.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function makeButton() {
  let clickHandler: ((event: { preventDefault: () => void }) => void) | undefined;
  return {
    addEventListener(type: string, fn: (event: { preventDefault: () => void }) => void) {
      if (type === "click") clickHandler = fn;
    },
    click() {
      clickHandler?.({ preventDefault() {} });
    },
  };
}

function makeDialogFixture() {
  const buttons: Record<string, ReturnType<typeof makeButton>[]> = {
    "[data-public-signup-login]": [makeButton()],
    "[data-public-signup-dismiss]": [makeButton()],
  };
  const form = { setAttribute: vi.fn() };
  const attrs: Record<string, string> = {};
  const dialog = {
    open: false,
    showModal: vi.fn(function showModal() {
      dialog.open = true;
    }),
    close: vi.fn(function close() {
      dialog.open = false;
    }),
    getAttribute: (k: string) => attrs[k] ?? null,
    setAttribute: (k: string, v: string) => {
      attrs[k] = v;
    },
    querySelector: (sel: string) => (sel === '[data-ms-form="signup"]' ? form : null),
    querySelectorAll: (sel: string) => buttons[sel] ?? [],
    addEventListener: vi.fn(),
  };
  const root = { querySelector: (_sel: string) => dialog } as unknown as ParentNode;
  return { dialog, root, buttons, form };
}

describe("showPublicSignupModal", () => {
  it("opens the dialog when present", () => {
    const { dialog, root } = makeDialogFixture();
    expect(showPublicSignupModal({ root })).toBe(true);
    expect(dialog.showModal).toHaveBeenCalledTimes(1);
  });

  it("returns false when no dialog exists", () => {
    vi.stubGlobal("document", { querySelector: () => null });
    expect(showPublicSignupModal()).toBe(false);
  });

  it("sets the signup form redirect to the public signup thank-you page", () => {
    const { root, form } = makeDialogFixture();
    vi.stubGlobal("window", {
      location: { pathname: "/patterns/hat", search: "", hash: "" },
    });
    expect(showPublicSignupModal({ root })).toBe(true);
    expect(form.setAttribute).toHaveBeenCalledWith("redirect", "/signup/thank-you");
  });

  it("uses the fixed thank-you redirect regardless of the current page", () => {
    const { root, form } = makeDialogFixture();
    vi.stubGlobal("window", {
      location: { pathname: "/patterns/diy-blanket", search: "?size=throw", hash: "#step-2" },
    });
    expect(showPublicSignupModal({ root })).toBe(true);
    expect(form.setAttribute).toHaveBeenCalledWith("redirect", "/signup/thank-you");
  });
});

describe("initPublicSignupModal", () => {
  it("secondary CTA opens the login modal and closes the signup modal", () => {
    const openLogin = vi.fn();
    const { dialog, root, buttons } = makeDialogFixture();

    initPublicSignupModal(root, { openLogin });

    dialog.open = true;
    buttons["[data-public-signup-login]"][0].click();
    expect(openLogin).toHaveBeenCalledTimes(1);
    expect(dialog.close).toHaveBeenCalledTimes(1);
  });

  it("dismiss control closes the modal", () => {
    const { dialog, root, buttons } = makeDialogFixture();
    initPublicSignupModal(root, { openLogin: vi.fn() });

    dialog.open = true;
    buttons["[data-public-signup-dismiss]"][0].click();
    expect(dialog.close).toHaveBeenCalledTimes(1);
  });

  it("auto-closes on Memberstack member.login (successful signup logs in)", () => {
    let loginHandler: (() => void) | undefined;
    vi.stubGlobal("window", {
      $memberstackDom: {
        on: (event: string, fn: () => void) => {
          if (event === "member.login") loginHandler = fn;
        },
      },
    });
    const { dialog, root } = makeDialogFixture();
    initPublicSignupModal(root, { openLogin: vi.fn() });

    dialog.open = true;
    loginHandler?.();
    expect(dialog.close).toHaveBeenCalledTimes(1);
  });
});

describe("installPublicSignupModal", () => {
  it("exposes window.kbmOpenPublicSignupModal and registers a delegated open handler", () => {
    const { dialog } = makeDialogFixture();
    const addEventListener = vi.fn();
    vi.stubGlobal("window", {
      location: { pathname: "/", search: "", hash: "" },
    } as Window & typeof globalThis);
    vi.stubGlobal("document", {
      querySelector: () => dialog,
      addEventListener,
      documentElement: {
        _attrs: {} as Record<string, string>,
        getAttribute(this: { _attrs: Record<string, string> }, k: string) {
          return this._attrs[k] ?? null;
        },
        setAttribute(this: { _attrs: Record<string, string> }, k: string, v: string) {
          this._attrs[k] = v;
        },
      },
    });

    installPublicSignupModal();

    expect(typeof window.kbmOpenPublicSignupModal).toBe("function");
    window.kbmOpenPublicSignupModal!();
    expect(dialog.showModal).toHaveBeenCalledTimes(1);
    // Delegated click handler registered for [data-open-public-signup] triggers.
    expect(addEventListener).toHaveBeenCalledWith("click", expect.any(Function));
  });

  it("no-ops safely when there is no window (SSR)", () => {
    vi.stubGlobal("window", undefined);
    expect(() => installPublicSignupModal()).not.toThrow();
  });
});
