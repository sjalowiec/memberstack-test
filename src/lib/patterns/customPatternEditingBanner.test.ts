import { beforeEach, describe, expect, it, vi } from "vitest";
import { stubLocalStorage } from "./test/stubLocalStorage";
import { writeActiveCustomPatternProjectId, clearActiveCustomPatternProjectId } from "./customPatternProjectActiveId";
import { saveCurrentPattern } from "./patternStorage";
import {
  buildCustomPatternEditingBannerCopy,
  CUSTOM_PATTERN_EDITING_BANNER_BODY_TEXT,
  getCustomPatternEditingBannerState,
  isCustomPatternEditingBannerUpdateTarget,
  performEditingBannerUpdate,
  shouldMountCustomPatternEditingBannerHost,
} from "./customPatternEditingBanner";
import {
  CB_EDITING_BANNER_CANCEL_SELECTOR,
  CB_EDITING_BANNER_UPDATE_SELECTOR,
  exitEditingSavedCustomPattern,
  runUpdateActiveSavedCustomPattern,
} from "./customPatternEditingBannerActions";

vi.mock("./customPatternEditingBannerActions", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./customPatternEditingBannerActions")>();
  return {
    ...actual,
    runUpdateActiveSavedCustomPattern: vi.fn(),
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
});
