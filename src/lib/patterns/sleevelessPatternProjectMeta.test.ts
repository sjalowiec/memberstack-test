import { beforeEach, describe, expect, it } from "vitest";
import { writeActiveCustomPatternProjectId } from "./customPatternProjectActiveId";
import { loadProjectIntoWorkingDraft } from "./customPatternProjectClient";
import type { CustomPatternProject } from "./customPatternProjectTypes";
import {
  CONSTRUCTION_FAMILY_OVERRIDE_KEY,
  DROP_SHOULDER_CONSTRUCTION,
  withDropShoulderConstructionAuthored,
} from "./patternConstructionIdentity";
import { saveCurrentPattern } from "./patternStorage";
import { stubLocalStorage } from "./test/stubLocalStorage";
import {
  buildDefaultSleevelessPatternTitle,
  formatPatternProjectNotesPreview,
  getPatternProjectMeta,
  getPatternProjectPrintFields,
  getSleevelessPatternOnlineHeading,
  getSleevelessPatternOnlineNotesText,
  resetPatternProjectMetaForNewDraft,
  resolvePatternDisplayName,
  resolvePatternPrintDocumentTitle,
  resolvePatternProjectSaveName,
  resolvePatternProjectSaveNameFromState,
  sanitizePatternPrintFilenameTitle,
  SLEEVELESS_PATTERN_ONLINE_HEADING_FALLBACK,
} from "./sleevelessPatternProjectMeta";
import {
  EXPRESS_EDITING_FALLBACK_LABEL,
  getExpressEditingProjectLabel,
} from "./sleevelessExpressResume";

function minimalSavedProject(
  name: string,
  options: { dropShoulder?: boolean } = {},
): CustomPatternProject {
  const style = options.dropShoulder
    ? withDropShoulderConstructionAuthored(
        {
          garmentStyle: "pullover",
          neckline: "round",
          patternMode: "express",
        },
        "long",
      )
    : { garmentStyle: "pullover", neckline: "round" };
  return {
    id: `proj-${name.replace(/\s+/g, "-").toLowerCase()}`,
    name,
    family: "sleeveless",
    source: "express",
    notes: "",
    customOverrides: options.dropShoulder
      ? { [CONSTRUCTION_FAMILY_OVERRIDE_KEY]: DROP_SHOULDER_CONSTRUCTION }
      : {},
    createdAt: "t1",
    updatedAt: "t2",
    version: 1,
    pattern: {
      id: `pattern-${name.replace(/\s+/g, "-").toLowerCase()}`,
      patternType: "sleeveless",
      status: "draft",
      version: 1,
      createdAt: "t1",
      updatedAt: "t1",
      style,
      fit: { sizingChart: "misses", selectedSize: "4" },
      patternProject: { title: "", notes: "" },
    },
  };
}

describe("buildDefaultSleevelessPatternTitle", () => {
  it("uses only audience + family (no neckline/size/garment details)", () => {
    expect(
      buildDefaultSleevelessPatternTitle({
        who: "women",
        neckline: "round",
        garmentStyle: "pullover",
        selectedSize: "4",
      }),
    ).toBe("Women's Sleeveless");
  });

  it("builds men's sleeveless regardless of neckline/garment", () => {
    expect(
      buildDefaultSleevelessPatternTitle({
        who: "men",
        neckline: "v-neck",
        garmentStyle: "cardigan",
        selectedSize: "M",
      }),
    ).toBe("Men's Sleeveless");
  });

  it("maps kids who key to Kids'", () => {
    expect(buildDefaultSleevelessPatternTitle({ who: "kids" })).toBe("Kids' Sleeveless");
  });

  it("maps baby who key to Baby (no possessive)", () => {
    expect(buildDefaultSleevelessPatternTitle({ who: "baby" })).toBe("Baby Sleeveless");
  });

  it("uses chart audience when who is empty", () => {
    expect(buildDefaultSleevelessPatternTitle({ chartAudience: "men" })).toBe("Men's Sleeveless");
    expect(buildDefaultSleevelessPatternTitle({ chartAudience: "misses" })).toBe(
      "Women's Sleeveless",
    );
  });

  it("uses the provided pattern family (e.g. Drop Shoulder)", () => {
    expect(
      buildDefaultSleevelessPatternTitle({ who: "women" }, "Drop Shoulder"),
    ).toBe("Women's Drop Shoulder");
    expect(
      buildDefaultSleevelessPatternTitle({ chartAudience: "kids" }, "Drop Shoulder"),
    ).toBe("Kids' Drop Shoulder");
  });

  it("falls back to family only when audience is unknown", () => {
    expect(buildDefaultSleevelessPatternTitle({})).toBe("Sleeveless");
    expect(buildDefaultSleevelessPatternTitle({}, "Drop Shoulder")).toBe("Drop Shoulder");
  });
});

