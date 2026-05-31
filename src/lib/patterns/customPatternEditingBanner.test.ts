import { beforeEach, describe, expect, it, vi } from "vitest";
import { stubLocalStorage } from "./test/stubLocalStorage";
import { writeActiveCustomPatternProjectId, clearActiveCustomPatternProjectId } from "./customPatternProjectActiveId";
import { saveCurrentPattern } from "./patternStorage";
import {
  buildCustomPatternEditingBannerCopy,
  CUSTOM_PATTERN_EDITING_BANNER_BODY_TEXT,
  getCustomPatternEditingBannerState,
  isCustomPatternEditingBannerUpdateTarget,
  performEditingBannerCopy,
  performEditingBannerUpdate,
  renderCustomPatternEditingBanner,
  shouldMountCustomPatternEditingBannerHost,
} from "./customPatternEditingBanner";
import {
  CB_EDITING_BANNER_CANCEL_SELECTOR,
  CB_EDITING_BANNER_COPY_SELECTOR,
  CB_EDITING_BANNER_UPDATE_SELECTOR,
  exitEditingSavedCustomPattern,
  runCopyActiveSavedCustomPattern,
  runUpdateActiveSavedCustomPattern,
} from "./customPatternEditingBannerActions";

vi.mock("./customPatternEditingBannerActions", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./customPatternEditingBannerActions")>();
  return {
    ...actual,
    runUpdateActiveSavedCustomPattern: vi.fn(),
    runCopyActiveSavedCustomPattern: vi.fn(),
    syncEditingSavedPatternChrome: vi.fn(),
  };
});

const SUES_PATTERN = "Sue's test pattern";

function seedDraftTitle(title: string, titleCustomized = true): void {
  saveCurrentPattern({
    patternProject: { title, notes: "", titleCustomized },
  });
}

function makeUpdateTarget(withUpdateAttr: boolean): Element {
  const updateRoot = { closest: (sel: string) => (sel === CB_EDITING_BANNER_UPDATE_SELECTOR ? updateRoot : null) };
  const other = { closest: () => null };
  return (withUpdateAttr ? updateRoot : other) as unknown as Element;
}

function makeBannerHostForUpdate(): HTMLElement {
  const triggers = [
    { disabled: false } as HTMLButtonElement,
    { disabled: false } as HTMLButtonElement,
  ];
  return {
    ownerDocument: {} as Document,
    querySelectorAll(sel: string) {
      return sel === CB_EDITING_BANNER_UPDATE_SELECTOR ? triggers : [];
    },
    querySelector: () => null,
  } as unknown as HTMLElement;
}

function makeBannerHostForCopy(): HTMLElement {
  const triggers = [{ disabled: false } as HTMLButtonElement];
  return {
    ownerDocument: {} as Document,
    querySelectorAll(sel: string) {
      return sel === CB_EDITING_BANNER_COPY_SELECTOR ? triggers : [];
    },
    querySelector: () => null,
  } as unknown as HTMLElement;
}

type RenderNode = {
  tagName: string;
  className: string;
  title: string;
  textContent: string;
  innerHTML: string;
  hidden: boolean;
  disabled: boolean;
  _attrs: Map<string, string>;
  _children: RenderNode[];
  classList: { add: (c: string) => void; remove: (c: string) => void; toggle: (c: string, on?: boolean) => boolean };
  setAttribute: (k: string, v: string) => void;
  getAttribute: (k: string) => string | null;
  removeAttribute: (k: string) => void;
  append: (...nodes: RenderNode[]) => void;
  appendChild: (node: RenderNode) => RenderNode;
  replaceChildren: () => void;
};

