import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DELETE_SAVED_PATTERN_CONFIRM_BODY,
  DELETE_SAVED_PATTERN_CONFIRM_DELETE_LABEL,
  DELETE_SAVED_PATTERN_CONFIRM_MESSAGE,
  DELETE_SAVED_PATTERN_CONFIRM_TITLE,
  isSavedPatternDeleteConfirmationOpen,
  promptSavedPatternDeleteConfirmation,
  SAVED_PATTERN_DELETE_CONFIRMATION_OVERLAY_ID,
} from "./savedPatternDeleteConfirmation";

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

function createDomElement(_tag: string): DomElement {
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
  backdrop.attrs.add("data-saved-pattern-delete-confirmation-backdrop");
  const wrapper = createDomElement("div");
  const panel = createDomElement("div");
  panel.attrs.add("data-saved-pattern-delete-confirmation-panel");
  const deleteBtn = createDomElement("button");
  deleteBtn.attrs.add("data-saved-pattern-delete-confirmation-delete");
  const cancelBtn = createDomElement("button");
  cancelBtn.attrs.add("data-saved-pattern-delete-confirmation-cancel");
  panel.appendChild(deleteBtn);
  panel.appendChild(cancelBtn);
  wrapper.appendChild(panel);
  overlay.appendChild(backdrop);
  overlay.appendChild(wrapper);
}

describe("savedPatternDeleteConfirmation", () => {
  const bodyClassList = {
    add: vi.fn(),
    remove: vi.fn(),
  };
  let overlayStore: DomElement | null = null;
  let createdOverlay: DomElement | null = null;
  const keydownListeners = new Set<(event: { key: string; preventDefault: () => void; stopPropagation: () => void }) => void>();

  beforeEach(() => {
    overlayStore = null;
    createdOverlay = null;
    keydownListeners.clear();
    bodyClassList.add.mockClear();
    bodyClassList.remove.mockClear();

    vi.stubGlobal("document", {
      body: {
        classList: bodyClassList,
        appendChild(child: DomElement) {
          overlayStore = child;
          createdOverlay = child;
          wireOverlayTree(child);
        },
      },
      createElement(tag: string) {
        const el = createDomElement(tag);
        if (tag === "div") {
          Object.defineProperty(el, "id", {
            get() {
              return (el as DomElement & { _id?: string })._id ?? "";
            },
            set(value: string) {
              (el as DomElement & { _id?: string })._id = value;
            },
            configurable: true,
          });
        }
        return el;
      },
      getElementById(id: string) {
        if (id === SAVED_PATTERN_DELETE_CONFIRMATION_OVERLAY_ID) return overlayStore;
        return null;
      },
      addEventListener(type: string, fn: (event: { key: string; preventDefault: () => void; stopPropagation: () => void }) => void) {
        if (type === "keydown") keydownListeners.add(fn);
      },
      removeEventListener(type: string, fn: (event: { key: string; preventDefault: () => void; stopPropagation: () => void }) => void) {
        if (type === "keydown") keydownListeners.delete(fn);
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("exports the required confirmation copy", () => {
    expect(DELETE_SAVED_PATTERN_CONFIRM_MESSAGE).toBe(
      "Delete this pattern? This cannot be undone.",
    );
    expect(DELETE_SAVED_PATTERN_CONFIRM_TITLE).toBe("Delete this pattern?");
    expect(DELETE_SAVED_PATTERN_CONFIRM_BODY).toBe("This cannot be undone.");
    expect(DELETE_SAVED_PATTERN_CONFIRM_DELETE_LABEL).toBe("Delete Pattern");
  });

  it("resolves delete when Delete Pattern is clicked", async () => {
    const pending = promptSavedPatternDeleteConfirmation();
    expect(isSavedPatternDeleteConfirmationOpen()).toBe(true);
    expect(createdOverlay?.id).toBe(SAVED_PATTERN_DELETE_CONFIRMATION_OVERLAY_ID);

    const deleteBtn = createdOverlay?.querySelector(
      "[data-saved-pattern-delete-confirmation-delete]",
    );
    deleteBtn?.listeners.get("click")?.forEach((fn) => fn());

    await expect(pending).resolves.toBe("delete");
    expect(isSavedPatternDeleteConfirmationOpen()).toBe(false);
    expect(bodyClassList.remove).toHaveBeenCalledWith("pattern-workspace-new-pattern-overlay-open");
  });

  it("resolves cancel when Cancel is clicked", async () => {
    const pending = promptSavedPatternDeleteConfirmation();
    const cancelBtn = createdOverlay?.querySelector(
      "[data-saved-pattern-delete-confirmation-cancel]",
    );
    cancelBtn?.listeners.get("click")?.forEach((fn) => fn());
    await expect(pending).resolves.toBe("cancel");
  });

  it("resolves cancel on Escape without closing other surfaces", async () => {
    const pending = promptSavedPatternDeleteConfirmation();
    const preventDefault = vi.fn();
    const stopPropagation = vi.fn();
    for (const listener of keydownListeners) {
      listener({ key: "Escape", preventDefault, stopPropagation });
    }
    await expect(pending).resolves.toBe("cancel");
    expect(preventDefault).toHaveBeenCalled();
    expect(stopPropagation).toHaveBeenCalled();
  });
});
