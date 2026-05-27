import { beforeEach, describe, expect, it } from "vitest";
import { stubLocalStorage } from "./test/stubLocalStorage";
import {
  readActiveCustomPatternProjectId,
  writeActiveCustomPatternProjectId,
} from "./customPatternProjectActiveId";
import {
  CUSTOM_PATTERN_SAVED_PROJECTS_EDITING_TITLE,
  CUSTOM_PATTERN_SAVED_PROJECTS_PANEL_TITLE,
  refreshCustomPatternSavedProjectsPanelUi,
} from "./customPatternSavedProjectsPanel";
import { saveCurrentPattern } from "./patternStorage";

const SUES_PATTERN = "Sue's test pattern";

function makePanelRoot(): {
  root: HTMLElement;
  nameInput: { value: string };
  status: { textContent: string; hidden: boolean };
  title: { textContent: string };
} {
  const nameInput = { value: "" };
  const status = { textContent: "", hidden: true };
  const title = { textContent: CUSTOM_PATTERN_SAVED_PROJECTS_PANEL_TITLE };
  const root = {
    classList: { add: () => undefined, remove: () => undefined, toggle: () => undefined },
    dataset: {} as Record<string, string>,
    querySelector(sel: string) {
      if (sel === "[data-cb-project-name]") return nameInput as unknown as HTMLInputElement;
      if (sel === "[data-cb-project-editing-status]") return status as unknown as HTMLElement;
      if (sel === ".cb-saved-projects__title") return title as unknown as HTMLElement;
      return null;
    },
  } as unknown as HTMLElement;
  return { root, nameInput, status, title };
}

describe("refreshCustomPatternSavedProjectsPanelUi", () => {
  beforeEach(() => {
    stubLocalStorage();
    localStorage.clear();
  });

  it("fills the project name for a loaded saved project without duplicating status in the panel", () => {
    writeActiveCustomPatternProjectId("proj-sue", SUES_PATTERN);
    saveCurrentPattern({
      patternProject: { title: SUES_PATTERN, notes: "", titleCustomized: true },
    });

    const { root, nameInput, status, title } = makePanelRoot();
    refreshCustomPatternSavedProjectsPanelUi(root);

    expect(nameInput.value).toBe(SUES_PATTERN);
    expect(title.textContent).toBe(CUSTOM_PATTERN_SAVED_PROJECTS_EDITING_TITLE);
    expect(status.textContent).toBe("");
    expect(status.hidden).toBe(true);
    expect(readActiveCustomPatternProjectId()).toBe("proj-sue");
  });

  it("uses compact panel layout when editing a saved project", () => {
    writeActiveCustomPatternProjectId("proj-sue", SUES_PATTERN);

    const { root } = makePanelRoot();
    let compact = false;
    root.classList.toggle = (_cls: string, on?: boolean) => {
      compact = Boolean(on);
    };

    refreshCustomPatternSavedProjectsPanelUi(root);

    expect(compact).toBe(true);
  });

  it("keeps active project id when the title changes", () => {
    writeActiveCustomPatternProjectId("proj-sue", SUES_PATTERN);
    saveCurrentPattern({
      patternProject: { title: SUES_PATTERN, notes: "", titleCustomized: true },
    });

    const { root, nameInput } = makePanelRoot();
    refreshCustomPatternSavedProjectsPanelUi(root);

    nameInput.value = "Sue's revised name";
    saveCurrentPattern({
      patternProject: { title: "Sue's revised name", notes: "", titleCustomized: true },
    });
    refreshCustomPatternSavedProjectsPanelUi(root);

    expect(readActiveCustomPatternProjectId()).toBe("proj-sue");
  });
});
