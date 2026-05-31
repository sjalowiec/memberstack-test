import { beforeEach, describe, expect, it, vi } from "vitest";
import { stubLocalStorage } from "./test/stubLocalStorage";
import {
  clearActiveCustomPatternProjectId,
  readActiveCustomPatternProjectId,
  writeActiveCustomPatternProjectId,
} from "./customPatternProjectActiveId";
import {
  DELETE_SAVED_PATTERN_CONFIRM_MESSAGE,
  initAccountMyPatternsList,
} from "./accountMyPatternsList";

const listCustomPatternProjectsMock = vi.fn();
const deleteCustomPatternProjectMock = vi.fn();
const copySavedCustomPatternProjectMock = vi.fn();
const copyAccessState = { canCopy: true };

vi.mock("./customPatternProjectClient", () => ({
  listCustomPatternProjects: (...args: unknown[]) => listCustomPatternProjectsMock(...args),
  deleteCustomPatternProject: (...args: unknown[]) => deleteCustomPatternProjectMock(...args),
}));

vi.mock("./loadSavedCustomPatternProject", () => ({
  loadSavedCustomPatternProject: vi.fn(),
}));

vi.mock("./copySavedCustomPatternProject", () => ({
  copySavedCustomPatternProject: (...args: unknown[]) => copySavedCustomPatternProjectMock(...args),
}));

