import { describe, expect, it } from "vitest";
import { resolveAccountMyPatternsSystem } from "./accountMyPatternsList";
import { resolvePatternSystemForSavePayload } from "./customPatternProjectClient";
import {
  CHRISTMAS_STOCKING_OPEN_PATTERN_HREF,
  CHRISTMAS_STOCKING_SUMMARY_EDIT_HREF,
  getContinueEditingHref,
  getOpenPatternHrefForProject,
  getSavedCustomPatternOpenHref,
} from "./customPatternProjectNavigation";
import { resolvePatternSystemFromProject } from "./patternSystemId";
import {
  buildCustomPatternProjectDrawerLines,
  formatCustomPatternProjectType,
} from "./patternWorkspaceLibraryDrawer";
import type { SleevelessPatternRecord } from "./patternStorage";

function stockingPattern(title = "Blue"): SleevelessPatternRecord {
  return {
    id: "draft-stocking",
    patternType: "christmas-stocking",
    patternSystem: "christmas-stocking",
    patternProject: { title, notes: "", titleCustomized: true },
  } as unknown as SleevelessPatternRecord;
}

function sleevelessPattern(): SleevelessPatternRecord {
  return {
    id: "draft-sl",
    patternType: "sleeveless",
    patternSystem: "sleeveless",
    style: { patternMode: "express", neckline: "round", garmentStyle: "pullover" },
    patternProject: { title: "Christmas Stocking", notes: "", titleCustomized: true },
  } as unknown as SleevelessPatternRecord;
}

describe("saved Christmas Stocking identity", () => {
  it("stores christmas-stocking on a save payload and ignores the editable title", () => {
    const pattern = stockingPattern("Blue");
    const payload = {
      name: "Blue",
      family: "sleeveless" as const,
      source: "express" as const,
      pattern,
      customOverrides: {},
    };
    expect(resolvePatternSystemForSavePayload(payload)).toBe("christmas-stocking");
    expect(resolvePatternSystemFromProject(payload)).toBe("christmas-stocking");
    expect(payload.name).toBe("Blue");
  });

  it("labels Your Saved Patterns as Christmas Stocking for new and existing stocking ids", () => {
    const saved = {
      id: "proj-stocking",
      name: "Blue",
      family: "sleeveless" as const,
      source: "express" as const,
      patternSystem: "christmas-stocking",
      updatedAt: "2026-10-20T15:00:00.000Z",
    };
    expect(formatCustomPatternProjectType(saved)).toBe("Christmas Stocking");
    expect(formatCustomPatternProjectType(saved)).not.toBe("Sleeveless");
    expect(buildCustomPatternProjectDrawerLines(saved).contextLine).toMatch(
      /^Christmas Stocking • /,
    );
    expect(resolveAccountMyPatternsSystem(saved)).toBe("christmas-stocking");
  });

  it("does not infer Christmas Stocking from a Sleeveless project's title", () => {
    const summary = {
      id: "proj-sl",
      name: "Christmas Stocking",
      family: "sleeveless" as const,
      source: "express" as const,
      patternSystem: "sleeveless",
    };
    expect(formatCustomPatternProjectType(summary)).toBe("Sleeveless");
    expect(resolveAccountMyPatternsSystem(summary)).toBe("sleeveless");
    expect(resolvePatternSystemFromProject({
      pattern: sleevelessPattern(),
      customOverrides: {},
    })).toBe("sleeveless");
  });

  it("opens, edits, and copies a stocking on the stocking routes with its pattern data", () => {
    const project = {
      id: "proj-stocking",
      pattern: stockingPattern("Aunt Mae"),
      customOverrides: {},
      source: "express" as const,
    };
    expect(getOpenPatternHrefForProject(project)).toBe(CHRISTMAS_STOCKING_OPEN_PATTERN_HREF);
    expect(getOpenPatternHrefForProject(project)).toBe("/patterns/christmas-stocking/pattern/");
    expect(getSavedCustomPatternOpenHref("express", project)).toBe(
      `${CHRISTMAS_STOCKING_SUMMARY_EDIT_HREF}?edit=1&project=proj-stocking`,
    );
    expect(getContinueEditingHref("express", project)).toContain(
      "/patterns/christmas-stocking/edit/",
    );
    expect(getOpenPatternHrefForProject(project)).not.toContain("/patterns/sleeveless/");
    expect(getSavedCustomPatternOpenHref("express", project)).not.toContain("/patterns/socks/");

    const copyPayload = {
      name: "Aunt Mae - Copy",
      family: "sleeveless" as const,
      source: "express" as const,
      pattern: project.pattern,
      customOverrides: project.customOverrides,
    };
    expect(resolvePatternSystemForSavePayload(copyPayload)).toBe("christmas-stocking");
    expect(copyPayload.pattern.patternType).toBe("christmas-stocking");
    expect(copyPayload.pattern.patternSystem).toBe("christmas-stocking");
    expect(formatCustomPatternProjectType({
      id: "proj-stocking-copy",
      name: copyPayload.name,
      family: "sleeveless",
      source: "express",
      patternSystem: resolvePatternSystemForSavePayload(copyPayload),
    })).toBe("Christmas Stocking");
  });

  it("leaves an existing Sleeveless pattern on the Sleeveless label and routes", () => {
    const project = {
      pattern: sleevelessPattern(),
      customOverrides: {},
    };
    expect(getOpenPatternHrefForProject(project)).toBe("/patterns/sleeveless/pattern/");
    expect(getSavedCustomPatternOpenHref("express", project)).toBe(
      "/patterns/sleeveless/pattern/?edit=1",
    );
  });
});
