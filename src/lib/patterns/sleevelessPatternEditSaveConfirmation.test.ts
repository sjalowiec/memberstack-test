import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  EDIT_PATTERN_SAVE_CONFIRMATION_BODY,
  EDIT_PATTERN_SAVE_CONFIRMATION_OVERLAY_ID,
  EDIT_PATTERN_SAVE_CONFIRMATION_TITLE,
  isEditPatternSaveConfirmationOpen,
  promptEditPatternSaveConfirmation,
} from "./sleevelessPatternEditSaveConfirmation";

type DomElement = {
  id: string;
  hidden: boolean;
  innerHTML: string;
  className: string;
  children: DomElement[];
  attrs: Set<string>;
  listeners: Map<string, Set<() => void>>;
  appendChild(child: DomElement): void;
  querySelector(selector: string): DomElement | null;
  addEventListener(type: string, fn: () => void): void;
  removeEventListener(type: string, fn: () => void): void;
  focus: ReturnType<typeof vi.fn>;
  setAttribute(_name: string, _value?: string): void;
};

function createDomElement(tag: string): DomElement {
  const el: DomElement = {
    id: "",
    hidden: true,
    innerHTML: "",
    className: "",
    children: [],
    attrs: new Set<string>(),
    listeners: new Map(),
    appendChild(child) {
      el.children.push(child);
    },
    querySelector(selector) {
      const attr = selector.match(/\[([^\]=]+)\]/)?.[1];
      const visit = (node: DomElement): DomElement | null => {
        if (attr && node.attrs.has(attr)) return node;
        for (const child of node.children) {
          const found = visit(child);
          if (found) return found;
        }
        return null;
      };
      return visit(el);
    },
    addEventListener(type, fn) {
      if (!el.listeners.has(type)) el.listeners.set(type, new Set());
      el.listeners.get(type)!.add(fn);
    },
    removeEventListener(type, fn) {
      el.listeners.get(type)?.delete(fn);
    },
    focus: vi.fn(),
    setAttribute(name, value) {
      if (value === undefined || value === "") {
        el.attrs.add(name);
      }
    },
  };
  return el;
}

function wireOverlayTree(overlay: DomElement): void {
  const backdrop = createDomElement("button");
  backdrop.attrs.add("data-sl-edit-save-confirmation-backdrop");
  const wrapper = createDomElement("div");
  const panel = createDomElement("div");
  panel.attrs.add("data-sl-edit-save-confirmation-panel");
  const viewBtn = createDomElement("button");
  viewBtn.attrs.add("data-sl-edit-save-confirmation-view");
  const keepBtn = createDomElement("button");
  keepBtn.attrs.add("data-sl-edit-save-confirmation-keep-editing");
  panel.appendChild(viewBtn);
  panel.appendChild(keepBtn);
  wrapper.appendChild(panel);
  overlay.appendChild(backdrop);
  overlay.appendChild(wrapper);
}

function createDocumentStub() {
  const byId = new Map<string, DomElement>();
  const body = createDomElement("body");
  const docListeners = new Map<string, Set<(event: { key: string; preventDefault: () => void; stopPropagation: () => void }) => void>>();

  const doc = {
    body: {
      ...body,
      classList: {
        classes: new Set<string>(),
        add(name: string) {
          this.classes.add(name);
        },
        remove(name: string) {
          this.classes.delete(name);
        },
      },
      appendChild(child: DomElement) {
        body.children.push(child);
        if (child.id) byId.set(child.id, child);
      },
    },
    getElementById(id: string) {
      return byId.get(id) ?? null;
    },
    createElement(_tag: string) {
      const el = createDomElement(_tag);
      let html = "";
      Object.defineProperty(el, "innerHTML", {
        set(value: string) {
          html = value;
          if (value.includes("data-sl-edit-save-confirmation-panel")) {
            el.children.length = 0;
            wireOverlayTree(el);
          }
        },
        get() {
          return html;
        },
      });
      return el;
    },
    addEventListener(type: string, fn: (event: { key: string; preventDefault: () => void; stopPropagation: () => void }) => void) {
      if (!docListeners.has(type)) docListeners.set(type, new Set());
      docListeners.get(type)!.add(fn);
    },
    removeEventListener(type: string, fn: (event: { key: string; preventDefault: () => void; stopPropagation: () => void }) => void) {
      docListeners.get(type)?.delete(fn);
    },
  };

  return doc as unknown as Document;
}

describe("sleevelessPatternEditSaveConfirmation", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns true only while the overlay is visible", () => {
    const overlay = { hidden: false };
    const doc = {
      getElementById: () => overlay,
    } as unknown as Document;
    expect(isEditPatternSaveConfirmationOpen(doc)).toBe(true);
    overlay.hidden = true;
    expect(isEditPatternSaveConfirmationOpen(doc)).toBe(false);
  });

  it("defaults to view when document is unavailable", async () => {
    vi.stubGlobal("document", undefined);
    await expect(promptEditPatternSaveConfirmation()).resolves.toBe("view");
  });

  describe("with a document stub", () => {
    beforeEach(() => {
      vi.stubGlobal("document", createDocumentStub());
    });

    it("shows the confirmation overlay and resolves keep-editing", async () => {
      const pending = promptEditPatternSaveConfirmation(document);
      const overlay = document.getElementById(EDIT_PATTERN_SAVE_CONFIRMATION_OVERLAY_ID) as unknown as DomElement;
      expect(overlay.hidden).toBe(false);
      expect(isEditPatternSaveConfirmationOpen(document)).toBe(true);

      overlay
        .querySelector("[data-sl-edit-save-confirmation-keep-editing]")
        ?.listeners.get("click")
        ?.forEach((fn) => fn());
      await expect(pending).resolves.toBe("keep-editing");
      expect(overlay.hidden).toBe(true);
    });

    it("resolves to view when the primary button is clicked", async () => {
      const pending = promptEditPatternSaveConfirmation(document);
      const overlay = document.getElementById(EDIT_PATTERN_SAVE_CONFIRMATION_OVERLAY_ID) as unknown as DomElement;
      overlay
        .querySelector("[data-sl-edit-save-confirmation-view]")
        ?.listeners.get("click")
        ?.forEach((fn) => fn());
      await expect(pending).resolves.toBe("view");
    });

    it("stores the expected copy in overlay markup", async () => {
      const pending = promptEditPatternSaveConfirmation(document);
      const overlay = document.getElementById(EDIT_PATTERN_SAVE_CONFIRMATION_OVERLAY_ID) as unknown as DomElement;
      expect(overlay.innerHTML).toContain(EDIT_PATTERN_SAVE_CONFIRMATION_TITLE);
      expect(overlay.innerHTML).toContain(EDIT_PATTERN_SAVE_CONFIRMATION_BODY);
      overlay
        .querySelector("[data-sl-edit-save-confirmation-view]")
        ?.listeners.get("click")
        ?.forEach((fn) => fn());
      await pending;
    });
  });
});
