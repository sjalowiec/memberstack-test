import { beforeEach, describe, expect, it, vi } from "vitest";
import { stubLocalStorage } from "./test/stubLocalStorage";
import {
  clearActiveCustomPatternProjectId,
  readActiveCustomPatternProjectId,
  writeActiveCustomPatternProjectId,
} from "./customPatternProjectActiveId";
import {
  buildCustomPatternProjectDrawerLines,
  buildCustomPatternProjectMetaLine,
  closePatternWorkspaceLibraryDrawer,
  formatCustomPatternProjectType,
  formatCustomPatternProjectUpdatedAt,
  formatPatternCopiedDrawerMessage,
  openPatternWorkspaceLibraryDrawer,
  PATTERN_WORKSPACE_LIBRARY_DRAWER_OPEN_CLASS,
  PATTERN_WORKSPACE_LIBRARY_DRAWER_INIT_ATTR,
  initPatternWorkspaceLibraryDrawer,
  refreshPatternWorkspaceLibraryList,
  resetPatternWorkspaceLibraryDrawerSessionState,
  resolvePatternWorkspaceLibraryDrawerBindings,
} from "./patternWorkspaceLibraryDrawer";
import type { PatternWorkspaceLibraryDrawerBindings } from "./patternWorkspaceLibraryDrawer";
import { testAccess } from "./patternAccessTestFixtures";

const listCustomPatternProjectsMock = vi.fn();
const loadSavedCustomPatternProjectMock = vi.fn();
const copyByIdMock = vi.fn();
const resolveAccessSnapshotMock = vi.fn();

vi.mock("./customPatternProjectClient", () => ({
  listCustomPatternProjects: (...args: unknown[]) => listCustomPatternProjectsMock(...args),
}));

vi.mock("./loadSavedCustomPatternProject", () => ({
  loadSavedCustomPatternProject: (...args: unknown[]) => loadSavedCustomPatternProjectMock(...args),
}));

vi.mock("./savedCustomPatternManageActions", () => ({
  copySavedCustomPatternProjectById: (...args: unknown[]) => copyByIdMock(...args),
  renameSavedCustomPatternProject: vi.fn(),
}));

vi.mock("./sleevelessPatternSystemAccessClient", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./sleevelessPatternSystemAccessClient")>();
  return {
    ...actual,
    resolveSleevelessUserAccessSnapshot: (...args: unknown[]) => resolveAccessSnapshotMock(...args),
  };
});

// The blocked (free / non-owner) Copy click drives the separate editing-unlock modal, which is
// covered by its own tests. Isolate it here so this suite stays focused on the drawer behavior.
vi.mock("./patternEditingUnlockModal", () => ({
  offerPatternEditingUnlockModal: vi.fn(),
}));

class MockHTMLElement {}
class MockHTMLButtonElement extends MockHTMLElement {}

vi.stubGlobal("HTMLElement", MockHTMLElement);
vi.stubGlobal("HTMLButtonElement", MockHTMLButtonElement);

function makeClassList() {
  const classes = new Set<string>();
  return {
    add: (...names: string[]) => names.forEach((n) => classes.add(n)),
    remove: (...names: string[]) => names.forEach((n) => classes.delete(n)),
    contains: (name: string) => classes.has(name),
    toggle: () => false,
  };
}

type MockEl = HTMLElement & {
  _click?: () => unknown;
  _clickListeners?: Array<(event?: { preventDefault?: () => void; stopPropagation?: () => void }) => unknown>;
  _children: MockEl[];
};

