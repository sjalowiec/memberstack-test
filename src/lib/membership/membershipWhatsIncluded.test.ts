import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  __resetMembershipWhatsIncludedModalForTests,
  bindMembershipWhatsIncludedModal,
  closeMembershipWhatsIncludedModal,
  MEMBERSHIP_WHATS_INCLUDED_CALLOUT_TITLE,
  MEMBERSHIP_WHATS_INCLUDED_GROUPS,
  MEMBERSHIP_WHATS_INCLUDED_HEADING,
  openMembershipWhatsIncludedModal,
  setMembershipWhatsIncludedTriggerMode,
} from "./membershipWhatsIncluded";

type StubEl = {
  hidden: boolean;
  open?: boolean;
  textContent: string;
  attrs: Map<string, string>;
  listeners: Map<string, Set<(event: unknown) => void>>;
  setAttribute: (name: string, value: string) => void;
  getAttribute: (name: string) => string | null;
  removeAttribute: (name: string) => void;
  matches: (selector: string) => boolean;
  querySelector: (selector: string) => StubEl | null;
  querySelectorAll: (selector: string) => StubEl[];
  addEventListener: (type: string, fn: (event: unknown) => void) => void;
  focus: (opts?: { preventScroll?: boolean }) => void;
  showModal?: () => void;
  close?: () => void;
  contains?: (node: StubEl) => boolean;
};

function el(matchers: string[], initial?: Partial<StubEl>): StubEl {
  const attrs = new Map<string, string>();
  const listeners = new Map<string, Set<(event: unknown) => void>>();
  const node: StubEl = {
    hidden: initial?.hidden ?? false,
    open: initial?.open ?? false,
    textContent: initial?.textContent ?? "",
    attrs,
    listeners,
    setAttribute: (name, value) => {
      attrs.set(name, value);
    },
    getAttribute: (name) => attrs.get(name) ?? null,
    removeAttribute: (name) => {
      attrs.delete(name);
    },
    matches: (selector) => matchers.includes(selector),
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener: (type, fn) => {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type)!.add(fn);
    },
    focus: vi.fn(),
    contains: () => true,
  };

  if (matchers.includes("[data-membership-whats-included-modal]")) {
    node.showModal = () => {
      node.open = true;
    };
    node.close = () => {
      node.open = false;
      listeners.get("close")?.forEach((fn) => fn({}));
    };
  }

  return node;
}

function makeRoot(nodes: StubEl[]): ParentNode & { nodes: StubEl[] } {
  const list = (selector: string) => nodes.filter((node) => node.matches(selector));
  for (const node of nodes) {
    node.querySelector = (selector: string) => list(selector)[0] ?? null;
    node.querySelectorAll = (selector: string) => list(selector);
  }
  return {
    nodes,
    querySelector: (selector: string) => list(selector)[0] ?? null,
    querySelectorAll: (selector: string) => list(selector) as unknown as NodeListOf<Element>,
  } as unknown as ParentNode & { nodes: StubEl[] };
}

describe("membershipWhatsIncluded", () => {
  let root: ReturnType<typeof makeRoot>;
  let dialog: StubEl;
  let trigger: StubEl;
  let closeBtn: StubEl;

  beforeEach(() => {
    __resetMembershipWhatsIncludedModalForTests();
    dialog = el(["[data-membership-whats-included-modal]"]);
    closeBtn = el(["[data-membership-whats-included-modal-close]"]);
    trigger = el(["[data-membership-whats-included-open]"]);
    trigger.setAttribute("data-membership-whats-included-mode", "anchor");
    root = makeRoot([dialog, closeBtn, trigger]);
    vi.stubGlobal("document", {
      activeElement: null,
      contains: () => true,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    __resetMembershipWhatsIncludedModalForTests();
  });

  it("reuses the existing section headings and callout wording", () => {
    expect(MEMBERSHIP_WHATS_INCLUDED_HEADING).toBe("What's included");
    expect(MEMBERSHIP_WHATS_INCLUDED_GROUPS.map((g) => g.title)).toEqual([
      "Pattern Builders",
      "Learning and Support",
      "Tools and Resources",
    ]);
    expect(MEMBERSHIP_WHATS_INCLUDED_CALLOUT_TITLE).toBe("More than just patterns");
  });

  it("opens from the hero trigger only in modal mode", () => {
    bindMembershipWhatsIncludedModal(root);
    const clickHandlers = trigger.listeners.get("click");
    expect(clickHandlers?.size).toBe(1);

    const preventDefault = vi.fn();
    clickHandlers?.forEach((fn) => fn({ preventDefault }));
    expect(dialog.open).toBe(false);
    expect(preventDefault).not.toHaveBeenCalled();

    setMembershipWhatsIncludedTriggerMode("modal", root);
    clickHandlers?.forEach((fn) => fn({ preventDefault }));
    expect(preventDefault).toHaveBeenCalled();
    expect(dialog.open).toBe(true);
    expect(closeBtn.focus).toHaveBeenCalled();
  });

  it("closes on Escape and restores focus to the trigger", () => {
    bindMembershipWhatsIncludedModal(root);
    setMembershipWhatsIncludedTriggerMode("modal", root);
    openMembershipWhatsIncludedModal(root, {
      returnFocus: trigger as unknown as HTMLElement,
    });
    expect(dialog.open).toBe(true);

    const cancelHandlers = dialog.listeners.get("cancel");
    cancelHandlers?.forEach((fn) => fn({ preventDefault: vi.fn() }));
    expect(dialog.open).toBe(false);
    expect(trigger.focus).toHaveBeenCalled();
  });

  it("closes on backdrop click but not on inner clicks", () => {
    bindMembershipWhatsIncludedModal(root);
    openMembershipWhatsIncludedModal(root, { returnFocus: null });
    expect(dialog.open).toBe(true);

    const clickHandlers = dialog.listeners.get("click");
    clickHandlers?.forEach((fn) => fn({ target: closeBtn }));
    expect(dialog.open).toBe(true);

    clickHandlers?.forEach((fn) => fn({ target: dialog }));
    expect(dialog.open).toBe(false);
  });

  it("does not bind duplicate listeners", () => {
    bindMembershipWhatsIncludedModal(root);
    bindMembershipWhatsIncludedModal(root);
    expect(trigger.listeners.get("click")?.size).toBe(1);
    expect(dialog.listeners.get("cancel")?.size).toBe(1);
  });

  it("anchor mode closes an open modal", () => {
    bindMembershipWhatsIncludedModal(root);
    openMembershipWhatsIncludedModal(root);
    expect(dialog.open).toBe(true);
    setMembershipWhatsIncludedTriggerMode("anchor", root);
    expect(dialog.open).toBe(false);
    expect(trigger.getAttribute("data-membership-whats-included-mode")).toBe("anchor");
  });

  it("closeMembershipWhatsIncludedModal closes without requiring a trigger", () => {
    openMembershipWhatsIncludedModal(root);
    closeMembershipWhatsIncludedModal(root);
    expect(dialog.open).toBe(false);
  });
});
