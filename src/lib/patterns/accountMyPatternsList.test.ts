import { beforeEach, describe, expect, it, vi } from "vitest";
import { stubLocalStorage } from "./test/stubLocalStorage";
import {
  ACCOUNT_MY_PATTERNS_GROUP_PREVIEW_LIMIT,
  buildAccountMyPatternsGroups,
  formatAccountMyPatternsCountLabel,
  initAccountMyPatternsList,
  resolveAccountMyPatternsSystem,
} from "./accountMyPatternsList";

const listCustomPatternProjectsMock = vi.fn();
const deleteCustomPatternProjectMock = vi.fn();
const copyByIdMock = vi.fn();
const renameMock = vi.fn();

vi.mock("./customPatternProjectClient", () => ({
  listCustomPatternProjects: (...args: unknown[]) => listCustomPatternProjectsMock(...args),
  deleteCustomPatternProject: (...args: unknown[]) => deleteCustomPatternProjectMock(...args),
}));

vi.mock("./savedCustomPatternManageActions", () => ({
  copySavedCustomPatternProjectById: (...args: unknown[]) => copyByIdMock(...args),
  renameSavedCustomPatternProject: (...args: unknown[]) => renameMock(...args),
}));

const loadSavedCustomPatternProjectMock = vi.fn();
vi.mock("./loadSavedCustomPatternProject", () => ({
  loadSavedCustomPatternProject: (...args: unknown[]) => loadSavedCustomPatternProjectMock(...args),
}));

const offerPatternEditingUnlockModalMock = vi.fn(() => true);
vi.mock("./patternEditingUnlockModal", () => ({
  offerPatternEditingUnlockModal: (...args: unknown[]) => offerPatternEditingUnlockModalMock(...args),
}));

vi.mock("./sleevelessPatternLoginGate", () => ({
  waitForMemberstackDom: vi.fn().mockResolvedValue(false),
  waitForMemberstackReady: vi.fn().mockResolvedValue(undefined),
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
  _toggle?: () => unknown;
  _children: MockEl[];
  open?: boolean;
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
    tabIndex: 0,
    open: false,
    dataset: {} as DOMStringMap,
    _children: [] as MockEl[],
    setAttribute(name: string, value: string) {
      attrs.set(name, value);
      if (name.startsWith("data-")) {
        const key = name
          .slice(5)
          .replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
        (el.dataset as Record<string, string>)[key] = value;
      }
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
      return findFirst(el._children, sel);
    },
    querySelectorAll(sel: string) {
      return collectMatches(el._children, sel) as unknown as NodeListOf<Element>;
    },
    addEventListener(event: string, handler: (...args: unknown[]) => unknown) {
      if (event === "click") {
        el._click = async () => {
          await handler({ stopPropagation: () => {} });
        };
      }
      if (event === "toggle") {
        el._toggle = async () => {
          await handler({});
        };
      }
    },
    matches(sel: string) {
      if (sel === "[data-kbm-my-patterns-row]") return attrs.has("data-kbm-my-patterns-row");
      if (sel === "[data-kbm-my-patterns-group]") return attrs.has("data-kbm-my-patterns-group");
      if (sel === "[data-kbm-my-patterns-view]") return attrs.has("data-kbm-my-patterns-view");
      if (sel === "[data-kbm-my-patterns-edit]") return attrs.has("data-kbm-my-patterns-edit");
      if (sel === "[data-kbm-my-patterns-copy]") return attrs.has("data-kbm-my-patterns-copy");
      if (sel === "[data-kbm-my-patterns-rename]") return attrs.has("data-kbm-my-patterns-rename");
      if (sel === "[data-kbm-my-patterns-delete]") return attrs.has("data-kbm-my-patterns-delete");
      return false;
    },
    focus: vi.fn(),
  }) as unknown as MockEl;

  return el;
}

function findFirst(nodes: MockEl[], sel: string): MockEl | null {
  for (const node of nodes) {
    if (node.matches?.(sel)) return node;
    const nested = findFirst(node._children, sel);
    if (nested) return nested;
  }
  return null;
}

function collectMatches(nodes: MockEl[], sel: string): MockEl[] {
  const out: MockEl[] = [];
  for (const node of nodes) {
    if (node.matches?.(sel)) out.push(node);
    out.push(...collectMatches(node._children, sel));
  }
  return out;
}

