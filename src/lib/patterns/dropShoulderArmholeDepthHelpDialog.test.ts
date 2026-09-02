import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DROP_SHOULDER_ARMHOLE_DEPTH_HELP_BODY,
  DROP_SHOULDER_ARMHOLE_DEPTH_HELP_EDIT_LABEL,
  DROP_SHOULDER_ARMHOLE_DEPTH_HELP_OVERLAY_ID,
  DROP_SHOULDER_ARMHOLE_DEPTH_HELP_TITLE,
  isDropShoulderArmholeDepthHelpOpen,
  promptDropShoulderArmholeDepthHelp,
} from "./dropShoulderArmholeDepthHelpDialog";

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
  backdrop.attrs.add("data-ds-armhole-depth-help-backdrop");
  const wrapper = createDomElement("div");
  const panel = createDomElement("div");
  panel.attrs.add("data-ds-armhole-depth-help-panel");
  const editBtn = createDomElement("button");
  editBtn.attrs.add("data-ds-armhole-depth-help-edit");
  panel.appendChild(editBtn);
  wrapper.appendChild(panel);
  overlay.appendChild(backdrop);
  overlay.appendChild(wrapper);
}

describe("dropShoulderArmholeDepthHelpDialog", () => {
  const bodyClassList = {
    add: vi.fn(),
    remove: vi.fn(),
  };
  let overlayStore: DomElement | null = null;
  let createdOverlay: DomElement | null = null;
  const keydownListeners = new Set<
    (event: { key: string; preventDefault: () => void; stopPropagation: () => void }) => void
  >();

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
        if (id === DROP_SHOULDER_ARMHOLE_DEPTH_HELP_OVERLAY_ID) return overlayStore;
        return null;
      },
      addEventListener(
        type: string,
        fn: (event: { key: string; preventDefault: () => void; stopPropagation: () => void }) => void,
      ) {
        if (type === "keydown") keydownListeners.add(fn);
      },
      removeEventListener(
        type: string,
        fn: (event: { key: string; preventDefault: () => void; stopPropagation: () => void }) => void,
      ) {
        if (type === "keydown") keydownListeners.delete(fn);
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("exports the required explanation copy", () => {
    expect(DROP_SHOULDER_ARMHOLE_DEPTH_HELP_TITLE).toBe("Want to change the armhole depth?");
    expect(DROP_SHOULDER_ARMHOLE_DEPTH_HELP_BODY).toBe(
      "For a Drop Shoulder sweater, the armhole depth is calculated from the Upper Arm measurement. Change the Upper Arm measurement to adjust the armhole depth.",
    );
    expect(DROP_SHOULDER_ARMHOLE_DEPTH_HELP_EDIT_LABEL).toBe("Edit Upper Arm Measurement");
  });

  it("resolves edit-upper-arm when the action is clicked", async () => {
    const pending = promptDropShoulderArmholeDepthHelp();
    expect(isDropShoulderArmholeDepthHelpOpen()).toBe(true);
    expect(createdOverlay?.id).toBe(DROP_SHOULDER_ARMHOLE_DEPTH_HELP_OVERLAY_ID);
    expect(createdOverlay?.className).toBe("pattern-workspace-new-pattern-overlay");
    expect(createdOverlay?.innerHTML).toContain("pattern-workspace-new-pattern-dialog");
    expect(createdOverlay?.innerHTML).toContain(DROP_SHOULDER_ARMHOLE_DEPTH_HELP_TITLE);
    expect(createdOverlay?.innerHTML).toContain(DROP_SHOULDER_ARMHOLE_DEPTH_HELP_BODY);
    expect(createdOverlay?.innerHTML).toContain(DROP_SHOULDER_ARMHOLE_DEPTH_HELP_EDIT_LABEL);

    const editBtn = createdOverlay?.querySelector("[data-ds-armhole-depth-help-edit]");
    editBtn?.listeners.get("click")?.forEach((fn) => fn());

    await expect(pending).resolves.toBe("edit-upper-arm");
    expect(isDropShoulderArmholeDepthHelpOpen()).toBe(false);
    expect(bodyClassList.remove).toHaveBeenCalledWith("pattern-workspace-new-pattern-overlay-open");
  });

  it("resolves dismiss when the backdrop is clicked", async () => {
    const pending = promptDropShoulderArmholeDepthHelp();
    const backdrop = createdOverlay?.querySelector("[data-ds-armhole-depth-help-backdrop]");
    backdrop?.listeners.get("click")?.forEach((fn) => fn());
    await expect(pending).resolves.toBe("dismiss");
  });

  it("resolves dismiss on Escape without closing other surfaces", async () => {
    const pending = promptDropShoulderArmholeDepthHelp();
    const preventDefault = vi.fn();
    const stopPropagation = vi.fn();
    for (const listener of keydownListeners) {
      listener({ key: "Escape", preventDefault, stopPropagation });
    }
    await expect(pending).resolves.toBe("dismiss");
    expect(preventDefault).toHaveBeenCalled();
    expect(stopPropagation).toHaveBeenCalled();
  });
});
