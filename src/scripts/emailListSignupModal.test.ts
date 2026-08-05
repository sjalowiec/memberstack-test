import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { WEEKLY_TIP_SUBSCRIBER_STORAGE_KEY } from "../lib/email/weeklyTipSubscriberHint";
import {
  bootWeeklyTipSignupModal,
  ensureWeeklyTipSignupOpenDelegation,
  initWeeklyTipSignupModal,
  resetWeeklyTipSignupModalForTests,
  setWeeklyTipSignupChromeVisible,
} from "./emailListSignupModal";

const componentDir = dirname(fileURLToPath(import.meta.url));
const weeklySignupSource = readFileSync(
  join(componentDir, "../components/tip-of-the-week/WeeklyTipSignup.astro"),
  "utf8",
);

function memoryStorage(seed: Record<string, string> = {}): Storage {
  const map = new Map(Object.entries(seed));
  return {
    get length() {
      return map.size;
    },
    clear() {
      map.clear();
    },
    getItem(key: string) {
      return map.has(key) ? map.get(key)! : null;
    },
    key(index: number) {
      return [...map.keys()][index] ?? null;
    },
    removeItem(key: string) {
      map.delete(key);
    },
    setItem(key: string, value: string) {
      map.set(key, String(value));
    },
  };
}

function withLocalStorage(storage: Storage, run: () => void): void {
  const original = globalThis.localStorage;
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: storage,
  });
  try {
    run();
  } finally {
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: original,
    });
  }
}

beforeEach(() => {
  resetWeeklyTipSignupModalForTests();
  if (typeof document !== "undefined" && document.documentElement) {
    document.documentElement.removeAttribute("data-weekly-tip-signup-delegated");
    document.documentElement.removeAttribute("data-weekly-tip-signup-boot");
  }
});