function makeAccountRoot() {
  const root = makeEl("section");
  root.setAttribute("data-kbm-my-patterns", "");

  const status = makeEl("p");
  status.setAttribute("data-kbm-my-patterns-status", "");

  const emptyCta = makeEl("div");
  emptyCta.setAttribute("data-kbm-my-patterns-empty-cta", "");
  emptyCta.hidden = true;

  const list = makeEl("div");
  list.setAttribute("data-kbm-my-patterns-list-wrap", "");
  list.setAttribute("data-kbm-my-patterns-list", "");
  list.hidden = true;

  const viewAllWrap = makeEl("p");
  viewAllWrap.setAttribute("data-kbm-my-patterns-view-all-wrap", "");
  viewAllWrap.hidden = true;

  root.append(status, emptyCta, list, viewAllWrap);

  root.querySelector = (sel: string) => {
    if (sel === "[data-kbm-my-patterns-status]") return status;
    if (sel === "[data-kbm-my-patterns-empty-cta]") return emptyCta;
    if (sel === "[data-kbm-my-patterns-list-wrap]") return list;
    if (sel === "[data-kbm-my-patterns-list]") return list;
    if (sel === "[data-kbm-my-patterns-view-all-wrap]") return viewAllWrap;
    return findFirst(list._children, sel);
  };
  root.querySelectorAll = (sel: string) =>
    collectMatches(list._children, sel) as unknown as NodeListOf<HTMLElement>;

  return { root, status, list, viewAllWrap, emptyCta };
}

const flushAsync = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

const sampleProjects = [
  {
    id: "proj-a",
    name: "Alpha pullover",
    family: "sleeveless" as const,
    source: "express" as const,
    patternSystem: "sleeveless",
    updatedAt: "2026-01-01T00:00:00.000Z",
    gauge: { stitchesPerInch: 7, rowsPerInch: 11 },
  },
  {
    id: "proj-b",
    name: "Beta vest",
    family: "sleeveless" as const,
    source: "custom-build" as const,
    patternSystem: "sleeveless",
    updatedAt: "2026-01-02T00:00:00.000Z",
  },
];

describe("accountMyPatterns grouping helpers", () => {
  it("resolves canonical pattern systems and defaults unknown values to sleeveless", () => {
    expect(resolveAccountMyPatternsSystem({ patternSystem: "drop-shoulder" })).toBe("drop-shoulder");
    expect(resolveAccountMyPatternsSystem({ patternSystem: "raglan" })).toBe("raglan");
    expect(resolveAccountMyPatternsSystem({ patternSystem: "mystery" })).toBe("sleeveless");
    expect(resolveAccountMyPatternsSystem({})).toBe("sleeveless");
  });

  it("formats singular and plural pattern counts", () => {
    expect(formatAccountMyPatternsCountLabel(1)).toBe("1 pattern");
    expect(formatAccountMyPatternsCountLabel(3)).toBe("3 patterns");
  });

  it("groups by pattern system, newest group first, and newest patterns within a group", () => {
    const groups = buildAccountMyPatternsGroups([
      {
        id: "s1",
        name: "Old sleeveless",
        family: "sleeveless",
        source: "express",
        patternSystem: "sleeveless",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
        version: 1,
      },
      {
        id: "d1",
        name: "Newer drop",
        family: "sleeveless",
        source: "express",
        patternSystem: "drop-shoulder",
        createdAt: "2026-01-03T00:00:00.000Z",
        updatedAt: "2026-01-03T00:00:00.000Z",
        version: 1,
      },
      {
        id: "s2",
        name: "Newer sleeveless",
        family: "sleeveless",
        source: "express",
        patternSystem: "sleeveless",
        createdAt: "2026-01-02T00:00:00.000Z",
        updatedAt: "2026-01-02T00:00:00.000Z",
        version: 1,
      },
    ]);

    expect(groups.map((g) => g.patternSystem)).toEqual(["drop-shoulder", "sleeveless"]);
    expect(groups[0].label).toBe("Drop Shoulder");
    expect(groups[0].projects.map((p) => p.id)).toEqual(["d1"]);
    expect(groups[1].projects.map((p) => p.id)).toEqual(["s2", "s1"]);
  });
});