describe("online pattern project display", () => {
  beforeEach(() => {
    stubLocalStorage();
    localStorage.clear();
  });

  it("uses saved title when present", () => {
    expect(
      getSleevelessPatternOnlineHeading({ title: "Sue's Special pattern", notes: "" }),
    ).toBe("Sue's Special pattern");
  });

  it("falls back when title is empty", () => {
    expect(getSleevelessPatternOnlineHeading({ title: "", notes: "" })).toBe(
      SLEEVELESS_PATTERN_ONLINE_HEADING_FALLBACK,
    );
    expect(getSleevelessPatternOnlineHeading({ title: "   ", notes: "note" })).toBe(
      SLEEVELESS_PATTERN_ONLINE_HEADING_FALLBACK,
    );
  });

  it("returns notes text only when non-empty", () => {
    expect(getSleevelessPatternOnlineNotesText({ title: "", notes: "" })).toBeNull();
    expect(getSleevelessPatternOnlineNotesText({ title: "T", notes: "   " })).toBeNull();
    expect(getSleevelessPatternOnlineNotesText({ title: "", notes: "Use cotton yarn" })).toBe(
      "Use cotton yarn",
    );
  });

  it("preserves internal line breaks for display", () => {
    expect(getSleevelessPatternOnlineNotesText({ title: "", notes: "Line one\nLine two" })).toBe(
      "Line one\nLine two",
    );
  });
});

describe("resetPatternProjectMetaForNewDraft", () => {
  beforeEach(() => {
    stubLocalStorage();
    localStorage.clear();
  });

  it("clears a previously loaded saved project title and notes on the working draft", () => {
    saveCurrentPattern({
      patternProject: {
        title: "Aubrey's Green Vest",
        notes: "Use cotton yarn",
        titleCustomized: true,
      },
    });

    resetPatternProjectMetaForNewDraft();

    expect(getPatternProjectMeta()).toEqual({ title: "", notes: "" });
    expect(getExpressEditingProjectLabel()).toBe(EXPRESS_EDITING_FALLBACK_LABEL);
  });
});

describe("resolvePatternProjectSaveName", () => {
  beforeEach(() => {
    stubLocalStorage();
    localStorage.clear();
  });

  it("uses linked saved project name before auto-generated title", () => {
    writeActiveCustomPatternProjectId("proj-1", "Saved Drop Shoulder Name");
    saveCurrentPattern({ patternProject: { title: "", notes: "" } });
    expect(resolvePatternProjectSaveNameFromState()).toBe("Saved Drop Shoulder Name");
  });

  it("uses auto-generated title (audience + family only) when draft and linked name are empty", () => {
    saveCurrentPattern({
      fit: { sizingChart: "misses", selectedSize: "4" },
      style: { garmentStyle: "pullover", neckline: "round" },
      patternProject: { title: "", notes: "" },
    });
    expect(resolvePatternProjectSaveNameFromState()).toBe("Women's Sleeveless");
  });

  it("prefers a non-empty edit drawer title over state fallbacks", () => {
    writeActiveCustomPatternProjectId("proj-1", "Saved Name");
    const root = {
      querySelector(sel: string) {
        if (sel === "#sl-edit-title") return { value: "Typed title" } as HTMLInputElement;
        return null;
      },
    } as unknown as ParentNode;
    expect(resolvePatternProjectSaveName(root)).toBe("Typed title");
  });
});

