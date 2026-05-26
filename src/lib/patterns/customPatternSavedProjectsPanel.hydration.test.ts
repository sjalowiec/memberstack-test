import { beforeEach, describe, expect, it } from "vitest";
import { stubLocalStorage } from "./test/stubLocalStorage";
import {
  readActiveCustomPatternProjectId,
  writeActiveCustomPatternProjectId,
} from "./customPatternProjectActiveId";
import { refreshCustomPatternSavedProjectsPanelUi } from "./customPatternSavedProjectsPanel";
import { saveCurrentPattern } from "./patternStorage";

const SUES_PATTERN = "Sue's test pattern";

function makePanelRoot(): {
  root: HTMLElement;
  nameInput: { value: string };
  status: { textContent: string; hidden: boolean };
} {
  const nameInput = { value: "" };
  const status = { textContent: "", hidden: true };
  const root = {
    querySelector(sel: string) {
      if (sel === "[data-cb-project-name]") return nameInput as unknown as HTMLInputElement;
      if (sel === "[data-cb-project-editing-status]") return status as unknown as HTMLElement;
      return null;
    },
  } as unknown as HTMLElement;
  return { root, nameInput, status };
}

describe("refreshCustomPatternSavedProjectsPanelUi", () => {
  beforeEach(() => {
    stubLocalStorage();
    localStorage.clear();
  });

  it("fills the project name and editing status for a loaded saved project", () => {
    writeActiveCustomPatternProjectId("proj-sue", SUES_PATTERN);
    saveCurrentPattern({
      patternProject: { title: SUES_PATTERN, notes: "", titleCustomized: true },
    });

    const { root, nameInput, status } = makePanelRoot();
    refreshCustomPatternSavedProjectsPanelUi(root);

    expect(nameInput.value).toBe(SUES_PATTERN);
    expect(status.textContent).toBe(`Editing saved pattern: ${SUES_PATTERN}`);
    expect(status.hidden).toBe(false);
    expect(readActiveCustomPatternProjectId()).toBe("proj-sue");
  });

  it("keeps editing status when the title changes", () => {
    writeActiveCustomPatternProjectId("proj-sue", SUES_PATTERN);
    saveCurrentPattern({
      patternProject: { title: SUES_PATTERN, notes: "", titleCustomized: true },
    });

    const { root, nameInput, status } = makePanelRoot();
    refreshCustomPatternSavedProjectsPanelUi(root);

    nameInput.value = "Sue's revised name";
    saveCurrentPattern({
      patternProject: { title: "Sue's revised name", notes: "", titleCustomized: true },
    });
    refreshCustomPatternSavedProjectsPanelUi(root);

    expect(readActiveCustomPatternProjectId()).toBe("proj-sue");
    expect(status.textContent).toBe("Editing saved pattern: Sue's revised name");
    expect(status.hidden).toBe(false);
  });
});
