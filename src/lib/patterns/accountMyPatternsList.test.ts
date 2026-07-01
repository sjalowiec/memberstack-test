import { beforeEach, describe, expect, it, vi } from "vitest";
import { stubLocalStorage } from "./test/stubLocalStorage";
import {
  clearActiveCustomPatternProjectId,
  readActiveCustomPatternProjectId,
  writeActiveCustomPatternProjectId,
} from "./customPatternProjectActiveId";
import {
  DELETE_SAVED_PATTERN_CONFIRM_MESSAGE,
  RENAME_SAVED_PATTERN_PROMPT_MESSAGE,
  initAccountMyPatternsList,
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
      if (sel === "[data-kbm-my-patterns-sort]") return attrs.has("data-kbm-my-patterns-sort");
      if (sel === "[data-kbm-my-patterns-copy]") return attrs.has("data-kbm-my-patterns-copy");
      if (sel === "[data-kbm-my-patterns-view]") return attrs.has("data-kbm-my-patterns-view");
      if (sel === "[data-kbm-my-patterns-edit]") return attrs.has("data-kbm-my-patterns-edit");
      if (sel === "[data-kbm-my-patterns-rename]") return attrs.has("data-kbm-my-patterns-rename");
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
    return null;
  };
  root.querySelectorAll = (sel: string) => {
    if (
      sel === "[data-kbm-my-patterns-row]" ||
      sel === "[data-kbm-my-patterns-delete]" ||
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

const flushAsync = (): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, 0));