describe("formatPatternProjectNotesPreview", () => {
  it("collapses newlines and extra spaces to one line", () => {
    expect(formatPatternProjectNotesPreview("  yarn A\n\nyarn B  ")).toBe("yarn A yarn B");
  });

  it("normalizes Windows line endings", () => {
    expect(formatPatternProjectNotesPreview("a\r\nb")).toBe("a b");
  });
});

describe("sanitizePatternPrintFilenameTitle", () => {
  it("preserves readable custom names including apostrophes", () => {
    expect(sanitizePatternPrintFilenameTitle("Sue's Summer Vest")).toBe("Sue's Summer Vest");
  });

  it("replaces OS-illegal filename characters with spaces while keeping the rest", () => {
    expect(sanitizePatternPrintFilenameTitle('My Vest: "V2"/final?')).toBe("My Vest V2 final");
  });

  it("collapses whitespace and trims", () => {
    expect(sanitizePatternPrintFilenameTitle("  Soft   Cardigan  ")).toBe("Soft Cardigan");
  });

  it("returns empty for blank or punctuation-only names", () => {
    expect(sanitizePatternPrintFilenameTitle("   ")).toBe("");
    expect(sanitizePatternPrintFilenameTitle('<>:"/\\|?*')).toBe("");
  });
});

describe("resolvePatternPrintDocumentTitle", () => {
  const sleevelessPageTitle = "Sleeveless Sweater Pattern | Knit it Now";
  const dropShoulderPageTitle = "Drop Shoulder Sweater Pattern | Knit it Now";

  it("uses a custom pattern name for the PDF filename suggestion", () => {
    expect(resolvePatternPrintDocumentTitle("Aubrey's Green Vest", sleevelessPageTitle)).toBe(
      "Aubrey's Green Vest",
    );
    expect(resolvePatternPrintDocumentTitle("My Drop Shoulder", dropShoulderPageTitle)).toBe(
      "My Drop Shoulder",
    );
  });

  it("falls back to the page/default pattern title when no custom name exists", () => {
    expect(resolvePatternPrintDocumentTitle("", sleevelessPageTitle)).toBe(sleevelessPageTitle);
    expect(resolvePatternPrintDocumentTitle("   ", dropShoulderPageTitle)).toBe(
      dropShoulderPageTitle,
    );
  });

  it("uses the auto-generated default pattern name when present", () => {
    expect(resolvePatternPrintDocumentTitle("Women's Sleeveless", sleevelessPageTitle)).toBe(
      "Women's Sleeveless",
    );
    expect(resolvePatternPrintDocumentTitle("Men's Drop Shoulder", dropShoulderPageTitle)).toBe(
      "Men's Drop Shoulder",
    );
  });

  it("two differently named patterns produce two different PDF filenames", () => {
    const a = resolvePatternPrintDocumentTitle("Aubrey's Green Vest", dropShoulderPageTitle);
    const b = resolvePatternPrintDocumentTitle("Mom's Birthday Cardigan", dropShoulderPageTitle);
    expect(a).toBe("Aubrey's Green Vest");
    expect(b).toBe("Mom's Birthday Cardigan");
    expect(a).not.toBe(b);
    expect(a).not.toBe(dropShoulderPageTitle);
    expect(b).not.toBe(dropShoulderPageTitle);
  });
});

