import { beforeEach, describe, expect, it } from "vitest";
import { stubLocalStorage } from "./test/stubLocalStorage";
import {
  clearActiveCustomPatternProjectId,
  writeActiveCustomPatternProjectId,
} from "./customPatternProjectActiveId";
import {
  CUSTOM_BUILD_FOUNDATION_DEFAULT_TITLE,
  CUSTOM_BUILD_FOUNDATION_EDITING_HELPER,
  CUSTOM_BUILD_FOUNDATION_EDITING_TITLE,
  formatCustomBuildFoundationEditingProjectLine,
  formatCustomBuildFoundationEditingTitle,
  syncCustomBuildFoundationPageHeader,
} from "./customBuildFoundationPageEditingUx";
import { saveCurrentPattern } from "./patternStorage";

const AUBRIES_VEST = "Aubrie's Green Vest";

function makeFoundationHeaderDom(): {
  root: ParentNode;
  title: { textContent: string; dataset: { cbFoundationStepTitle?: string } };
  helper: { textContent: string; hidden: boolean };
  projectLine: { textContent: string; hidden: boolean };
} {
  const title = {
    textContent: CUSTOM_BUILD_FOUNDATION_DEFAULT_TITLE,
    dataset: {} as { cbFoundationStepTitle?: string },
  };

  const helper = { textContent: "", hidden: true };
  const projectLine = { textContent: "", hidden: true };

  const header = {
    querySelector(sel: string) {
      if (sel === ".pattern-title") return title;
      if (sel === "[data-cb-editing-helper]") return helper;
      if (sel === "[data-cb-editing-project-name]") return projectLine;
      return null;
    },
  };

  const root = {
    querySelector(sel: string) {
      if (sel === "[data-cb-foundation-header]") return header;
      return null;
    },
  } as unknown as ParentNode;

  return { root, title, helper, projectLine };
}

describe("formatCustomBuildFoundationEditingTitle (legacy)", () => {
  it("prefixes the project name with Editing:", () => {
    expect(formatCustomBuildFoundationEditingTitle(AUBRIES_VEST)).toBe(`Editing: ${AUBRIES_VEST}`);
  });

  it("falls back when the name is empty", () => {
    expect(formatCustomBuildFoundationEditingTitle("  ")).toBe("Editing saved pattern");
  });
});

describe("formatCustomBuildFoundationEditingProjectLine", () => {
  it("formats Project: name", () => {
    expect(formatCustomBuildFoundationEditingProjectLine(AUBRIES_VEST)).toBe(
      `Project: ${AUBRIES_VEST}`,
    );
  });

  it("returns empty when the name is blank", () => {
    expect(formatCustomBuildFoundationEditingProjectLine("  ")).toBe("");
  });
});

describe("syncCustomBuildFoundationPageHeader", () => {
  beforeEach(() => {
    stubLocalStorage();
    localStorage.clear();
  });

  it("shows edit-workspace header and project line when a saved project is active", () => {
    writeActiveCustomPatternProjectId("proj-aubrie", AUBRIES_VEST);
    saveCurrentPattern({
      patternProject: { title: AUBRIES_VEST, notes: "", titleCustomized: true },
    });

    const { root, title, helper, projectLine } = makeFoundationHeaderDom();
    syncCustomBuildFoundationPageHeader(root);

    expect(title.textContent).toBe(CUSTOM_BUILD_FOUNDATION_EDITING_TITLE);
    expect(helper.hidden).toBe(false);
    expect(helper.textContent).toBe(CUSTOM_BUILD_FOUNDATION_EDITING_HELPER);
    expect(projectLine.hidden).toBe(false);
    expect(projectLine.textContent).toBe(`Project: ${AUBRIES_VEST}`);
  });

  it("restores the Foundation title when editing mode ends", () => {
    writeActiveCustomPatternProjectId("proj-aubrie", AUBRIES_VEST);
    const { root, title, projectLine } = makeFoundationHeaderDom();
    syncCustomBuildFoundationPageHeader(root);

    clearActiveCustomPatternProjectId();
    syncCustomBuildFoundationPageHeader(root);

    expect(title.textContent).toBe(CUSTOM_BUILD_FOUNDATION_DEFAULT_TITLE);
    expect(projectLine.hidden).toBe(true);
    expect(projectLine.textContent).toBe("");
  });
});
