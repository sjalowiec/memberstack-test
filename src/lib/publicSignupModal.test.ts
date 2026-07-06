import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const openMemberstackLoginModal = vi.fn<[string?], void>();

vi.mock("./memberstackLogin", () => ({
  openMemberstackLoginModal: (returnPath?: string) => openMemberstackLoginModal(returnPath),
}));

import {
  PUBLIC_SIGNUP_RETURN_STORAGE_KEY,
  clearPublicSignupReturnPath,
  consumePublicSignupReturnPath,
  initPublicSignupModal,
  installPublicSignupModal,
  showPublicSignupModal,
} from "./publicSignupModal";

function stubSessionStorage(): Map<string, string> {
  const map = new Map<string, string>();
  vi.stubGlobal("sessionStorage", {
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    setItem: (k: string, v: string) => void map.set(k, String(v)),
    removeItem: (k: string) => void map.delete(k),
  });
  return map;
}

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

  it("honors an explicit redirectPath override (builder gate returns to the builder page)", () => {
    const { root, form } = makeDialogFixture();
    expect(showPublicSignupModal({ root, redirectPath: "/patterns/hat" })).toBe(true);
    expect(form.setAttribute).toHaveBeenCalledWith("redirect", "/patterns/hat");
  });

  it("stores the builder return path so the thank-you page can bounce (attribute alone is ignored by Memberstack)", () => {
    const store = stubSessionStorage();
    const { root } = makeDialogFixture();

    expect(showPublicSignupModal({ root, redirectPath: "/patterns/diy-blanket" })).toBe(true);

    const raw = store.get(PUBLIC_SIGNUP_RETURN_STORAGE_KEY);
    expect(raw).toBeTruthy();
    expect(JSON.parse(raw!).path).toBe("/patterns/diy-blanket");
  });

  it("clears any stored return path for a site-wide signup (no override)", () => {
    const store = stubSessionStorage();
    store.set(PUBLIC_SIGNUP_RETURN_STORAGE_KEY, JSON.stringify({ path: "/patterns/hat", ts: Date.now() }));
    const { root } = makeDialogFixture();

    expect(showPublicSignupModal({ root })).toBe(true);

    expect(store.has(PUBLIC_SIGNUP_RETURN_STORAGE_KEY)).toBe(false);
  });

  it("ignores an unsafe (non-relative) redirectPath override", () => {
    const store = stubSessionStorage();
    const { root } = makeDialogFixture();

    expect(showPublicSignupModal({ root, redirectPath: "https://evil.example.com" })).toBe(true);

    expect(store.has(PUBLIC_SIGNUP_RETURN_STORAGE_KEY)).toBe(false);
  });
});

describe("consumePublicSignupReturnPath (thank-you bounce)", () => {
  it("returns and consumes a fresh, safe return path", () => {
    const store = stubSessionStorage();
    store.set(PUBLIC_SIGNUP_RETURN_STORAGE_KEY, JSON.stringify({ path: "/patterns/hat", ts: Date.now() }));

    expect(consumePublicSignupReturnPath()).toBe("/patterns/hat");
    expect(store.has(PUBLIC_SIGNUP_RETURN_STORAGE_KEY)).toBe(false);
  });

  it("returns null (and clears) for a stale entry beyond the TTL", () => {
    const store = stubSessionStorage();
    store.set(
      PUBLIC_SIGNUP_RETURN_STORAGE_KEY,
      JSON.stringify({ path: "/patterns/hat", ts: Date.now() - 20 * 60 * 1000 }),
    );

    expect(consumePublicSignupReturnPath()).toBeNull();
    expect(store.has(PUBLIC_SIGNUP_RETURN_STORAGE_KEY)).toBe(false);
  });

  it("rejects a protocol-relative path (open-redirect guard)", () => {
    const store = stubSessionStorage();
    store.set(
      PUBLIC_SIGNUP_RETURN_STORAGE_KEY,
      JSON.stringify({ path: "//evil.example.com", ts: Date.now() }),
    );

    expect(consumePublicSignupReturnPath()).toBeNull();
  });

  it("never bounces back to the thank-you page itself", () => {
    const store = stubSessionStorage();
    store.set(
      PUBLIC_SIGNUP_RETURN_STORAGE_KEY,
      JSON.stringify({ path: "/signup/thank-you", ts: Date.now() }),
    );

    expect(consumePublicSignupReturnPath()).toBeNull();
  });

  it("returns null when there is no stored entry", () => {
    stubSessionStorage();
    expect(consumePublicSignupReturnPath()).toBeNull();
  });

  it("clearPublicSignupReturnPath removes a stored entry", () => {
    const store = stubSessionStorage();
    store.set(PUBLIC_SIGNUP_RETURN_STORAGE_KEY, JSON.stringify({ path: "/patterns/hat", ts: Date.now() }));

    clearPublicSignupReturnPath();
    expect(store.has(PUBLIC_SIGNUP_RETURN_STORAGE_KEY)).toBe(false);
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
