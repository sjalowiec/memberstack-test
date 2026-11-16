import fs from "fs";
import path from "path";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./contactFormSubmit", () => ({
  formatContactSubmittedAtLocale: () => "Jan 1, 2026 – 1:00 PM",
  wireContactFormSubmit: vi.fn(),
}));

vi.mock("./turnstile", () => ({
  ensureTurnstileWidget: vi.fn(),
  getTurnstileSlot: () => null,
  resetTurnstileWidget: vi.fn(),
  whenTurnstileReady: (callback: () => void) => callback(),
}));

import { initContactModal } from "./contactModal";

class FakeElement {
  id = "";
  parent: FakeElement | null = null;
  value = "";
  classes = new Set<string>();
  attrs = new Map<string, string>();
  style: Record<string, string> = {};
  listeners: Array<{ type: string; fn: () => void }> = [];
  classList = {
    add: (name: string) => {
      this.classes.add(name);
    },
    remove: (name: string) => {
      this.classes.delete(name);
    },
    contains: (name: string) => this.classes.has(name),
  };

  setAttribute(name: string, value: string) {
    this.attrs.set(name, value);
  }

  getAttribute(name: string) {
    return this.attrs.get(name) ?? null;
  }

  addEventListener(type: string, fn: () => void) {
    this.listeners.push({ type, fn });
  }

  matches(selector: string) {
    if (selector.startsWith("#")) return this.id === selector.slice(1);
    if (selector.startsWith(".")) return this.classes.has(selector.slice(1));
    return false;
  }

  closest(selector: string): FakeElement | null {
    const selectors = selector.split(",").map((item) => item.trim());
    let current: FakeElement | null = this;
    while (current) {
      if (selectors.some((item) => current?.matches(item))) return current;
      current = current.parent;
    }
    return null;
  }

  querySelector() {
    return null;
  }

  reset() {}
}

class FakeForm extends FakeElement {}

const previousGlobals = {
  document: globalThis.document,
  Element: globalThis.Element,
  HTMLElement: globalThis.HTMLElement,
  HTMLFormElement: globalThis.HTMLFormElement,
  window: globalThis.window,
};

afterEach(() => {
  globalThis.document = previousGlobals.document;
  globalThis.Element = previousGlobals.Element;
  globalThis.HTMLElement = previousGlobals.HTMLElement;
  globalThis.HTMLFormElement = previousGlobals.HTMLFormElement;
  globalThis.window = previousGlobals.window;
});

function installDom() {
  const elements = new Map<string, FakeElement>();
  const listeners: Array<{ type: string; fn: (event: { target: FakeElement; preventDefault: () => void; key?: string }) => void }> = [];
  const body = new FakeElement();
  const document = {
    body,
    getElementById(id: string) {
      return elements.get(id) ?? null;
    },
    addEventListener(
      type: string,
      fn: (event: { target: FakeElement; preventDefault: () => void; key?: string }) => void,
    ) {
      listeners.push({ type, fn });
    },
  };

  function register(id: string, element: FakeElement) {
    element.id = id;
    elements.set(id, element);
    return element;
  }

  const modal = register("contact-modal", new FakeElement());
  register("contact-modal-overlay", new FakeElement());
  register("contact-modal-close", new FakeElement());
  register("contactFormModal", new FakeForm());
  register("contactPageURLModal", new FakeElement());
  register("contactSubmittedAtModal", new FakeElement());
  const formSource = register("contactFormSourceModal", new FakeElement());

  globalThis.Element = FakeElement as unknown as typeof Element;
  globalThis.HTMLElement = FakeElement as unknown as typeof HTMLElement;
  globalThis.HTMLFormElement = FakeForm as unknown as typeof HTMLFormElement;
  globalThis.document = document as unknown as Document;
  globalThis.window = { location: { href: "https://example.com/membership" } } as unknown as Window &
    typeof globalThis;

  return { modal, formSource, listeners };
}

function click(
  listeners: ReturnType<typeof installDom>["listeners"],
  target: FakeElement,
) {
  const event = { target, preventDefault: vi.fn(), key: "" };
  for (const listener of listeners) {
    if (listener.type === "click") listener.fn(event);
  }
  return event;
}

describe("contact modal triggers", () => {
  it("opens the modal for a Contact us control added after init and keeps /contact/ as the fallback", () => {
    const panel = fs.readFileSync(
      path.resolve("src/components/membership/MembershipStatusPanel.astro"),
      "utf8",
    );
    expect(panel).toContain('href="/contact/"');
    expect(panel).toContain("data-membership-status-contact");

    const { modal, formSource, listeners } = installDom();
    initContactModal();

    const link = new FakeElement();
    link.classes.add("contact-modal-trigger");
    link.setAttribute("href", "/contact/");
    link.setAttribute("data-contact-source", "membership-status");
    const label = new FakeElement();
    label.parent = link;

    const event = click(listeners, label);

    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(modal.classes.has("contact-modal--open")).toBe(true);
    expect(formSource.value).toBe("membership-status");
    expect(link.getAttribute("href")).toBe("/contact/");
  });
});