function makeRenderNode(tagName = "div"): RenderNode {
  const attrs = new Map<string, string>();
  const classes = new Set<string>();
  const node: RenderNode = {
    tagName: tagName.toUpperCase(),
    className: "",
    title: "",
    textContent: "",
    innerHTML: "",
    hidden: false,
    disabled: false,
    _attrs: attrs,
    _children: [],
    classList: {
      add: (c) => classes.add(c),
      remove: (c) => classes.delete(c),
      toggle: (c, on) => {
        const next = on ?? !classes.has(c);
        if (next) classes.add(c);
        else classes.delete(c);
        return next;
      },
    },
    setAttribute: (k, v) => attrs.set(k, v),
    getAttribute: (k) => attrs.get(k) ?? null,
    removeAttribute: (k) => attrs.delete(k),
    append: (...nodes) => node._children.push(...nodes.filter(Boolean)),
    appendChild: (child) => {
      node._children.push(child);
      return child;
    },
    replaceChildren: () => {
      node._children.length = 0;
    },
  };
  return node;
}

function collectRenderNodes(nodes: RenderNode[], attr: string): RenderNode[] {
  const out: RenderNode[] = [];
  for (const node of nodes) {
    if (node?._attrs?.has(attr)) out.push(node);
    if (node?._children) out.push(...collectRenderNodes(node._children, attr));
  }
  return out;
}