function makeEl(tag = "div"): MockEl {
  const attrs = new Map<string, string>();
  const Base = tag === "button" ? MockHTMLButtonElement : MockHTMLElement;
  const el = Object.assign(new Base(), {
    tagName: tag.toUpperCase(),
    classList: makeClassList(),
    hidden: false,
    textContent: "",
    disabled: false,
    dataset: {} as DOMStringMap,
    _children: [] as MockEl[],
    _clickListeners: [] as MockEl["_clickListeners"],
    setAttribute(name: string, value: string) {
      attrs.set(name, value);
    },
    getAttribute(name: string) {
      return attrs.get(name) ?? null;
    },
    removeAttribute(name: string) {
      attrs.delete(name);
    },
    append(...nodes: MockEl[]) {
      el._children.push(...nodes);
    },
    replaceChildren() {
      el._children.length = 0;
    },
    querySelector(sel: string) {
      return el._children.find((child) => child.matches?.(sel)) ?? null;
    },
    querySelectorAll(sel: string) {
      const matches = collectMatches(el._children, sel);
      return matches as unknown as NodeListOf<Element>;
    },
    addEventListener(event: string, handler: (...args: unknown[]) => unknown) {
      if (event === "click") {
        el._click = handler as () => unknown;
        el._clickListeners?.push(
          handler as (event?: { preventDefault?: () => void; stopPropagation?: () => void }) => unknown,
        );
      }
    },
    matches(sel: string) {
      if (sel === "[data-pattern-workspace-library-open]") {
        return attrs.has("data-pattern-workspace-library-open");
      }
      if (sel === "[data-pattern-workspace-library-item-card]") {
        return attrs.has("data-pattern-workspace-library-item-card");
      }
      if (sel === "[data-pattern-workspace-library-copy]") {
        return attrs.has("data-pattern-workspace-library-copy");
      }
      return false;
    },
    focus: vi.fn(),
  }) as unknown as MockEl;

  return el;
}

function collectMatches(nodes: MockEl[], sel: string): MockEl[] {
  const out: MockEl[] = [];
  for (const node of nodes) {
    if (node.matches?.(sel)) out.push(node);
    out.push(...collectMatches(node._children, sel));
  }
  return out;
}

function makeDrawerBindings(): PatternWorkspaceLibraryDrawerBindings & {
  status: MockEl;
  list: MockEl;
} {
  const bodyClassList = makeClassList();
  const doc = {
    body: { classList: bodyClassList },
    activeElement: null as HTMLElement | null,
    contains: () => false,
    addEventListener: vi.fn(),
    querySelectorAll: (sel: string) => {
      if (sel === "[data-pattern-workspace-library-trigger]") {
        return [trigger] as unknown as NodeListOf<Element>;
      }
      return [] as unknown as NodeListOf<Element>;
    },
  };

  const drawer = makeEl("div");
  const panel = makeEl("div");
  const trigger = makeEl("button") as unknown as HTMLButtonElement;
  const closeBtn = makeEl("button") as unknown as HTMLButtonElement;
  const backdrop = makeEl("div");
  const status = makeEl("p");
  const list = makeEl("ul");

  Object.defineProperty(drawer, "ownerDocument", { value: doc });
  Object.defineProperty(panel, "ownerDocument", { value: doc });
  Object.defineProperty(trigger, "ownerDocument", { value: doc });
  Object.defineProperty(closeBtn, "ownerDocument", { value: doc });
  Object.defineProperty(backdrop, "ownerDocument", { value: doc });
  Object.defineProperty(status, "ownerDocument", { value: doc });
  Object.defineProperty(list, "ownerDocument", { value: doc });

  drawer.querySelector = (sel: string) => {
    if (sel === "[data-pattern-workspace-library-status]") return status;
    if (sel === "[data-pattern-workspace-library-list]") return list;
    return collectMatches(list._children, sel)[0] ?? null;
  };
  drawer.querySelectorAll = (sel: string) => {
    if (
      sel === "[data-pattern-workspace-library-item-card]" ||
      sel === "[data-pattern-workspace-library-open]" ||
      sel === "[data-pattern-workspace-library-copy]"
    ) {
      return collectMatches(list._children, sel) as unknown as NodeListOf<HTMLElement>;
    }
    return [] as unknown as NodeListOf<HTMLElement>;
  };

  return { drawer, panel, trigger, closeBtn, backdrop, status, list };
}