vi.mock("./savedCustomPatternCopyAccess", () => ({
  canCopySavedCustomPatternProject: () => copyAccessState.canCopy,
  SAVED_PATTERN_COPY_LOCKED_HELP_TEXT:
    "Copy is available when you purchase this pattern or become a member.",
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
    tabIndex: 0,
    dataset: {} as DOMStringMap,
    _children: [] as MockEl[],
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
    },
    matches(sel: string) {
      if (sel === "[data-kbm-my-patterns-row]") return attrs.has("data-kbm-my-patterns-row");
      if (sel === "[data-kbm-my-patterns-delete]") return attrs.has("data-kbm-my-patterns-delete");
      if (sel === "[data-kbm-my-patterns-copy]") return attrs.has("data-kbm-my-patterns-copy");
      if (sel === "[data-kbm-my-patterns-sort]") return attrs.has("data-kbm-my-patterns-sort");
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

  const listWrap = makeEl("div");
  listWrap.setAttribute("data-kbm-my-patterns-list-wrap", "");
  listWrap.hidden = true;

  const table = makeEl("table");
  const thead = makeEl("thead");
  const sortName = makeEl("button");
  sortName.setAttribute("data-kbm-my-patterns-sort", "name");
  const sortUpdated = makeEl("button");
  sortUpdated.setAttribute("data-kbm-my-patterns-sort", "updatedAt");
  thead.append(sortName, sortUpdated);

  const tbody = makeEl("tbody");
  tbody.setAttribute("data-kbm-my-patterns-list", "");
  table.append(thead, tbody);
  listWrap.append(table);

  root.append(status, listWrap);

  root.querySelector = (sel: string) => {
    if (sel === "[data-kbm-my-patterns-status]") return status;
    if (sel === "[data-kbm-my-patterns-list-wrap]") return listWrap;
    if (sel === "[data-kbm-my-patterns-list]") return tbody;
    if (sel === "[data-kbm-my-patterns-row]") return collectMatches(tbody._children, sel)[0] ?? null;
    if (sel === "[data-kbm-my-patterns-delete]") {
      return collectMatches(tbody._children, sel)[0] ?? null;
    }
    if (sel === "[data-kbm-my-patterns-copy]") {
      return collectMatches(tbody._children, sel)[0] ?? null;
    }
    return null;
  };
  root.querySelectorAll = (sel: string) => {
    if (
      sel === "[data-kbm-my-patterns-row]" ||
      sel === "[data-kbm-my-patterns-delete]" ||
      sel === "[data-kbm-my-patterns-copy]" ||
      sel === "[data-kbm-my-patterns-sort]"
    ) {
      if (sel === "[data-kbm-my-patterns-sort]") {
        return [sortName, sortUpdated] as unknown as NodeListOf<HTMLButtonElement>;
      }
      return collectMatches(tbody._children, sel) as unknown as NodeListOf<HTMLElement>;
    }
    return [] as unknown as NodeListOf<HTMLElement>;
  };

  return { root, status, listWrap, tbody, sortName, sortUpdated };
}

const sampleProjects = [
  {
    id: "proj-a",
    name: "Alpha pullover",
    family: "sleeveless" as const,
    source: "express" as const,
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "proj-b",
    name: "Beta vest",
    family: "sleeveless" as const,
    source: "custom-build" as const,
    updatedAt: "2026-01-02T00:00:00.000Z",
  },
];

describe("accountMyPatternsList", () => {
  beforeEach(() => {
    stubLocalStorage();
    localStorage.clear();
    vi.clearAllMocks();
    copyAccessState.canCopy = true;
    listCustomPatternProjectsMock.mockResolvedValue({ ok: true, projects: [] });
    deleteCustomPatternProjectMock.mockResolvedValue({ ok: true });
    vi.stubGlobal("document", {
      createElement: (tag: string) => makeEl(tag),
    });
  });

  it("renders saved projects with delete actions", async () => {
    const { root, listWrap, tbody } = makeAccountRoot();
    listCustomPatternProjectsMock.mockResolvedValue({
      ok: true,
      projects: sampleProjects,
    });

    await initAccountMyPatternsList(root);

    expect(listWrap.hidden).toBe(false);
    const rows = collectMatches(tbody._children, "[data-kbm-my-patterns-row]");
    expect(rows.length).toBe(2);
    const deleteBtns = collectMatches(tbody._children, "[data-kbm-my-patterns-delete]");
    expect(deleteBtns.length).toBe(2);
  });

  it("deletes a saved pattern and refreshes the list", async () => {
    const { root, status, listWrap, tbody } = makeAccountRoot();
    listCustomPatternProjectsMock.mockResolvedValue({
      ok: true,
      projects: sampleProjects,
    });

    const confirm = vi.fn(() => true);
    vi.stubGlobal("window", { confirm });

    await initAccountMyPatternsList(root);

    const deleteBtns = collectMatches(tbody._children, "[data-kbm-my-patterns-delete]");
    const delA = deleteBtns.find((b) => b.dataset.projectId === "proj-a");
    expect(delA).toBeTruthy();

    await delA?._click?.();

    expect(confirm).toHaveBeenCalledWith(DELETE_SAVED_PATTERN_CONFIRM_MESSAGE);
    expect(deleteCustomPatternProjectMock).toHaveBeenCalledWith("proj-a", "sleeveless");
    expect(listCustomPatternProjectsMock).toHaveBeenCalledTimes(1);

    const remaining = collectMatches(tbody._children, "[data-kbm-my-patterns-row]");
    expect(remaining.length).toBe(1);
    expect(listWrap.hidden).toBe(false);
    expect(status.hidden).toBe(true);
  });

  it("cancels delete without modifying the list", async () => {
    const { root, tbody } = makeAccountRoot();
    listCustomPatternProjectsMock.mockResolvedValue({
      ok: true,
      projects: sampleProjects,
    });

    const confirm = vi.fn(() => false);
    vi.stubGlobal("window", { confirm });

    await initAccountMyPatternsList(root);

    const deleteBtns = collectMatches(tbody._children, "[data-kbm-my-patterns-delete]");
    const delA = deleteBtns.find((b) => b.dataset.projectId === "proj-a");
    await delA?._click?.();

    expect(confirm).toHaveBeenCalledWith(DELETE_SAVED_PATTERN_CONFIRM_MESSAGE);
    expect(deleteCustomPatternProjectMock).not.toHaveBeenCalled();
    expect(collectMatches(tbody._children, "[data-kbm-my-patterns-row]").length).toBe(2);
  });

  it("clears active selection when deleting the active saved pattern", async () => {
    const { root, tbody } = makeAccountRoot();
    writeActiveCustomPatternProjectId("proj-a", "Alpha pullover");
    listCustomPatternProjectsMock.mockResolvedValue({
      ok: true,
      projects: sampleProjects,
    });

    const confirm = vi.fn(() => true);
    vi.stubGlobal("window", { confirm });

    await initAccountMyPatternsList(root);
    expect(readActiveCustomPatternProjectId()).toBe("proj-a");

    const delA = collectMatches(tbody._children, "[data-kbm-my-patterns-delete]").find(
      (b) => b.dataset.projectId === "proj-a",
    );
    await delA?._click?.();

    expect(deleteCustomPatternProjectMock).toHaveBeenCalledWith("proj-a", "sleeveless");
    expect(readActiveCustomPatternProjectId()).toBe("");
    expect(collectMatches(tbody._children, "[data-kbm-my-patterns-row]").length).toBe(1);
  });

  it("renders an enabled copy action for members / paid owners", async () => {
    const { root, tbody } = makeAccountRoot();
    copyAccessState.canCopy = true;
    listCustomPatternProjectsMock.mockResolvedValue({ ok: true, projects: sampleProjects });

    await initAccountMyPatternsList(root);

    const copyBtns = collectMatches(tbody._children, "[data-kbm-my-patterns-copy]");
    expect(copyBtns.length).toBe(2);
    expect(copyBtns.every((b) => b.disabled === false)).toBe(true);
  });

  it("shows copy disabled but visible for free / non-owner users", async () => {
    const { root, tbody } = makeAccountRoot();
    copyAccessState.canCopy = false;
    listCustomPatternProjectsMock.mockResolvedValue({ ok: true, projects: sampleProjects });

    await initAccountMyPatternsList(root);

    const copyBtns = collectMatches(tbody._children, "[data-kbm-my-patterns-copy]");
    // Still present (visible) — never hidden — but disabled with helper text.
    expect(copyBtns.length).toBe(2);
    expect(copyBtns.every((b) => b.disabled === true)).toBe(true);
    expect(copyBtns[0].title).toMatch(/purchase this pattern or become a member/i);
  });

  it("copies a saved pattern and adds the copy to the list", async () => {
    const { root, status, tbody } = makeAccountRoot();
    copyAccessState.canCopy = true;
    listCustomPatternProjectsMock.mockResolvedValue({ ok: true, projects: sampleProjects });
    copySavedCustomPatternProjectMock.mockResolvedValue({
      ok: true,
      project: {
        id: "proj-a-copy",
        name: "Alpha pullover - Copy",
        family: "sleeveless",
        source: "express",
        createdAt: "2026-02-01T00:00:00.000Z",
        updatedAt: "2026-02-01T00:00:00.000Z",
        version: 1,
      },
    });

    await initAccountMyPatternsList(root);

    const copyA = collectMatches(tbody._children, "[data-kbm-my-patterns-copy]").find(
      (b) => b.dataset.projectId === "proj-a",
    );
    expect(copyA).toBeTruthy();

    await copyA?._click?.();

    expect(copySavedCustomPatternProjectMock).toHaveBeenCalledWith("proj-a", {
      family: "sleeveless",
      existingNames: ["Alpha pullover", "Beta vest"],
    });
    const rows = collectMatches(tbody._children, "[data-kbm-my-patterns-row]");
    expect(rows.length).toBe(3);
    expect(status.textContent).toMatch(/Saved copy “Alpha pullover - Copy”/);
  });

  it("shows empty state after deleting the last saved pattern", async () => {
    const { root, status, listWrap, tbody } = makeAccountRoot();
    listCustomPatternProjectsMock.mockResolvedValue({
      ok: true,
      projects: [sampleProjects[0]],
    });

    const confirm = vi.fn(() => true);
    vi.stubGlobal("window", { confirm });

    await initAccountMyPatternsList(root);

    const delA = collectMatches(tbody._children, "[data-kbm-my-patterns-delete]")[0];
    await delA?._click?.();

    expect(listWrap.hidden).toBe(true);
    expect(status.hidden).toBe(false);
    expect(status.textContent).toMatch(/do not have any saved patterns yet/i);
    expect(collectMatches(tbody._children, "[data-kbm-my-patterns-row]").length).toBe(0);
  });
});
