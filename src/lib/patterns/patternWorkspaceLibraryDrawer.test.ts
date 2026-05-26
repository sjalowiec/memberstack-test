import { beforeEach, describe, expect, it, vi } from "vitest";
import { stubLocalStorage } from "./test/stubLocalStorage";
import {
  clearActiveCustomPatternProjectId,
  readActiveCustomPatternProjectId,
  writeActiveCustomPatternProjectId,
} from "./customPatternProjectActiveId";
import {
  closePatternWorkspaceLibraryDrawer,
  formatCustomPatternProjectType,
  formatCustomPatternProjectUpdatedAt,
  openPatternWorkspaceLibraryDrawer,
  PATTERN_WORKSPACE_LIBRARY_DRAWER_OPEN_CLASS,
  refreshPatternWorkspaceLibraryList,
  resolvePatternWorkspaceLibraryDrawerBindings,
} from "./patternWorkspaceLibraryDrawer";
import type { PatternWorkspaceLibraryDrawerBindings } from "./patternWorkspaceLibraryDrawer";

const listCustomPatternProjectsMock = vi.fn();
const loadSavedCustomPatternProjectMock = vi.fn();

vi.mock("./customPatternProjectClient", () => ({
  listCustomPatternProjects: (...args: unknown[]) => listCustomPatternProjectsMock(...args),
}));

vi.mock("./loadSavedCustomPatternProject", () => ({
  loadSavedCustomPatternProject: (...args: unknown[]) => loadSavedCustomPatternProjectMock(...args),
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
    setAttribute(name: string, value: string) {
      attrs.set(name, value);
    },
    getAttribute(name: string) {
      return attrs.get(name) ?? null;
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
    addEventListener(event: string, handler: () => unknown) {
      if (event === "click") el._click = handler;
    },
    matches(sel: string) {
      if (sel === "[data-pattern-workspace-library-item]") {
        return attrs.has("data-pattern-workspace-library-item");
      }
      if (sel === "[data-pattern-workspace-library-item-card]") {
        return attrs.has("data-pattern-workspace-library-item-card");
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
    if (sel === "[data-pattern-workspace-library-item]") {
      return collectMatches(list._children, sel)[0] ?? null;
    }
    return null;
  };
  drawer.querySelectorAll = (sel: string) => {
    if (
      sel === "[data-pattern-workspace-library-item]" ||
      sel === "[data-pattern-workspace-library-item-card]"
    ) {
      return collectMatches(list._children, sel) as unknown as NodeListOf<HTMLElement>;
    }
    return [] as unknown as NodeListOf<HTMLElement>;
  };

  return { drawer, panel, trigger, closeBtn, backdrop, status, list };
}

describe("patternWorkspaceLibraryDrawer display helpers", () => {
  it("formats project type and updated date", () => {
    expect(
      formatCustomPatternProjectType({
        id: "p1",
        name: "Test",
        family: "sleeveless",
        source: "express",
      }),
    ).toBe("Sleeveless · Express");
    expect(formatCustomPatternProjectUpdatedAt("2026-01-15T12:00:00.000Z")).toMatch(/2026/);
  });
});

describe("patternWorkspaceLibraryDrawer", () => {
  beforeEach(() => {
    stubLocalStorage();
    localStorage.clear();
    vi.clearAllMocks();
    listCustomPatternProjectsMock.mockResolvedValue({ ok: true, projects: [] });
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
      "[data-pattern-workspace-library-item]",
    ) as MockEl | null;
    expect(btn?._click).toBeTypeOf("function");
    await btn?._click?.();

    expect(loadSavedCustomPatternProjectMock).toHaveBeenCalledWith("proj-a", "open");
    expect(assign).toHaveBeenCalledWith("/patterns/sleeveless/pattern/");
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
});
