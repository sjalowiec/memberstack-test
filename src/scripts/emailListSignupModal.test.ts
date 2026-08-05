import { describe, expect, it, vi } from "vitest";
import { WEEKLY_TIP_SUBSCRIBER_STORAGE_KEY } from "../lib/email/weeklyTipSubscriberHint";
import {
  initWeeklyTipSignupModal,
  setWeeklyTipSignupChromeVisible,
} from "./emailListSignupModal";

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

  it("opens from either CTA into the same dialog and returns focus on close", () => {
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

    let topClick: ((event: Event) => void) | undefined;
    let secondaryClick: ((event: Event) => void) | undefined;
    const topBtn = {
      focus: vi.fn(),
      addEventListener(type: string, handler: (event: Event) => void) {
        if (type === "click") topClick = handler;
      },
    };
    const secondaryBtn = {
      focus: vi.fn(),
      addEventListener(type: string, handler: (event: Event) => void) {
        if (type === "click") secondaryClick = handler;
      },
    };

    const root = {
      querySelector(selector: string) {
        if (selector.includes("modal")) return dialog;
        return null;
      },
      querySelectorAll(selector: string) {
        if (selector.includes("open")) return [topBtn, secondaryBtn];
        if (selector.includes("chrome")) return [];
        return [];
      },
      addEventListener() {},
    } as unknown as ParentNode;

    const storage = memoryStorage();
    const original = globalThis.localStorage;
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: storage,
    });

    const controller = initWeeklyTipSignupModal(root, {
      locationLike: {
        pathname: "/tip-of-the-week",
        search: "",
        hash: "",
      },
      replaceState: vi.fn(),
    });

    expect(controller).not.toBeNull();

    topClick?.({ preventDefault() {} } as Event);
    expect(dialog.open).toBe(true);
    expect(focusableClose.focus).toHaveBeenCalled();

    dialog.close();
    expect(topBtn.focus).toHaveBeenCalled();

    secondaryClick?.({ preventDefault() {} } as Event);
    expect(dialog.open).toBe(true);

    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: original,
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

    const storage = memoryStorage();
    const original = globalThis.localStorage;
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: storage,
    });

    initWeeklyTipSignupModal(root, {
      locationLike: { pathname: "/tip-of-the-week", search: "", hash: "" },
    });

    listeners.get("click")?.[0]?.({ target: dialog });
    expect(close).not.toHaveBeenCalled();

    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: original,
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

    const original = globalThis.localStorage;
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: storage,
    });

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

    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: original,
    });
  });
});