describe("weekly tip signup modal presentation", () => {
  it("hides chrome elements when asked", () => {
    const chrome = {
      hidden: false,
      setAttribute: vi.fn(),
      removeAttribute: vi.fn(),
    };
    const root = {
      querySelectorAll(selector: string) {
        return selector.includes("chrome") ? [chrome] : [];
      },
    } as unknown as ParentNode;

    setWeeklyTipSignupChromeVisible(false, root);
    expect(chrome.hidden).toBe(true);
    expect(chrome.setAttribute).toHaveBeenCalledWith("aria-hidden", "true");
  });

  it("overrides display:flex so [hidden] actually hides the inline CTA", () => {
    // Regression: author `display:flex` beat the UA [hidden] rule in production,
    // leaving the CTA visible while open() no-op'd after subscriber recognition.
    expect(weeklySignupSource).toMatch(
      /\.weekly-tip-signup-inline\[hidden\][\s\S]*?display:\s*none\s*!important/,
    );
    expect(weeklySignupSource).toContain("bootWeeklyTipSignupModal");
  });

  it("opens the dialog and returns focus on close", () => {
    const listeners = new Map<string, Array<(event: Event) => void>>();
    const focusableClose = {
      focus: vi.fn(),
      addEventListener: vi.fn(),
    };
    const firstName = { value: "", focus: vi.fn() };
    const email = { value: "" };
    const thanks = { hidden: true };
    const doneBtn = {
      hidden: true,
      focus: vi.fn(),
      addEventListener: vi.fn(),
    };
    const form = {
      hidden: false,
      dataset: { submitting: "false", signupBound: "false" },
      querySelector(selector: string) {
        if (selector === 'button[type="submit"]') return { disabled: false };
        if (selector === "[data-signup-error]") return { hidden: true, textContent: "" };
        return null;
      },
      addEventListener() {},
    };

    const dialogState = { open: false };
    const dialog = {
      get open() {
        return dialogState.open;
      },
      set open(value: boolean) {
        dialogState.open = value;
      },
      getAttribute() {
        return null;
      },
      setAttribute() {},
      showModal() {
        dialogState.open = true;
      },
      close() {
        dialogState.open = false;
        listeners.get("close")?.forEach((fn) => fn({} as Event));
      },
      querySelector(selector: string) {
        if (selector === "[data-signup-close]") return focusableClose;
        if (selector === 'input[name="firstName"]') return firstName;
        if (selector === 'input[name="email"]') return email;
        if (selector === "[data-signup-thanks]") return thanks;
        if (selector === "[data-signup-done]") return doneBtn;
        if (selector === "[data-email-list-signup]") return form;
        return null;
      },
      querySelectorAll(selector: string) {
        if (selector.includes("data-signup-close") || selector.includes("data-signup-done")) {
          return [focusableClose, doneBtn];
        }
        if (selector.includes("button:not") || selector.includes("a[href]")) {
          return [focusableClose, firstName as unknown as HTMLElement];
        }
        return [];
      },
      addEventListener(type: string, handler: (event: Event) => void) {
        const list = listeners.get(type) ?? [];
        list.push(handler);
        listeners.set(type, list);
      },
    };

    const opener = { focus: vi.fn() };

    const root = {
      querySelector(selector: string) {
        if (selector.includes("modal")) return dialog;
        return null;
      },
      querySelectorAll(selector: string) {
        if (selector.includes("chrome")) return [];
        return [];
      },
      addEventListener() {},
    } as unknown as ParentNode;

    withLocalStorage(memoryStorage(), () => {
      const controller = initWeeklyTipSignupModal(root, {
        locationLike: {
          pathname: "/tip-of-the-week",
          search: "",
          hash: "",
        },
        replaceState: vi.fn(),
      });

      expect(controller).not.toBeNull();
      controller?.open(opener as unknown as HTMLElement);
      expect(dialog.open).toBe(true);
      expect(focusableClose.focus).toHaveBeenCalled();

      dialog.close();
      expect(opener.focus).toHaveBeenCalled();
    });
  });

  it("does not close on backdrop click when the form has entered values", () => {
    const listeners = new Map<string, Array<(event: { target: unknown }) => void>>();
    const firstName = { value: "Ada", focus: vi.fn() };
    const email = { value: "ada@example.com" };
    const thanks = { hidden: true };
    const close = vi.fn();
    const dialog = {
      open: true,
      getAttribute() {
        return null;
      },
      setAttribute() {},
      showModal() {},
      close,
      querySelector(selector: string) {
        if (selector === 'input[name="firstName"]') return firstName;
        if (selector === 'input[name="email"]') return email;
        if (selector === "[data-signup-thanks]") return thanks;
        if (selector === "[data-signup-close]") return { focus: vi.fn() };
        if (selector === "[data-email-list-signup]") {
          return {
            hidden: false,
            dataset: { submitting: "false", signupBound: "true" },
            querySelector() {
              return null;
            },
          };
        }
        return null;
      },
      querySelectorAll() {
        return [];
      },
      addEventListener(type: string, handler: (event: { target: unknown }) => void) {
        const list = listeners.get(type) ?? [];
        list.push(handler);
        listeners.set(type, list);
      },
    };

    const root = {
      querySelector() {
        return dialog;
      },
      querySelectorAll() {
        return [];
      },
      addEventListener() {},
    } as unknown as ParentNode;

    withLocalStorage(memoryStorage(), () => {
      initWeeklyTipSignupModal(root, {
        locationLike: { pathname: "/tip-of-the-week", search: "", hash: "" },
      });

      listeners.get("click")?.[0]?.({ target: dialog });
      expect(close).not.toHaveBeenCalled();
    });
  });

  it("subscriber=1 hides chrome and strips the query param", () => {
    const storage = memoryStorage();
    const replaceState = vi.fn();
    const chrome = {
      hidden: false,
      setAttribute: vi.fn(),
      removeAttribute: vi.fn(),
    };
    const dialog = {
      open: false,
      getAttribute() {
        return null;
      },
      setAttribute() {},
      showModal() {},
      close() {},
      querySelector() {
        return null;
      },
      querySelectorAll() {
        return [];
      },
      addEventListener() {},
    };

    const root = {
      querySelector() {
        return dialog;
      },
      querySelectorAll(selector: string) {
        if (selector.includes("chrome")) return [chrome];
        return [];
      },
      addEventListener() {},
    } as unknown as ParentNode;

    withLocalStorage(storage, () => {
      const now = 1_700_000_000_000;
      initWeeklyTipSignupModal(root, {
        now,
        locationLike: {
          pathname: "/tip-of-the-week",
          search: "?subscriber=1&preview=abc",
          hash: "#x",
        },
        replaceState,
      });

      expect(storage.getItem(WEEKLY_TIP_SUBSCRIBER_STORAGE_KEY)).toBe(String(now));
      expect(replaceState).toHaveBeenCalledWith("/tip-of-the-week?preview=abc#x");
      expect(chrome.hidden).toBe(true);
    });
  });

  it("leaves CTAs dead-on-arrival when recognized unless chrome is actually hidden (regression)", () => {
    const storage = memoryStorage({
      [WEEKLY_TIP_SUBSCRIBER_STORAGE_KEY]: String(Date.now()),
    });
    const chrome = {
      hidden: false,
      setAttribute: vi.fn(),
      removeAttribute: vi.fn(),
    };
    const showModal = vi.fn();
    const dialog = {
      open: false,
      getAttribute() {
        return null;
      },
      setAttribute() {},
      showModal,
      close() {},
      querySelector() {
        return { focus: vi.fn(), value: "" };
      },
      querySelectorAll() {
        return [];
      },
      addEventListener() {},
    };

    const root = {
      querySelector() {
        return dialog;
      },
      querySelectorAll(selector: string) {
        if (selector.includes("chrome")) return [chrome];
        return [];
      },
      addEventListener() {},
    } as unknown as ParentNode;

    withLocalStorage(storage, () => {
      const controller = initWeeklyTipSignupModal(root, {
        locationLike: { pathname: "/tip-of-the-week", search: "", hash: "" },
      });
      expect(chrome.hidden).toBe(true);
      controller?.open({ focus: vi.fn() } as unknown as HTMLElement);
      expect(showModal).not.toHaveBeenCalled();
    });
  });

  it("boots after the dialog appears when missing on first attempt", () => {
    const storage = memoryStorage();
    let dialog: {
      open: boolean;
      getAttribute: () => string | null;
      setAttribute: ReturnType<typeof vi.fn>;
      showModal: ReturnType<typeof vi.fn>;
      close: () => void;
      querySelector: () => { focus: ReturnType<typeof vi.fn>; value: string } | null;
      querySelectorAll: () => unknown[];
      addEventListener: ReturnType<typeof vi.fn>;
    } | null = null;

    const readyState = { value: "loading" };
    const domListeners: Array<() => void> = [];

    const doc = {
      get readyState() {
        return readyState.value;
      },
      documentElement: {
        getAttribute: vi.fn(() => null),
        setAttribute: vi.fn(),
        removeAttribute: vi.fn(),
      },
      querySelector(selector: string) {
        if (selector.includes("modal")) return dialog;
        return null;
      },
      querySelectorAll() {
        return [];
      },
      addEventListener(type: string, handler: () => void) {
        if (type === "DOMContentLoaded") domListeners.push(handler);
      },
    } as unknown as Document;

    withLocalStorage(storage, () => {
      const first = bootWeeklyTipSignupModal(
        { locationLike: { pathname: "/tip-of-the-week", search: "", hash: "" } },
        doc,
      );
      expect(first).toBeNull();
      expect(domListeners.length).toBe(1);

      dialog = {
        open: false,
        getAttribute: () => null,
        setAttribute: vi.fn(),
        showModal: vi.fn(),
        close() {},
        querySelector: () => ({ focus: vi.fn(), value: "" }),
        querySelectorAll: () => [],
        addEventListener: vi.fn(),
      };
      readyState.value = "complete";
      domListeners[0]?.();

      // Delegation path can open once dialog exists.
      const after = initWeeklyTipSignupModal(doc, {
        locationLike: { pathname: "/tip-of-the-week", search: "", hash: "" },
      });
      expect(after).not.toBeNull();
      after?.open({ focus: vi.fn() } as unknown as HTMLElement);
      expect(dialog.showModal).toHaveBeenCalled();
    });
  });

  it("delegates open clicks without requiring per-button listeners", () => {
    const storage = memoryStorage();
    const showModal = vi.fn();
    const dialog = {
      open: false,
      getAttribute() {
        return null;
      },
      setAttribute() {},
      showModal,
      close() {},
      querySelector() {
        return { focus: vi.fn(), value: "" };
      },
      querySelectorAll() {
        return [];
      },
      addEventListener() {},
    };

    let clickHandler: ((event: Event) => void) | undefined;
    const attrs = new Map<string, string>();
    const doc = {
      documentElement: {
        getAttribute(name: string) {
          return attrs.get(name) ?? null;
        },
        setAttribute(name: string, value: string) {
          attrs.set(name, value);
        },
      },
      querySelector(selector: string) {
        if (selector.includes("modal")) return dialog;
        return null;
      },
      querySelectorAll() {
        return [];
      },
      addEventListener(type: string, handler: (event: Event) => void) {
        if (type === "click") clickHandler = handler;
      },
    } as unknown as Document;

    withLocalStorage(storage, () => {
      initWeeklyTipSignupModal(doc, {
        locationLike: { pathname: "/tip-of-the-week", search: "", hash: "" },
      });
      ensureWeeklyTipSignupOpenDelegation(doc);
      ensureWeeklyTipSignupOpenDelegation(doc); // idempotent

      const btn = {
        closest(selector: string) {
          return selector.includes("open") ? btn : null;
        },
      };

      clickHandler?.({
        target: btn,
        preventDefault: vi.fn(),
      } as unknown as Event);

      expect(showModal).toHaveBeenCalledTimes(1);
    });
  });
});