describe("resolvePatternDisplayName — saved name is source of truth", () => {
  beforeEach(() => {
    stubLocalStorage();
    localStorage.clear();
  });

  it("uses a named saved Sleeveless pattern title for display and PDF fields", () => {
    saveCurrentPattern({
      style: { garmentStyle: "pullover", neckline: "round" },
      fit: { sizingChart: "misses", selectedSize: "4" },
      patternProject: { title: "Sue's Sleeveless Vest", notes: "", titleCustomized: true },
    });
    writeActiveCustomPatternProjectId("proj-sl", "Sue's Sleeveless Vest");

    expect(resolvePatternDisplayName()).toBe("Sue's Sleeveless Vest");
    expect(getPatternProjectPrintFields().title).toBe("Sue's Sleeveless Vest");
    expect(getSleevelessPatternOnlineHeading(getPatternProjectMeta())).toBe("Sue's Sleeveless Vest");
    expect(
      resolvePatternPrintDocumentTitle(
        getPatternProjectPrintFields().title,
        "Sleeveless Sweater Pattern | Knit it Now",
      ),
    ).toBe("Sue's Sleeveless Vest");
  });

  it("uses a named saved Drop Shoulder pattern title for display and PDF fields", () => {
    saveCurrentPattern({
      style: withDropShoulderConstructionAuthored(
        { garmentStyle: "pullover", neckline: "round", patternMode: "express" },
        "long",
      ),
      fit: { sizingChart: "misses", selectedSize: "4" },
      patternProject: { title: "Cynthia's Drop Shoulder", notes: "", titleCustomized: true },
    });
    writeActiveCustomPatternProjectId("proj-ds", "Cynthia's Drop Shoulder");

    expect(resolvePatternDisplayName()).toBe("Cynthia's Drop Shoulder");
    expect(getPatternProjectPrintFields().title).toBe("Cynthia's Drop Shoulder");
    expect(getSleevelessPatternOnlineHeading(getPatternProjectMeta())).toBe(
      "Cynthia's Drop Shoulder",
    );
    expect(
      resolvePatternPrintDocumentTitle(
        getPatternProjectPrintFields().title,
        "Drop Shoulder Sweater Pattern | Knit it Now",
      ),
    ).toBe("Cynthia's Drop Shoulder");
  });

  it("preserves the saved name when reopening and editing a saved pattern", () => {
    const project = minimalSavedProject("Aubrey's Green Vest", { dropShoulder: true });
    loadProjectIntoWorkingDraft(project);
    writeActiveCustomPatternProjectId(project.id, project.name);

    expect(getPatternProjectMeta().title).toBe("Aubrey's Green Vest");
    expect(getPatternProjectMeta().titleCustomized).toBe(true);
    expect(resolvePatternDisplayName()).toBe("Aubrey's Green Vest");
    expect(resolvePatternProjectSaveNameFromState()).toBe("Aubrey's Green Vest");
    expect(getPatternProjectPrintFields().title).toBe("Aubrey's Green Vest");
  });

  it("falls back to the linked saved name when draft title is empty", () => {
    writeActiveCustomPatternProjectId("proj-1", "Linked Saved Name");
    saveCurrentPattern({ patternProject: { title: "", notes: "" } });
    expect(resolvePatternDisplayName()).toBe("Linked Saved Name");
    expect(getPatternProjectPrintFields().title).toBe("Linked Saved Name");
    expect(getSleevelessPatternOnlineHeading({ title: "", notes: "" })).toBe("Linked Saved Name");
  });

  it("falls back to a generic auto title only when no user name exists", () => {
    saveCurrentPattern({
      fit: { sizingChart: "misses", selectedSize: "4" },
      style: { garmentStyle: "pullover", neckline: "round" },
      patternProject: { title: "", notes: "" },
    });
    expect(resolvePatternDisplayName()).toBe("Women's Sleeveless");
    expect(getPatternProjectPrintFields().title).toBe("Women's Sleeveless");
    expect(
      resolvePatternPrintDocumentTitle(
        getPatternProjectPrintFields().title,
        "Sleeveless Sweater Pattern | Knit it Now",
      ),
    ).toBe("Women's Sleeveless");
  });

  it("two differently named patterns resolve to two different PDF filenames", () => {
    const pageTitle = "Drop Shoulder Sweater Pattern | Knit it Now";

    saveCurrentPattern({
      patternProject: { title: "Pattern One Vest", notes: "", titleCustomized: true },
    });
    const filenameA = resolvePatternPrintDocumentTitle(
      getPatternProjectPrintFields().title,
      pageTitle,
    );

    saveCurrentPattern({
      patternProject: { title: "Pattern Two Cardigan", notes: "", titleCustomized: true },
    });
    const filenameB = resolvePatternPrintDocumentTitle(
      getPatternProjectPrintFields().title,
      pageTitle,
    );

    expect(filenameA).toBe("Pattern One Vest");
    expect(filenameB).toBe("Pattern Two Cardigan");
    expect(filenameA).not.toBe(filenameB);
  });
});