describe("accountMyPatternsList", () => {
  beforeEach(() => {
    stubLocalStorage();
    localStorage.clear();
    vi.clearAllMocks();
    listCustomPatternProjectsMock.mockResolvedValue({ ok: true, projects: [] });
    deleteCustomPatternProjectMock.mockResolvedValue({ ok: true });
    copyByIdMock.mockResolvedValue({ ok: true, project: {} });
    renameMock.mockResolvedValue({ ok: true, project: {} });
    loadSavedCustomPatternProjectMock.mockResolvedValue({
      ok: true,
      redirectHref: "/patterns/sleeveless/pattern/",
    });
    vi.stubGlobal("document", {
      createElement: (tag: string) => makeEl(tag),
    });
  });

  it("renders accordion groups with Open and Edit only", async () => {
    const { root, list, viewAllWrap } = makeAccountRoot();
    listCustomPatternProjectsMock.mockResolvedValue({
      ok: true,
      projects: sampleProjects,
    });

    await initAccountMyPatternsList(root);

    expect(list.hidden).toBe(false);
    expect(viewAllWrap.hidden).toBe(false);

    const groups = collectMatches(list._children, "[data-kbm-my-patterns-group]");
    expect(groups.length).toBe(1);
    expect(groups[0].open).toBe(false);
    expect(groups[0]._children[0]?._children[0]?.textContent).toBe("Sleeveless · 2 patterns");

    const rows = collectMatches(list._children, "[data-kbm-my-patterns-row]");
    expect(rows.length).toBe(2);

    expect(collectMatches(list._children, "[data-kbm-my-patterns-view]").length).toBe(2);
    expect(collectMatches(list._children, "[data-kbm-my-patterns-edit]").length).toBe(2);
    expect(collectMatches(list._children, "[data-kbm-my-patterns-copy]").length).toBe(0);
    expect(collectMatches(list._children, "[data-kbm-my-patterns-rename]").length).toBe(0);
    expect(collectMatches(list._children, "[data-kbm-my-patterns-delete]").length).toBe(0);
    expect(collectMatches(list._children, "[data-kbm-my-patterns-view]")[0].textContent).toBe("Open");
  });

  it("starts every pattern-system accordion collapsed", async () => {
    const { root, list } = makeAccountRoot();
    listCustomPatternProjectsMock.mockResolvedValue({
      ok: true,
      projects: [
        {
          id: "s1",
          name: "Sleeveless old",
          family: "sleeveless",
          source: "express",
          patternSystem: "sleeveless",
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
        {
          id: "d1",
          name: "Drop newest",
          family: "sleeveless",
          source: "express",
          patternSystem: "drop-shoulder",
          updatedAt: "2026-02-01T00:00:00.000Z",
        },
      ],
    });

    await initAccountMyPatternsList(root);

    const groups = collectMatches(list._children, "[data-kbm-my-patterns-group]");
    expect(groups.map((g) => g.dataset.patternSystem)).toEqual(["drop-shoulder", "sleeveless"]);
    expect(groups.every((g) => g.open === false)).toBe(true);
    expect(groups[0]._children[0]?._children[0]?.textContent).toBe("Drop Shoulder · 1 pattern");
  });

  it("limits each group preview to three recent patterns", async () => {
    const { root, list } = makeAccountRoot();
    const many = Array.from({ length: 5 }, (_, i) => ({
      id: `proj-${i}`,
      name: `Pattern ${i}`,
      family: "sleeveless" as const,
      source: "express" as const,
      patternSystem: "sleeveless",
      updatedAt: `2026-01-${String(i + 1).padStart(2, "0")}T00:00:00.000Z`,
    }));
    listCustomPatternProjectsMock.mockResolvedValue({ ok: true, projects: many });

    await initAccountMyPatternsList(root);

    const rows = collectMatches(list._children, "[data-kbm-my-patterns-row]");
    expect(rows.length).toBe(ACCOUNT_MY_PATTERNS_GROUP_PREVIEW_LIMIT);
    const names = rows.map((row) => row._children[0]?._children[0]?.textContent);
    expect(names).toEqual(["Pattern 4", "Pattern 3", "Pattern 2"]);
  });

  it("shows gauge and updated date on a secondary meta line", async () => {
    const { root, list } = makeAccountRoot();
    listCustomPatternProjectsMock.mockResolvedValue({ ok: true, projects: sampleProjects });
    vi.stubGlobal("window", {});

    await initAccountMyPatternsList(root);

    const rows = collectMatches(list._children, "[data-kbm-my-patterns-row]");
    const alpha = rows.find((r) => r._children[0]?._children[0]?.textContent === "Alpha pullover");
    expect(alpha).toBeTruthy();
    const alphaMeta = alpha!._children[0]?._children[1]?._children ?? [];
    expect(alphaMeta[0]?.textContent).toBe("7 sts / 11 rows");
    expect(alphaMeta[2]?.textContent).toMatch(/^Updated /);
    expect(alphaMeta.map((n) => n.textContent).join("")).not.toMatch(/Sleeveless|Express/);

    const beta = rows.find((r) => r._children[0]?._children[0]?.textContent === "Beta vest");
    expect(beta?._children[0]?._children[1]?._children[0]?.textContent).toBe("Gauge not set");
  });

  it("opens a saved pattern from the Open action", async () => {
    const { root, list } = makeAccountRoot();
    listCustomPatternProjectsMock.mockResolvedValue({ ok: true, projects: sampleProjects });
    const assign = vi.fn();
    vi.stubGlobal("window", { location: { assign } });

    await initAccountMyPatternsList(root);

    const openA = collectMatches(list._children, "[data-kbm-my-patterns-view]").find(
      (b) => b.dataset.projectId === "proj-a",
    );
    await openA?._click?.();
    await flushAsync();

    expect(loadSavedCustomPatternProjectMock).toHaveBeenCalledWith("proj-a", "view");
    expect(assign).toHaveBeenCalledWith("/patterns/sleeveless/pattern/");
  });

  it("edits a saved pattern from the Edit action when entitled", async () => {
    const { root, list } = makeAccountRoot();
    listCustomPatternProjectsMock.mockResolvedValue({ ok: true, projects: sampleProjects });
    const assign = vi.fn();
    vi.stubGlobal("window", {
      location: { assign },
      $memberstackDom: {
        getCurrentMember: async () => ({
          data: {
            id: "ms_member",
            planConnections: [{ planId: "pln_kin-membership-annual-qf9g01et" }],
          },
        }),
        getMemberJSON: async () => ({ data: {} }),
      },
    });
    loadSavedCustomPatternProjectMock.mockResolvedValue({
      ok: true,
      redirectHref: "/patterns/sleeveless/custom-build/design/?edit=choices",
    });

    await initAccountMyPatternsList(root);

    const editA = collectMatches(list._children, "[data-kbm-my-patterns-edit]").find(
      (b) => b.dataset.projectId === "proj-a",
    );
    await editA?._click?.();
    await flushAsync();

    expect(loadSavedCustomPatternProjectMock).toHaveBeenCalledWith("proj-a", "open");
    expect(assign).toHaveBeenCalledWith("/patterns/sleeveless/custom-build/design/?edit=choices");
  });

  it("locks Edit for free users and offers the unlock modal", async () => {
    const { root, list } = makeAccountRoot();
    listCustomPatternProjectsMock.mockResolvedValue({ ok: true, projects: sampleProjects });
    vi.stubGlobal("window", {
      $memberstackDom: {
        getCurrentMember: async () => ({ data: { id: "ms_free" } }),
        getMemberJSON: async () => ({
          data: { freeSleevelessPatternClaimed: true, freeSleevelessPatternId: "proj-a" },
        }),
      },
    });

    await initAccountMyPatternsList(root);

    const editBtns = collectMatches(list._children, "[data-kbm-my-patterns-edit]");
    expect(editBtns.every((b) => b.getAttribute("aria-disabled") === "true")).toBe(true);

    const editA = editBtns.find((b) => b.dataset.projectId === "proj-a");
    await editA?._click?.();
    await flushAsync();

    expect(loadSavedCustomPatternProjectMock).not.toHaveBeenCalled();
    expect(offerPatternEditingUnlockModalMock).toHaveBeenCalledTimes(1);
  });

  it("opens the unlock modal for a drop-shoulder free user Edit click", async () => {
    const dropShoulderProject = {
      id: "proj-ds",
      name: "Drop shoulder pullover",
      family: "sleeveless" as const,
      source: "express" as const,
      patternSystem: "drop-shoulder" as const,
      updatedAt: "2026-02-01T00:00:00.000Z",
    };
    const { root, list } = makeAccountRoot();
    listCustomPatternProjectsMock.mockResolvedValue({ ok: true, projects: [dropShoulderProject] });
    vi.stubGlobal("window", {
      $memberstackDom: {
        getCurrentMember: async () => ({ data: { id: "ms_free" } }),
        getMemberJSON: async () => ({
          data: {
            freePatternClaimsBySystem: {
              "drop-shoulder": { claimed: true, patternId: "proj-ds" },
            },
          },
        }),
      },
    });

    await initAccountMyPatternsList(root);

    const editBtn = collectMatches(list._children, "[data-kbm-my-patterns-edit]")[0];
    expect(editBtn?.getAttribute("aria-disabled")).toBe("true");
    await editBtn?._click?.();
    await flushAsync();

    expect(loadSavedCustomPatternProjectMock).not.toHaveBeenCalled();
    expect(offerPatternEditingUnlockModalMock).toHaveBeenCalledWith(
      expect.objectContaining({ loggedIn: true, hasSystemAccess: false }),
      expect.objectContaining({ patternSystem: "drop-shoulder" }),
    );
  });

  it("shows the empty state when there are no saved patterns", async () => {
    const { root, status, list, emptyCta, viewAllWrap } = makeAccountRoot();
    listCustomPatternProjectsMock.mockResolvedValue({ ok: true, projects: [] });

    await initAccountMyPatternsList(root);

    expect(list.hidden).toBe(true);
    expect(viewAllWrap.hidden).toBe(true);
    expect(emptyCta.hidden).toBe(false);
    expect(status.textContent).toMatch(/do not have any saved patterns yet/i);
  });
});
