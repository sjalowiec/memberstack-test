import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CONSTRUCTION_AUTHORED_KEY,
  DROP_SHOULDER_CONSTRUCTION,
  withDropShoulderConstructionAuthored,
} from "./patternConstructionIdentity";
import {
  resolvePatternSystemFromPage,
  resolvePatternSystemFromProject,
} from "./patternSystemId";
import type { CustomPatternProject } from "./customPatternProjectTypes";
import {
  getCurrentPattern,
  saveCurrentPattern,
  savePatternData,
} from "./patternStorage";
import { stubLocalStorage } from "./test/stubLocalStorage";

function stubPathname(pathname: string): Document {
  const doc = stubDocument(pathname);
  vi.stubGlobal("window", { location: { pathname, href: `http://localhost${pathname}` } });
  vi.stubGlobal("document", doc);
  return doc;
}

function stubDocument(pathname: string, expressConstruction?: string): Document {
  const main =
    expressConstruction !== undefined
      ? {
          getAttribute: (name: string) =>
            name === "data-express-construction" ? expressConstruction : null,
        }
      : null;
  return {
    defaultView: { location: { pathname } },
    querySelector: (sel: string) =>
      sel === "[data-express-construction]" ? main : null,
  } as unknown as Document;
}

function seedDropShoulderWorkingDraft(): void {
  const style = withDropShoulderConstructionAuthored({}, "long");
  saveCurrentPattern({ style });
  savePatternData("style", style);
}

describe("resolvePatternSystemFromPage", () => {
  beforeEach(() => {
    stubLocalStorage();
    localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("prefers sleeveless-express pathname over a stale drop-shoulder working draft", () => {
    seedDropShoulderWorkingDraft();
    const doc = stubPathname("/patterns/sleeveless-express");

    expect(resolvePatternSystemFromPage(doc)).toBe("sleeveless");
    expect(getCurrentPattern().style?.construction).toBe(DROP_SHOULDER_CONSTRUCTION);
  });

  it("prefers sleeveless builder pathname over a stale drop-shoulder working draft", () => {
    seedDropShoulderWorkingDraft();
    const doc = stubPathname("/patterns/sleeveless/builder");

    expect(resolvePatternSystemFromPage(doc)).toBe("sleeveless");
  });

  it("uses drop-shoulder pathname even when no working draft is present", () => {
    const doc = stubPathname("/patterns/drop-shoulder/builder");

    expect(resolvePatternSystemFromPage(doc)).toBe("drop-shoulder");
  });

  it("uses data-express-construction on drop-shoulder builder pages", () => {
    const doc = stubDocument("/patterns/drop-shoulder/builder", DROP_SHOULDER_CONSTRUCTION);

    expect(resolvePatternSystemFromPage(doc)).toBe("drop-shoulder");
  });

  it("falls back to the working draft on the shared pattern workspace route", () => {
    seedDropShoulderWorkingDraft();
    const doc = stubPathname("/patterns/sleeveless/pattern/");

    expect(resolvePatternSystemFromPage(doc)).toBe("drop-shoulder");
  });
});

describe("resolvePatternSystemFromProject", () => {
  it("classifies drop-shoulder saved projects separately from sleeveless", () => {
    const dropShoulder: Pick<CustomPatternProject, "pattern" | "customOverrides"> = {
      pattern: {
        style: {
          construction: DROP_SHOULDER_CONSTRUCTION,
          [CONSTRUCTION_AUTHORED_KEY]: DROP_SHOULDER_CONSTRUCTION,
        },
      } as CustomPatternProject["pattern"],
      customOverrides: {},
    };
    const sleeveless: Pick<CustomPatternProject, "pattern" | "customOverrides"> = {
      pattern: { style: { patternMode: "express" } } as CustomPatternProject["pattern"],
      customOverrides: {},
    };

    expect(resolvePatternSystemFromProject(dropShoulder)).toBe("drop-shoulder");
    expect(resolvePatternSystemFromProject(sleeveless)).toBe("sleeveless");
  });
});