const sampleProjects = [
  {
    id: "proj-a",
    name: "Alpha pullover",
    family: "sleeveless" as const,
    source: "express" as const,
    updatedAt: "2026-01-01T00:00:00.000Z",
    gauge: { stitchesPerInch: 7, rowsPerInch: 11 },
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

  it("renders a gauge column and never shows the internal Express source", async () => {
    const { root, tbody } = makeAccountRoot();
    listCustomPatternProjectsMock.mockResolvedValue({ ok: true, projects: sampleProjects });
    vi.stubGlobal("window", {});

    await initAccountMyPatternsList(root);

    const rows = collectMatches(tbody._children, "[data-kbm-my-patterns-row]");
    // Row cells: [name, type, gauge, updated, actions]; name text lives in a child span.
    const rowA = rows.find((r) => r._children[0]?._children[0]?.textContent === "Alpha pullover");
    expect(rowA).toBeTruthy();
    const typeCell = rowA!._children[1];
    const gaugeCell = rowA!._children[2];
    expect(typeCell.textContent).toBe("Sleeveless");
    expect(typeCell.textContent).not.toMatch(/Express/);
    expect(gaugeCell.textContent).toBe("7 sts / 11 rows");
  });

  it("shows a graceful gauge fallback when a saved pattern has no gauge", async () => {
    const { root, tbody } = makeAccountRoot();
    listCustomPatternProjectsMock.mockResolvedValue({ ok: true, projects: sampleProjects });
    vi.stubGlobal("window", {});

    await initAccountMyPatternsList(root);

    const rows = collectMatches(tbody._children, "[data-kbm-my-patterns-row]");
    const rowB = rows.find((r) => r._children[0]?._children[0]?.textContent === "Beta vest");
    expect(rowB).toBeTruthy();
    expect(rowB!._children[2].textContent).toBe("Gauge not set");
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
    await flushAsync();

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
    await flushAsync();

    expect(deleteCustomPatternProjectMock).toHaveBeenCalledWith("proj-a", "sleeveless");
    expect(readActiveCustomPatternProjectId()).toBe("");
    expect(collectMatches(tbody._children, "[data-kbm-my-patterns-row]").length).toBe(1);
  });

  it("renders View Pattern, Edit, Copy, Rename, and Delete actions for each saved pattern", async () => {
    const { root, tbody } = makeAccountRoot();
    listCustomPatternProjectsMock.mockResolvedValue({ ok: true, projects: sampleProjects });
    vi.stubGlobal("window", {});

    await initAccountMyPatternsList(root);

    const viewBtns = collectMatches(tbody._children, "[data-kbm-my-patterns-view]");
    const editBtns = collectMatches(tbody._children, "[data-kbm-my-patterns-edit]");
    const copyBtns = collectMatches(tbody._children, "[data-kbm-my-patterns-copy]");
    const renameBtns = collectMatches(tbody._children, "[data-kbm-my-patterns-rename]");
    const deleteBtns = collectMatches(tbody._children, "[data-kbm-my-patterns-delete]");
    expect(viewBtns.length).toBe(2);
    expect(editBtns.length).toBe(2);
    expect(copyBtns.length).toBe(2);
    expect(renameBtns.length).toBe(2);
    expect(deleteBtns.length).toBe(2);
    expect(viewBtns[0].textContent).toBe("View Pattern");
    expect(editBtns[0].textContent).toBe("Edit");
    expect(copyBtns[0].textContent).toBe("Copy");
    expect(renameBtns[0].textContent).toBe("Rename");
    // Delete is a text-labeled action, not an unlabeled trash icon.
    expect(deleteBtns[0].textContent).toBe("Delete");
  });

  it("views a saved pattern and navigates directly to its pattern instructions page", async () => {
    const { root, tbody } = makeAccountRoot();
    listCustomPatternProjectsMock.mockResolvedValue({ ok: true, projects: sampleProjects });
    const assign = vi.fn();
    vi.stubGlobal("window", { location: { assign } });

    await initAccountMyPatternsList(root);

    const viewA = collectMatches(tbody._children, "[data-kbm-my-patterns-view]").find(
      (b) => b.dataset.projectId === "proj-a",
    );
    expect(viewA).toBeTruthy();
    await viewA?._click?.();
    await flushAsync();

    // View opens the read-only pattern page, never the edit/build/setup workspace.
    expect(loadSavedCustomPatternProjectMock).toHaveBeenCalledWith("proj-a", "view");
    expect(assign).toHaveBeenCalledWith("/patterns/sleeveless/pattern/");
  });

  it("edits a saved pattern and opens the editable builder workspace", async () => {
    const { root, tbody } = makeAccountRoot();
    listCustomPatternProjectsMock.mockResolvedValue({ ok: true, projects: sampleProjects });
    const assign = vi.fn();
    // A member with Sleeveless Pattern System access — Edit is enabled and opens the builder.
    vi.stubGlobal("window", {
      location: { assign },
      $memberstackDom: {
        getCurrentMember: async () => ({
          data: { id: "ms_member", planConnections: [{ planId: "pln_kin-membership-annual-qf9g01et" }] },
        }),
        getMemberJSON: async () => ({ data: {} }),
      },
    });
    loadSavedCustomPatternProjectMock.mockResolvedValue({
      ok: true,
      redirectHref: "/patterns/sleeveless/custom-build/design/?edit=choices",
    });

    await initAccountMyPatternsList(root);

    const editA = collectMatches(tbody._children, "[data-kbm-my-patterns-edit]").find(
      (b) => b.dataset.projectId === "proj-a",
    );
    expect(editA).toBeTruthy();
    await editA?._click?.();
    await flushAsync();

    // Edit uses the "open" action (editable workspace), distinct from the read-only "view" action.
    expect(loadSavedCustomPatternProjectMock).toHaveBeenCalledWith("proj-a", "open");
    expect(assign).toHaveBeenCalledWith("/patterns/sleeveless/custom-build/design/?edit=choices");
  });

  it("copies a saved pattern and adds the new copy to the list", async () => {
    const { root, status, tbody } = makeAccountRoot();
    listCustomPatternProjectsMock.mockResolvedValue({ ok: true, projects: sampleProjects });
    // A member with Sleeveless Pattern System access — Copy is enabled.
    vi.stubGlobal("window", {
      $memberstackDom: {
        getCurrentMember: async () => ({
          data: { id: "ms_member", planConnections: [{ planId: "pln_kin-membership-annual-qf9g01et" }] },
        }),
        getMemberJSON: async () => ({ data: {} }),
      },
    });
    copyByIdMock.mockResolvedValue({
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
    await copyA?._click?.();
    await flushAsync();

    expect(copyByIdMock).toHaveBeenCalledWith("proj-a", "sleeveless");
    expect(collectMatches(tbody._children, "[data-kbm-my-patterns-row]").length).toBe(3);
    expect(status.textContent).toMatch(/Created/i);
  });

  it("keeps Copy visible but disabled for free / non-owner users", async () => {
    const { root, tbody } = makeAccountRoot();
    listCustomPatternProjectsMock.mockResolvedValue({ ok: true, projects: sampleProjects });
    vi.stubGlobal("window", {});
    // Force the entitlement gate to deny edit/copy access.
    localStorage.setItem("kbm_sleeveless_advanced_pattern_access", "0");

    await initAccountMyPatternsList(root);

    const copyBtns = collectMatches(tbody._children, "[data-kbm-my-patterns-copy]");
    expect(copyBtns.length).toBe(2);
    // Button stays in the DOM (not hidden) but is locked with the helper tooltip.
    expect(copyBtns[0].textContent).toBe("Copy");
    expect(copyBtns[0].disabled).toBe(false);
    expect(copyBtns[0].getAttribute("aria-disabled")).toBe("true");
    expect(copyBtns[0].getAttribute("title")).toMatch(/included with membership/i);
  });

  it("does not copy when the entitlement gate denies access", async () => {
    const { root, tbody } = makeAccountRoot();
    listCustomPatternProjectsMock.mockResolvedValue({ ok: true, projects: sampleProjects });
    vi.stubGlobal("window", {});
    localStorage.setItem("kbm_sleeveless_advanced_pattern_access", "0");

    await initAccountMyPatternsList(root);

    const copyA = collectMatches(tbody._children, "[data-kbm-my-patterns-copy]").find(
      (b) => b.dataset.projectId === "proj-a",
    );
    expect(copyA?.disabled).toBe(false);
    expect(copyA?.getAttribute("aria-disabled")).toBe("true");
    await copyA?._click?.();
    await flushAsync();

    expect(copyByIdMock).not.toHaveBeenCalled();
  });

  it("renames a saved pattern via prompt and updates the row name", async () => {
    const { root, tbody, status } = makeAccountRoot();
    listCustomPatternProjectsMock.mockResolvedValue({ ok: true, projects: sampleProjects });
    const prompt = vi.fn(() => "Renamed pullover");
    vi.stubGlobal("window", { prompt });
    renameMock.mockResolvedValue({
      ok: true,
      project: { ...sampleProjects[0], name: "Renamed pullover" },
    });

    await initAccountMyPatternsList(root);

    const renameA = collectMatches(tbody._children, "[data-kbm-my-patterns-rename]").find(
      (b) => b.dataset.projectId === "proj-a",
    );
    await renameA?._click?.();
    await flushAsync();

    expect(prompt).toHaveBeenCalledWith(RENAME_SAVED_PATTERN_PROMPT_MESSAGE, "Alpha pullover");
    expect(renameMock).toHaveBeenCalledWith("proj-a", "Renamed pullover", "sleeveless");
    expect(status.textContent).toMatch(/Renamed to/i);
  });

  it("does not rename when the prompt is cancelled", async () => {
    const { root, tbody } = makeAccountRoot();
    listCustomPatternProjectsMock.mockResolvedValue({ ok: true, projects: sampleProjects });
    const prompt = vi.fn(() => null);
    vi.stubGlobal("window", { prompt });

    await initAccountMyPatternsList(root);

    const renameA = collectMatches(tbody._children, "[data-kbm-my-patterns-rename]").find(
      (b) => b.dataset.projectId === "proj-a",
    );
    await renameA?._click?.();

    expect(renameMock).not.toHaveBeenCalled();
  });

  it("disables Delete on the free user's protected pattern but keeps others deletable", async () => {
    const { root, tbody } = makeAccountRoot();
    listCustomPatternProjectsMock.mockResolvedValue({ ok: true, projects: sampleProjects });
    // A logged-in free user who claimed proj-a as their one free pattern, no system access.
    vi.stubGlobal("window", {
      $memberstackDom: {
        getCurrentMember: async () => ({ data: { id: "ms_free" } }),
        getMemberJSON: async () => ({
          data: { freeSleevelessPatternClaimed: true, freeSleevelessPatternId: "proj-a" },
        }),
      },
    });

    await initAccountMyPatternsList(root);

    const deleteBtns = collectMatches(tbody._children, "[data-kbm-my-patterns-delete]");
    const delA = deleteBtns.find((b) => b.dataset.projectId === "proj-a");
    const delB = deleteBtns.find((b) => b.dataset.projectId === "proj-b");

    expect(delA?.disabled).toBe(true);
    expect(delA?.getAttribute("aria-disabled")).toBe("true");
    expect(delA?.getAttribute("title")).toMatch(/free Sleeveless Pattern/i);
    expect(delB?.disabled).toBe(false);
    expect(delB?.getAttribute("aria-disabled")).toBeNull();

    // Locked: every Edit and Copy action stays visible with a helper tooltip.
    const editBtns = collectMatches(tbody._children, "[data-kbm-my-patterns-edit]");
    const copyBtns = collectMatches(tbody._children, "[data-kbm-my-patterns-copy]");
    expect(editBtns.length).toBe(2);
    expect(copyBtns.length).toBe(2);
    expect(editBtns.every((b) => b.getAttribute("aria-disabled") === "true")).toBe(true);
    expect(editBtns[0].getAttribute("title")).toMatch(/included with membership/i);
    expect(copyBtns.every((b) => b.getAttribute("aria-disabled") === "true")).toBe(true);

    // Clicking the disabled Delete / Edit never reaches their APIs.
    await delA?._click?.();
    const editA = editBtns.find((b) => b.dataset.projectId === "proj-a");
    await editA?._click?.();
    await flushAsync();
    expect(deleteCustomPatternProjectMock).not.toHaveBeenCalled();
    expect(loadSavedCustomPatternProjectMock).not.toHaveBeenCalled();
  });

  it("keeps Delete enabled for a member with system access", async () => {
    const { root, tbody } = makeAccountRoot();
    listCustomPatternProjectsMock.mockResolvedValue({ ok: true, projects: sampleProjects });
    // A member whose plan grants Sleeveless Pattern System access (even though freeClaimed is set).
    vi.stubGlobal("window", {
      $memberstackDom: {
        getCurrentMember: async () => ({
          data: {
            id: "ms_member",
            planConnections: [{ planId: "pln_kin-membership-annual-qf9g01et" }],
          },
        }),
        getMemberJSON: async () => ({
          data: { freeSleevelessPatternClaimed: true, freeSleevelessPatternId: "proj-a" },
        }),
      },
    });

    await initAccountMyPatternsList(root);

    const deleteBtns = collectMatches(tbody._children, "[data-kbm-my-patterns-delete]");
    expect(deleteBtns.every((b) => b.disabled === false)).toBe(true);
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
    await flushAsync();

    expect(listWrap.hidden).toBe(true);
    expect(status.hidden).toBe(false);
    expect(status.textContent).toMatch(/do not have any saved patterns yet/i);
    expect(collectMatches(tbody._children, "[data-kbm-my-patterns-row]").length).toBe(0);
  });
});
