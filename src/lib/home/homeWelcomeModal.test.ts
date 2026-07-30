import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { stubLocalStorage } from "../patterns/test/stubLocalStorage";
import {
  HOME_WELCOME_MODAL_BODY,
  HOME_WELCOME_MODAL_PRIMARY_HREF,
  HOME_WELCOME_MODAL_PRIMARY_LABEL,
  HOME_WELCOME_MODAL_SECONDARY_LABEL,
  HOME_WELCOME_MODAL_STORAGE_KEY,
  HOME_WELCOME_MODAL_TITLE,
  closeHomeWelcomeModal,
  dismissHomeWelcomeModal,
  hasDismissedHomeWelcomeModal,
  initHomeWelcomeModal,
  maybeOpenHomeWelcomeModal,
  openHomeWelcomeModal,
  shouldShowHomeWelcomeModal,
} from "./homeWelcomeModal";

const here = dirname(fileURLToPath(import.meta.url));
const modalAstro = readFileSync(
  join(here, "../../components/home/HomeWelcomeModal.astro"),
  "utf8",
);
const indexAstro = readFileSync(join(here, "../../pages/index.astro"), "utf8");

type FakeEvent = {
  key?: string;
  target?: FakeElement;
  preventDefault?: () => void;
};

class FakeClassList {
  private classes = new Set<string>();
  contains(name: string): boolean {
    return this.classes.has(name);
  }
  add(name: string): void {
    this.classes.add(name);
  }
  remove(name: string): void {
    this.classes.delete(name);
  }
}

class FakeElement {
  attrs: Record<string, string> = {};
  classList = new FakeClassList();
  children: FakeElement[] = [];
  style: Record<string, string> = {};
  tagName: string;
  focus = vi.fn();
  private listeners = new Map<string, Array<(event: FakeEvent) => void>>();

  constructor(tagName = "DIV") {
    this.tagName = tagName;
  }

  getAttribute(name: string): string | null {
    return Object.prototype.hasOwnProperty.call(this.attrs, name) ? this.attrs[name] : null;
  }

  setAttribute(name: string, value: string): void {
    this.attrs[name] = value;
  }

  querySelector(selector: string): FakeElement | null {
    return this.querySelectorAll(selector)[0] ?? null;
  }

  querySelectorAll(selector: string): FakeElement[] {
    const attrMatch = selector.match(/^\[([^\]]+)\]$/);
    const attr = attrMatch?.[1];
    const out: FakeElement[] = [];
    const walk = (el: FakeElement) => {
      if (attr && Object.prototype.hasOwnProperty.call(el.attrs, attr)) out.push(el);
      for (const child of el.children) walk(child);
    };
    walk(this);
    return out;
  }

  addEventListener(type: string, handler: (event: FakeEvent) => void): void {
    const list = this.listeners.get(type) ?? [];
    list.push(handler);
    this.listeners.set(type, list);
  }

  dispatch(type: string, event: FakeEvent = {}): void {
    for (const handler of this.listeners.get(type) ?? []) handler(event);
  }
}

function makeModalTree() {
  const root = new FakeElement("DIV");
  root.setAttribute("data-home-welcome-modal", "");
  root.setAttribute("aria-hidden", "true");

  const dialog = new FakeElement("DIV");
  dialog.setAttribute("data-home-welcome-dialog", "");

  const closeBtn = new FakeElement("BUTTON");
  closeBtn.setAttribute("data-home-welcome-close", "");

  const primary = new FakeElement("A");
  primary.setAttribute("data-home-welcome-primary", "");

  const secondary = new FakeElement("BUTTON");
  secondary.setAttribute("data-home-welcome-secondary", "");

  dialog.children = [closeBtn, primary, secondary];
  root.children = [dialog];

  const hero = new FakeElement("A");
  const body = new FakeElement("BODY");
  body.style = { overflow: "" };

  const documentListeners = new Map<string, Array<(event: FakeEvent) => void>>();

  const fakeDocument = {
    body,
    activeElement: hero as unknown as HTMLElement,
    contains: (el: FakeElement | null) => el === hero || el === closeBtn || el === root,
    querySelector: (selector: string) => {
      if (selector === "[data-home-welcome-modal]") return root;
      if (selector === "main a, main button, main [href]") return hero;
      return root.querySelector(selector);
    },
    addEventListener: (type: string, handler: (event: FakeEvent) => void) => {
      const list = documentListeners.get(type) ?? [];
      list.push(handler);
      documentListeners.set(type, list);
    },
    dispatchKeydown: (key: string) => {
      const event = { key, preventDefault: vi.fn() };
      for (const handler of documentListeners.get("keydown") ?? []) handler(event);
      return event;
    },
  };

  vi.stubGlobal("HTMLElement", FakeElement);
  vi.stubGlobal("document", fakeDocument);

  return { root, closeBtn, primary, secondary, hero, fakeDocument };
}