describe("patternWorkspaceLibraryDrawer display helpers", () => {
  it("shows the pattern type without the internal Express / Custom Build source", () => {
    expect(
      formatCustomPatternProjectType({
        id: "p1",
        name: "Test",
        family: "sleeveless",
        source: "express",
      }),
    ).toBe("Sleeveless");
    expect(
      formatCustomPatternProjectType({
        id: "p2",
        name: "Test",
        family: "sleeveless",
        source: "custom-build",
      }),
    ).not.toMatch(/Express|Custom Build/);
    expect(formatCustomPatternProjectUpdatedAt("2026-01-15T12:00:00.000Z")).toMatch(/2026/);
  });

  it("builds a compact meta line with gauge and no Express", () => {
    const line = buildCustomPatternProjectMetaLine({
      id: "p1",
      name: "Test",
      family: "sleeveless",
      source: "express",
      updatedAt: "2026-05-31T12:00:00.000Z",
      gauge: { stitchesPerInch: 7, rowsPerInch: 11 },
    });
    expect(line).toContain("Sleeveless");
    expect(line).toContain("7 sts / 11 rows");
    expect(line).toContain("•");
    expect(line).not.toMatch(/Express/);
  });

  it("builds drawer lines with gauge on its own row", () => {
    const lines = buildCustomPatternProjectDrawerLines({
      id: "p1",
      name: "Test",
      family: "sleeveless",
      source: "express",
      updatedAt: "2026-05-31T12:00:00.000Z",
      gauge: {
        stitchesPerInch: 7,
        rowsPerInch: 11,
        displayStitches: 28,
        displayRows: 44,
      },
    });
    expect(lines.contextLine).toContain("Sleeveless");
    expect(lines.contextLine).not.toContain("28 sts");
    expect(lines.gaugeLine).toBe("28 sts / 44 rows");
  });

  it("formats a copy confirmation message focused on the next step", () => {
    expect(formatPatternCopiedDrawerMessage("Alpha pullover - Copy")).toMatch(
      /Pattern copied\./i,
    );
    expect(formatPatternCopiedDrawerMessage("Alpha pullover - Copy")).toContain(
      "Alpha pullover - Copy",
    );
    expect(formatPatternCopiedDrawerMessage("Alpha pullover - Copy")).toMatch(/ready to edit/i);
    expect(formatPatternCopiedDrawerMessage("")).toBe(
      "Pattern copied. Your new copy is ready to edit.",
    );
  });
});

