import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CONSTRUCTION_AUTHORED_KEY,
  DROP_SHOULDER_CONSTRUCTION,
  withDropShoulderConstructionAuthored,
} from "./patternConstructionIdentity";
import {
  resolvePatternSystemForBuilderGate,
  resolvePatternSystemForEntitlement,
  resolvePatternSystemFromPage,
  resolvePatternSystemFromProject,
  resolvePatternSystemFromWorkingSession,
  patternSystemDisplayName,
} from "./patternSystemId";
import type { CustomPatternProject } from "./customPatternProjectTypes";
import {
  getCurrentPattern,
  saveCurrentPattern,
  savePatternData,
} from "./patternStorage";
import { stubLocalStorage, stubSessionStorage } from "./test/stubLocalStorage";
import { writeActiveCustomPatternProjectId } from "./customPatternProjectActiveId";
import { writeHydratedConstructionBaseline } from "./customPatternProjectConstructionBaseline";

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
    stubSessionStorage();
    localStorage.clear();
    sessionStorage.clear();
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

  it("uses hat pathname for hat builder and finished pattern pages", () => {
    expect(resolvePatternSystemFromPage(stubPathname("/patterns/hat/builder"))).toBe("hat");
    expect(resolvePatternSystemFromPage(stubPathname("/patterns/hat/pattern/"))).toBe("hat");
    expect(resolvePatternSystemFromPage(stubPathname("/patterns/hat/summary/"))).toBe("hat");
  });

  it("uses socks pathname for future sock builder and pattern pages", () => {
    expect(resolvePatternSystemFromPage(stubPathname("/patterns/socks/builder"))).toBe("socks");
    expect(resolvePatternSystemFromPage(stubPathname("/patterns/socks/pattern/"))).toBe("socks");
    expect(resolvePatternSystemFromPage(stubPathname("/patterns/socks/summary/"))).toBe("socks");
    expect(resolvePatternSystemFromPage(stubPathname("/patterns/socks/edit/"))).toBe("socks");
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

describe("resolvePatternSystemForBuilderGate", () => {
  beforeEach(() => {
    stubLocalStorage();
    stubSessionStorage();
    localStorage.clear();
    sessionStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uses drop-shoulder pathname for the drop-shoulder builder", () => {
    const doc = stubPathname("/patterns/drop-shoulder/builder");
    expect(resolvePatternSystemForBuilderGate(doc)).toBe("drop-shoulder");
  });

  it("uses data-express-construction without falling back to a stale sleeveless draft", () => {
    saveCurrentPattern({ style: { patternMode: "express" } });
    const doc = stubDocument("/patterns/unknown-route", DROP_SHOULDER_CONSTRUCTION);
    expect(resolvePatternSystemForBuilderGate(doc)).toBe("drop-shoulder");
  });

  it("does not fall back to a stale drop-shoulder working draft on sleeveless-express", () => {
    seedDropShoulderWorkingDraft();
    const doc = stubPathname("/patterns/sleeveless-express");
    expect(resolvePatternSystemForBuilderGate(doc)).toBe("sleeveless");
  });

  it("defaults to sleeveless when URL and DOM do not express a system", () => {
    seedDropShoulderWorkingDraft();
    const doc = stubPathname("/patterns/sleeveless/pattern/");
    expect(resolvePatternSystemForBuilderGate(doc)).toBe("sleeveless");
    expect(resolvePatternSystemFromPage(doc)).toBe("drop-shoulder");
  });
});

describe("resolvePatternSystemFromWorkingSession", () => {
  beforeEach(() => {
    stubLocalStorage();
    stubSessionStorage();
    localStorage.clear();
    sessionStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("prefers hydrated construction baseline over page pathname", () => {
    writeActiveCustomPatternProjectId("proj-drop", "Drop Shoulder Vest");
    const project = {
      id: "proj-drop",
      name: "Drop Shoulder Vest",
      family: "sleeveless",
      source: "express",
      pattern: {
        style: {
          construction: DROP_SHOULDER_CONSTRUCTION,
          [CONSTRUCTION_AUTHORED_KEY]: DROP_SHOULDER_CONSTRUCTION,
        },
      },
      customOverrides: {},
    } as CustomPatternProject;
    writeHydratedConstructionBaseline(project);
    stubPathname("/patterns/sleeveless/pattern/");

    expect(resolvePatternSystemFromWorkingSession()).toBe("drop-shoulder");
  });

  it("uses resolvePatternSystemForEntitlement when a saved project is linked", () => {
    writeActiveCustomPatternProjectId("proj-drop", "Drop Shoulder Vest");
    const project = {
      id: "proj-drop",
      name: "Drop Shoulder Vest",
      family: "sleeveless",
      source: "express",
      pattern: {
        style: {
          construction: DROP_SHOULDER_CONSTRUCTION,
          [CONSTRUCTION_AUTHORED_KEY]: DROP_SHOULDER_CONSTRUCTION,
        },
      },
      customOverrides: {},
    } as CustomPatternProject;
    writeHydratedConstructionBaseline(project);
    stubPathname("/patterns/sleeveless-express");

    expect(resolvePatternSystemForEntitlement()).toBe("drop-shoulder");
    expect(resolvePatternSystemFromPage()).toBe("sleeveless");
  });

  it("uses builder page intent when no saved project is linked", () => {
    seedDropShoulderWorkingDraft();
    const doc = stubPathname("/patterns/sleeveless/pattern/");
    expect(resolvePatternSystemForEntitlement(doc)).toBe("sleeveless");
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
    const hat: Pick<CustomPatternProject, "pattern" | "customOverrides"> = {
      pattern: {
        patternType: "hat",
        patternSystem: "hat",
      } as CustomPatternProject["pattern"],
      customOverrides: {},
    };
    const sock: Pick<CustomPatternProject, "pattern" | "customOverrides"> = {
      pattern: {
        patternType: "socks",
        patternSystem: "socks",
      } as CustomPatternProject["pattern"],
      customOverrides: {},
    };

    expect(resolvePatternSystemFromProject(dropShoulder)).toBe("drop-shoulder");
    expect(resolvePatternSystemFromProject(sleeveless)).toBe("sleeveless");
    expect(resolvePatternSystemFromProject(hat)).toBe("hat");
    expect(resolvePatternSystemFromProject(sock)).toBe("socks");
    expect(patternSystemDisplayName("socks")).toBe("Socks");
  });
});