beforeEach(() => {
  stubLocalStorage();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("homeWelcomeModal storage", () => {
  it("starts undismissed and should show", () => {
    expect(hasDismissedHomeWelcomeModal()).toBe(false);
    expect(shouldShowHomeWelcomeModal()).toBe(true);
  });

  it("records dismiss in localStorage and stops showing", () => {
    dismissHomeWelcomeModal();
    expect(localStorage.getItem(HOME_WELCOME_MODAL_STORAGE_KEY)).toBe("true");
    expect(hasDismissedHomeWelcomeModal()).toBe(true);
    expect(shouldShowHomeWelcomeModal()).toBe(false);
  });
});

describe("homeWelcomeModal open/close", () => {
  it("opens only when not previously dismissed", () => {
    const { root } = makeModalTree();
    expect(maybeOpenHomeWelcomeModal()).toBe(true);
    expect(root.classList.contains("is-open")).toBe(true);
    expect(root.getAttribute("aria-hidden")).toBe("false");

    closeHomeWelcomeModal({ dismiss: true });
    expect(root.classList.contains("is-open")).toBe(false);
    expect(maybeOpenHomeWelcomeModal()).toBe(false);
  });

  it("moves focus into the modal on open and restores on close", () => {
    const { closeBtn, hero } = makeModalTree();
    openHomeWelcomeModal();
    expect(closeBtn.focus).toHaveBeenCalled();

    closeHomeWelcomeModal({ dismiss: true });
    expect(hero.focus).toHaveBeenCalled();
  });

  it("Escape dismisses and closes after init", () => {
    const { root, fakeDocument } = makeModalTree();
    initHomeWelcomeModal();
    expect(root.classList.contains("is-open")).toBe(true);

    fakeDocument.dispatchKeydown("Escape");
    expect(root.classList.contains("is-open")).toBe(false);
    expect(hasDismissedHomeWelcomeModal()).toBe(true);
  });

  it("Continue button dismisses and closes", () => {
    const { root, secondary } = makeModalTree();
    initHomeWelcomeModal();
    secondary.dispatch("click", { target: secondary });
    expect(root.classList.contains("is-open")).toBe(false);
    expect(hasDismissedHomeWelcomeModal()).toBe(true);
  });

  it("primary link click sets dismiss flag", () => {
    const { primary } = makeModalTree();
    initHomeWelcomeModal();
    primary.dispatch("click", { target: primary });
    expect(hasDismissedHomeWelcomeModal()).toBe(true);
  });

  it("does not auto-open when already dismissed", () => {
    dismissHomeWelcomeModal();
    const { root } = makeModalTree();
    initHomeWelcomeModal();
    expect(root.classList.contains("is-open")).toBe(false);
  });
});

describe("homeWelcomeModal markup integration", () => {
  it("is mounted only from the homepage", () => {
    expect(indexAstro).toContain('import HomeWelcomeModal from "../components/home/HomeWelcomeModal.astro"');
    expect(indexAstro).toContain("<HomeWelcomeModal />");
  });

  it("exposes accessible dialog markup and required copy", () => {
    expect(modalAstro).toContain('role="dialog"');
    expect(modalAstro).toContain('aria-modal="true"');
    expect(modalAstro).toContain('aria-labelledby="home-welcome-modal-title"');
    expect(modalAstro).toContain("HOME_WELCOME_MODAL_TITLE");
    expect(modalAstro).toContain("HOME_WELCOME_MODAL_BODY");
    expect(modalAstro).toContain("HOME_WELCOME_MODAL_PRIMARY_HREF");
    expect(modalAstro).toContain("data-home-welcome-close");
    expect(modalAstro).toContain("data-home-welcome-secondary");
  });

  it("keeps modal copy short and points primary CTA to /new-site", () => {
    expect(HOME_WELCOME_MODAL_TITLE).toBe("Welcome to the New Knit It Now");
    expect(HOME_WELCOME_MODAL_BODY).toContain("completely rebuilt");
    expect(HOME_WELCOME_MODAL_BODY).not.toContain("Saved Patterns");
    expect(HOME_WELCOME_MODAL_PRIMARY_LABEL).toBe("Read About the New Site");
    expect(HOME_WELCOME_MODAL_PRIMARY_HREF).toBe("/new-site");
    expect(HOME_WELCOME_MODAL_SECONDARY_LABEL).toBe("Explore the New Knit it Now");
    expect(HOME_WELCOME_MODAL_STORAGE_KEY).toBe("kin-home-welcome-modal-dismissed");
  });
});