describe("patternWorkspaceLibraryDrawer", () => {
  beforeEach(() => {
    stubLocalStorage();
    localStorage.clear();
    resetPatternWorkspaceLibraryDrawerSessionState();
    vi.clearAllMocks();
    listCustomPatternProjectsMock.mockResolvedValue({ ok: true, projects: [] });
    resolveAccessSnapshotMock.mockResolvedValue({
      loggedIn: true,
      memberId: "ms_member",
      hasSystemAccess: true,
      freeClaimsBySystem: {},
    });
    vi.stubGlobal("document", {
      createElement: (tag: string) => makeEl(tag),
    });
  });

  it("opens and closes with aria state and body scroll lock", () => {
    const bindings = makeDrawerBindings();
    const bodyClassList = bindings.drawer.ownerDocument.body.classList;

    openPatternWorkspaceLibraryDrawer(bindings);
    expect(bindings.drawer.classList.contains("is-open")).toBe(true);
    expect(bindings.drawer.getAttribute("aria-hidden")).toBe("false");
    expect(bindings.trigger.getAttribute("aria-expanded")).toBe("true");
    expect(bodyClassList.contains(PATTERN_WORKSPACE_LIBRARY_DRAWER_OPEN_CLASS)).toBe(true);

    closePatternWorkspaceLibraryDrawer(bindings);
    expect(bindings.drawer.classList.contains("is-open")).toBe(false);
    expect(bindings.drawer.getAttribute("aria-hidden")).toBe("true");
    expect(bindings.trigger.getAttribute("aria-expanded")).toBe("false");
    expect(bodyClassList.contains(PATTERN_WORKSPACE_LIBRARY_DRAWER_OPEN_CLASS)).toBe(false);
  });

  it("shows an empty state with a primary CTA to build a pattern", async () => {
    const bindings = makeDrawerBindings();
    listCustomPatternProjectsMock.mockResolvedValue({ ok: true, projects: [] });

    await refreshPatternWorkspaceLibraryList(bindings.drawer);

    expect(bindings.status.hidden).toBe(false);
    expect(bindings.list.hidden).toBe(true);
    const heading = bindings.status._children[0];
    const body = bindings.status._children[1];
    const ctaWrap = bindings.status._children[2];
    expect(heading.textContent).toBe("You haven't saved any patterns yet.");
    expect(body.textContent).toBe(
      "Build your first pattern and it will appear here for easy access.",
    );
    const cta = ctaWrap._children[0] as MockEl & { href?: string };
    expect(cta.textContent).toBe("Build Your First Pattern");
    expect(cta.href).toBe("/patterns");
    expect(cta.className).toContain("kbm-btn-primary");
    expect(bindings.status.textContent).not.toMatch(/Create|Customize/i);
  });

  it("renders saved projects and marks the active project", async () => {
    const bindings = makeDrawerBindings();
    writeActiveCustomPatternProjectId("proj-b", "Beta vest");

    listCustomPatternProjectsMock.mockResolvedValue({
      ok: true,
      projects: [
        {
          id: "proj-a",
          name: "Alpha pullover",
          family: "sleeveless",
          source: "express",
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
        {
          id: "proj-b",
          name: "Beta vest",
          family: "sleeveless",
          source: "custom-build",
          updatedAt: "2026-01-02T00:00:00.000Z",
        },
      ],
    });

    await refreshPatternWorkspaceLibraryList(bindings.drawer);

    const cards = bindings.drawer.querySelectorAll("[data-pattern-workspace-library-item-card]");
    expect(cards.length).toBe(2);
    const active = Array.from(cards).find((card) => card.classList.contains("is-active"));
    expect(active?.dataset.projectId).toBe("proj-b");
    expect(bindings.list.hidden).toBe(false);
    expect(bindings.status.hidden).toBe(true);
  });

  it("renders gauge in the saved project meta and never shows Express", async () => {
    const bindings = makeDrawerBindings();
    listCustomPatternProjectsMock.mockResolvedValue({
      ok: true,
      projects: [
        {
          id: "proj-a",
          name: "Alpha pullover",
          family: "sleeveless",
          source: "express",
          updatedAt: "2026-05-31T00:00:00.000Z",
          gauge: { stitchesPerInch: 7, rowsPerInch: 11, displayStitches: 28, displayRows: 44 },
        },
      ],
    });

    await refreshPatternWorkspaceLibraryList(bindings.drawer);

    const cards = bindings.drawer.querySelectorAll("[data-pattern-workspace-library-item-card]");
    // Drawer item structure: card > [body > [titleRow, context, gauge], actions > [open, copy]].
    const card = Array.from(cards)[0] as unknown as MockEl;
    const body = card._children[0];
    const contextEl = body._children[1];
    const gaugeEl = body._children[2];
    expect(contextEl.textContent).toContain("Sleeveless");
    expect(contextEl.textContent).not.toContain("7 sts / 11 rows");
    expect(gaugeEl.textContent).toBe("28 sts / 44 rows");
    expect(gaugeEl.textContent).not.toMatch(/Express/);
  });

  it("opens a saved project via redirect href", async () => {
    const bindings = makeDrawerBindings();
    const assign = vi.fn();
    vi.stubGlobal("window", { location: { assign } });

    listCustomPatternProjectsMock.mockResolvedValue({
      ok: true,
      projects: [
        {
          id: "proj-a",
          name: "Alpha pullover",
          family: "sleeveless",
          source: "express",
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
      ],
    });
    loadSavedCustomPatternProjectMock.mockResolvedValue({
      ok: true,
      redirectHref: "/patterns/sleeveless/pattern/",
    });

    await refreshPatternWorkspaceLibraryList(bindings.drawer);
    const btn = bindings.drawer.querySelector(
      "[data-pattern-workspace-library-open]",
    ) as MockEl | null;
    expect(btn?._click).toBeTypeOf("function");
    await btn?._click?.();

    expect(loadSavedCustomPatternProjectMock).toHaveBeenCalledWith("proj-a", "open");
    expect(assign).toHaveBeenCalledWith("/patterns/sleeveless/pattern/");
  });

  it("renders Open Pattern as the primary action and Copy Pattern as secondary", async () => {
    const bindings = makeDrawerBindings();
    vi.stubGlobal("window", {});
    listCustomPatternProjectsMock.mockResolvedValue({
      ok: true,
      projects: [
        { id: "proj-a", name: "Alpha pullover", family: "sleeveless", source: "express", updatedAt: "2026-01-01T00:00:00.000Z" },
      ],
    });

    await refreshPatternWorkspaceLibraryList(bindings.drawer);

    const openBtns = collectMatches(bindings.list._children, "[data-pattern-workspace-library-open]");
    const copyBtns = collectMatches(bindings.list._children, "[data-pattern-workspace-library-copy]");
    expect(openBtns.length).toBe(1);
    expect(openBtns[0].textContent).toBe("Open Pattern");
    expect(copyBtns.length).toBe(1);
    expect(copyBtns[0].textContent).toBe("Copy Pattern");
    expect(copyBtns[0].disabled).toBe(false);
  });

  it("copies a saved project from the drawer and highlights the new copy", async () => {
    const bindings = makeDrawerBindings();
    vi.stubGlobal("window", {});
    listCustomPatternProjectsMock
      .mockResolvedValueOnce({
        ok: true,
        projects: [
          { id: "proj-a", name: "Alpha pullover", family: "sleeveless", source: "express", updatedAt: "2026-01-01T00:00:00.000Z" },
        ],
      })
      .mockResolvedValueOnce({
        ok: true,
        projects: [
          {
            id: "proj-a-copy",
            name: "Alpha pullover - Copy",
            family: "sleeveless",
            source: "express",
            updatedAt: "2026-01-02T00:00:00.000Z",
            gauge: { stitchesPerInch: 4, rowsPerInch: 6 },
          },
          { id: "proj-a", name: "Alpha pullover", family: "sleeveless", source: "express", updatedAt: "2026-01-01T00:00:00.000Z" },
        ],
      });
    copyByIdMock.mockResolvedValue({
      ok: true,
      project: { id: "proj-a-copy", name: "Alpha pullover - Copy" },
    });

    await refreshPatternWorkspaceLibraryList(bindings.drawer);
    const copyBtn = collectMatches(bindings.list._children, "[data-pattern-workspace-library-copy]")[0];
    await copyBtn?._click?.();

    expect(copyByIdMock).toHaveBeenCalledWith("proj-a", "sleeveless");
    expect(bindings.status.textContent).toMatch(/Pattern copied\./i);
    expect(bindings.status.textContent).toMatch(/ready to edit/i);

    const cards = bindings.drawer.querySelectorAll("[data-pattern-workspace-library-item-card]");
    const firstCard = Array.from(cards)[0] as unknown as MockEl;
    expect(firstCard.dataset.projectId).toBe("proj-a-copy");
    expect(firstCard.classList.contains("is-new-copy")).toBe(true);
    const badge = firstCard._children[0]._children[0]._children[1];
    expect(badge?.textContent).toBe("New copy");
  });

  it("keeps the drawer Copy action visible but disabled for free / non-owner users", async () => {
    const bindings = makeDrawerBindings();
    vi.stubGlobal("window", {});
    resolveAccessSnapshotMock.mockResolvedValue(
      testAccess({
        loggedIn: true,
        memberId: "ms_nosub",
        hasSystemAccess: false,
        freeClaimed: true,
        freeClaimedPatternId: "proj-a",
      }),
    );
    listCustomPatternProjectsMock.mockResolvedValue({
      ok: true,
      projects: [
        { id: "proj-a", name: "Alpha pullover", family: "sleeveless", source: "express", updatedAt: "2026-01-01T00:00:00.000Z" },
      ],
    });

    await refreshPatternWorkspaceLibraryList(bindings.drawer);
    const copyBtn = collectMatches(bindings.list._children, "[data-pattern-workspace-library-copy]")[0];

    expect(copyBtn.textContent).toBe("Copy Pattern");
    expect(copyBtn.disabled).toBe(false);
    expect(copyBtn.getAttribute("aria-disabled")).toBe("true");
    expect(copyBtn.getAttribute("title")).toMatch(/included with membership/i);

    await copyBtn?._click?.();
    expect(copyByIdMock).not.toHaveBeenCalled();
  });

  it("shows sign-in message when listing requires auth", async () => {
    const bindings = makeDrawerBindings();
    listCustomPatternProjectsMock.mockResolvedValue({
      ok: false,
      error: "Sign in to save Custom Pattern projects.",
    });

    await refreshPatternWorkspaceLibraryList(bindings.drawer);

    expect(bindings.status.textContent).toMatch(/sign in/i);
    expect(bindings.list.hidden).toBe(true);
  });

  it("returns null bindings when drawer markup is missing", () => {
    const doc = {
      querySelector: () => null,
    } as unknown as Document;
    expect(resolvePatternWorkspaceLibraryDrawerBindings(doc)).toBeNull();
    clearActiveCustomPatternProjectId();
  });

  it("syncs aria-expanded on every My Patterns trigger when opening and closing", () => {
    const bindings = makeDrawerBindings();
    const headerTrigger = bindings.trigger;
    const workspaceTrigger = makeEl("button");
    const doc = bindings.drawer.ownerDocument as Document & {
      querySelectorAll: (sel: string) => MockEl[];
    };
    doc.querySelectorAll = (sel: string) => {
      if (sel === "[data-pattern-workspace-library-trigger]") {
        return [headerTrigger, workspaceTrigger];
      }
      return [];
    };

    openPatternWorkspaceLibraryDrawer(bindings);
    expect(headerTrigger.getAttribute("aria-expanded")).toBe("true");
    expect(workspaceTrigger.getAttribute("aria-expanded")).toBe("true");

    closePatternWorkspaceLibraryDrawer(bindings);
    expect(headerTrigger.getAttribute("aria-expanded")).toBe("false");
    expect(workspaceTrigger.getAttribute("aria-expanded")).toBe("false");
  });

  it("initializes once, binds all triggers, and keeps in-drawer controls clickable", async () => {
    const bodyClassList = makeClassList();
    const rootAttrs = new Map<string, string>();
    const documentClickHandlers: Array<(event: { target: MockEl; preventDefault: () => void }) => void> = [];

    const doc = {
      body: { classList: bodyClassList },
      documentElement: {
        getAttribute: (name: string) => rootAttrs.get(name) ?? null,
        setAttribute: (name: string, value: string) => rootAttrs.set(name, value),
      },
      activeElement: null as HTMLElement | null,
      contains: () => true,
      addEventListener: vi.fn((event: string, handler: (e: unknown) => void) => {
        if (event === "click") documentClickHandlers.push(handler as typeof documentClickHandlers[number]);
      }),
      querySelector: (sel: string) => {
        if (sel === "[data-pattern-workspace-library-drawer]") return drawer;
        if (sel === "#pattern-workspace-library-drawer-panel") return panel;
        if (sel === "[data-pattern-workspace-library-close]") return closeBtn;
        if (sel === "[data-pattern-workspace-library-backdrop]") return backdrop;
        if (sel === "[data-pattern-workspace-library-trigger]") return headerTrigger;
        return null;
      },
      querySelectorAll: (sel: string) => {
        if (sel === "[data-pattern-workspace-library-trigger]") {
          return [headerTrigger, workspaceTrigger] as unknown as NodeListOf<Element>;
        }
        return [] as unknown as NodeListOf<Element>;
      },
    } as unknown as Document;

    const drawer = makeEl("div");
    const panel = makeEl("div");
    const headerTrigger = makeEl("a");
    const workspaceTrigger = makeEl("button");
    const closeBtn = makeEl("button");
    const backdrop = makeEl("div");
    const status = makeEl("div");
    const list = makeEl("ul");

    headerTrigger.setAttribute("data-pattern-workspace-library-trigger", "");
    workspaceTrigger.setAttribute("data-pattern-workspace-library-trigger", "");

    for (const el of [drawer, panel, headerTrigger, workspaceTrigger, closeBtn, backdrop, status, list]) {
      Object.defineProperty(el, "ownerDocument", { value: doc });
    }

    drawer.querySelector = (sel: string) => {
      if (sel === "[data-pattern-workspace-library-status]") return status;
      if (sel === "[data-pattern-workspace-library-list]") return list;
      return collectMatches(list._children, sel)[0] ?? null;
    };
    drawer.querySelectorAll = (sel: string) => {
      if (
        sel === "[data-pattern-workspace-library-item-card]" ||
        sel === "[data-pattern-workspace-library-open]" ||
        sel === "[data-pattern-workspace-library-copy]"
      ) {
        return collectMatches(list._children, sel) as unknown as NodeListOf<HTMLElement>;
      }
      return [] as unknown as NodeListOf<HTMLElement>;
    };

    listCustomPatternProjectsMock.mockResolvedValue({
      ok: true,
      projects: [
        {
          id: "proj-a",
          name: "Alpha pullover",
          family: "sleeveless",
          source: "express",
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
      ],
    });
    loadSavedCustomPatternProjectMock.mockResolvedValue({
      ok: true,
      redirectHref: "/patterns/sleeveless/pattern/",
    });
    const assign = vi.fn();
    vi.stubGlobal("window", { location: { assign } });

    initPatternWorkspaceLibraryDrawer(doc);
    initPatternWorkspaceLibraryDrawer(doc);
    expect(rootAttrs.get(PATTERN_WORKSPACE_LIBRARY_DRAWER_INIT_ATTR)).toBe("true");

    await headerTrigger._click?.({ preventDefault: vi.fn() });
    expect(drawer.classList.contains("is-open")).toBe(true);

    await refreshPatternWorkspaceLibraryList(drawer);
    const openBtn = drawer.querySelector(
      "[data-pattern-workspace-library-open]",
    ) as MockEl | null;
    expect(openBtn?._click).toBeTypeOf("function");

    let documentDismissCalled = false;
    documentClickHandlers.forEach((handler) =>
      handler({
        target: openBtn as MockEl,
        preventDefault: () => {
          documentDismissCalled = true;
        },
      }),
    );
    expect(documentDismissCalled).toBe(false);

    await openBtn?._click?.();
    expect(loadSavedCustomPatternProjectMock).toHaveBeenCalledWith("proj-a", "open");
    expect(assign).toHaveBeenCalledWith("/patterns/sleeveless/pattern/");

    await backdrop._click?.();
    expect(drawer.classList.contains("is-open")).toBe(false);

    await workspaceTrigger._click?.({ preventDefault: vi.fn() });
    expect(drawer.classList.contains("is-open")).toBe(true);
    expect(workspaceTrigger.getAttribute("aria-expanded")).toBe("true");
    expect(headerTrigger.getAttribute("aria-expanded")).toBe("true");
  });
});