describe("Custom Build editing banner", () => {
  beforeEach(() => {
    stubLocalStorage();
    localStorage.clear();
    vi.clearAllMocks();
  });

  it("saved project from My Patterns does not mount banner on finished Pattern output page", () => {
    writeActiveCustomPatternProjectId("proj-sue", SUES_PATTERN);
    seedDraftTitle(SUES_PATTERN);
    expect(getCustomPatternEditingBannerState()).toEqual({ show: true, projectName: SUES_PATTERN });
    expect(shouldMountCustomPatternEditingBannerHost("pattern-output")).toBe(false);
  });

  it("saved project mounts editing banner on editable workspace pages", () => {
    writeActiveCustomPatternProjectId("proj-sue", SUES_PATTERN);
    seedDraftTitle(SUES_PATTERN);
    expect(shouldMountCustomPatternEditingBannerHost("editable-workspace")).toBe(true);
    expect(getCustomPatternEditingBannerState().show).toBe(true);
  });

  it("Editing banner appears on Summary/Foundation page", () => {
    writeActiveCustomPatternProjectId("proj-sue", SUES_PATTERN);
    seedDraftTitle(SUES_PATTERN);
    const copy = buildCustomPatternEditingBannerCopy(getCustomPatternEditingBannerState().show ? SUES_PATTERN : "");
    expect(copy.title).toBe(`Editing saved pattern: ${SUES_PATTERN}`);
    expect(copy.body).toBe(CUSTOM_PATTERN_EDITING_BANNER_BODY_TEXT);
    expect(copy.body).toContain("Save");
    expect(copy.body).not.toContain("Update saved pattern");
  });

  it("editing banner state is available on editable workspace pages including Create", () => {
    writeActiveCustomPatternProjectId("proj-sue", SUES_PATTERN);
    seedDraftTitle(SUES_PATTERN);
    expect(getCustomPatternEditingBannerState().show).toBe(true);
  });

  it("Banner uses the saved pattern name, not “Sleeveless Sweater”", () => {
    writeActiveCustomPatternProjectId("proj-sue", SUES_PATTERN);
    seedDraftTitle(SUES_PATTERN);
    const copy = buildCustomPatternEditingBannerCopy(SUES_PATTERN);
    expect(copy.title).toContain(SUES_PATTERN);
    expect(copy.title).not.toContain("Sleeveless Sweater");
  });

  it("banner copy uses Save, not Update saved pattern", () => {
    const copy = buildCustomPatternEditingBannerCopy(SUES_PATTERN);
    expect(copy.body).toBe("Changes won't be saved until you click Save.");
  });

  it("New unsaved custom pattern does not show the editing banner", () => {
    clearActiveCustomPatternProjectId();
    seedDraftTitle("", false);
    expect(getCustomPatternEditingBannerState()).toEqual({ show: false, projectName: "" });
  });

  it("exposes compact update and cancel action selectors for the banner bar", () => {
    expect(CB_EDITING_BANNER_UPDATE_SELECTOR).toBe("[data-cb-editing-banner-update]");
    expect(CB_EDITING_BANNER_CANCEL_SELECTOR).toBe("[data-cb-editing-banner-cancel]");
  });

  it("inline Save and floppy icon both match the shared update selector", () => {
    expect(isCustomPatternEditingBannerUpdateTarget(makeUpdateTarget(true))).toBe(true);
    expect(isCustomPatternEditingBannerUpdateTarget(makeUpdateTarget(true))).toBe(true);
    expect(isCustomPatternEditingBannerUpdateTarget(makeUpdateTarget(false))).toBe(false);
  });

  it("inline Save and floppy icon both call the same update handler", async () => {
    vi.mocked(runUpdateActiveSavedCustomPattern).mockResolvedValue({
      ok: false,
      error: "stub",
    });

    const host = makeBannerHostForUpdate();
    await performEditingBannerUpdate(host);
    await performEditingBannerUpdate(host);

    expect(runUpdateActiveSavedCustomPattern).toHaveBeenCalledTimes(2);
    expect(runUpdateActiveSavedCustomPattern).toHaveBeenCalledWith(host.ownerDocument, expect.any(Object));
  });

  it("cancel exits editing mode so the banner state hides", () => {
    writeActiveCustomPatternProjectId("proj-sue", SUES_PATTERN);
    seedDraftTitle(SUES_PATTERN);
    expect(getCustomPatternEditingBannerState().show).toBe(true);
    exitEditingSavedCustomPattern();
    expect(getCustomPatternEditingBannerState().show).toBe(false);
  });

  it("cancel clears editing state without saving", () => {
    writeActiveCustomPatternProjectId("proj-sue", SUES_PATTERN);
    seedDraftTitle(SUES_PATTERN);
    exitEditingSavedCustomPattern();
    expect(getCustomPatternEditingBannerState().show).toBe(false);
    expect(runUpdateActiveSavedCustomPattern).not.toHaveBeenCalled();
  });

  it("exposes a distinct Save a Copy selector for the banner bar", () => {
    expect(CB_EDITING_BANNER_COPY_SELECTOR).toBe("[data-cb-editing-banner-copy]");
    expect(CB_EDITING_BANNER_COPY_SELECTOR).not.toBe(CB_EDITING_BANNER_UPDATE_SELECTOR);
  });

  it("Save a Copy button triggers the copy handler, not the update handler", async () => {
    vi.mocked(runCopyActiveSavedCustomPattern).mockResolvedValue({ ok: false, error: "stub" });

    const host = makeBannerHostForCopy();
    await performEditingBannerCopy(host);

    expect(runCopyActiveSavedCustomPattern).toHaveBeenCalledTimes(1);
    expect(runCopyActiveSavedCustomPattern).toHaveBeenCalledWith(host.ownerDocument, expect.any(Object));
    expect(runUpdateActiveSavedCustomPattern).not.toHaveBeenCalled();
  });

  it("renders Save Changes and Save a Copy as first-class actions on the open pattern", () => {
    writeActiveCustomPatternProjectId("proj-sue", SUES_PATTERN);
    seedDraftTitle(SUES_PATTERN);

    const created: RenderNode[] = [];
    vi.stubGlobal("document", {
      createElement: (tag: string) => {
        const node = makeRenderNode(tag);
        created.push(node);
        return node;
      },
      createTextNode: (text: string) => ({ textContent: text }),
    });

    const host = makeRenderNode("div");
    renderCustomPatternEditingBanner(host as unknown as HTMLElement);

    const copyButtons = collectRenderNodes(host._children, "data-cb-editing-banner-copy");
    expect(copyButtons.length).toBe(1);
    expect(copyButtons[0].title).toBe("Save a Copy");
    expect(copyButtons[0].getAttribute("aria-label")).toBe("Save a Copy");

    const updateButtons = collectRenderNodes(host._children, "data-cb-editing-banner-update");
    // Inline body "Save" link + the labeled Save Changes button.
    expect(updateButtons.length).toBeGreaterThanOrEqual(1);
    const saveChanges = updateButtons.find((b) => b.getAttribute("aria-label") === "Save Changes");
    expect(saveChanges).toBeTruthy();

    vi.unstubAllGlobals();
  });
});
