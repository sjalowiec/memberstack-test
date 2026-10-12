import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { writeActiveCustomPatternProjectId } from "./customPatternProjectActiveId";
import {
  getCurrentPattern,
  getPatternData,
  saveCurrentPattern,
  savePatternData,
} from "./patternStorage";
import { withSetInSleeveConstructionAuthored } from "./setInSleeveConstructionIdentity";
import {
  expressWhoForSetInSleeveChart,
  isSetInSleeveGeneratedSizeLocked,
  pinSetInSleeveWizardValuesToLockedSize,
  readSetInSleeveGeneratedSizeLockFromDraft,
  reassertSetInSleeveSizeLockOnEditSave,
  setInSleeveLockedSizeChangeAllowed,
  setInSleeveSizeLockNotice,
  stampSetInSleeveGeneratedSizeLock,
} from "./setInSleeveSizeLock";
import { stubLocalStorage } from "./test/stubLocalStorage";

const setInSleevePatternAstro = readFileSync(
  resolve("src/pages/patterns/set-in-sleeve/pattern/index.astro"),
  "utf8",
);
const sleevelessPatternAstro = readFileSync(
  resolve("src/pages/patterns/sleeveless/pattern/index.astro"),
  "utf8",
);
const dropShoulderPatternAstro = readFileSync(
  resolve("src/pages/patterns/drop-shoulder/pattern/index.astro"),
  "utf8",
);

function seedSetInSleeveDraft(input?: {
  selectedSize?: string;
  chart?: string;
  measurements?: Record<string, unknown>;
  locked?: boolean;
}): void {
  const selectedSize = input?.selectedSize ?? "8";
  const chart = input?.chart ?? "misses";
  const style = withSetInSleeveConstructionAuthored({ recipientCategory: chart });
  const fit: Record<string, unknown> = {
    selectedSize,
    sizingChart: chart,
    selectedMeasurements: input?.measurements ?? { bust: 36, upper_arm: 11.5, wrist: 6 },
  };
  if (input?.locked) fit.setInSleeveSizeLocked = true;
  saveCurrentPattern({ style, fit });
  savePatternData("style", style);
  savePatternData("fit", fit);
}

function stubSetInSleeveBuilderPage(): void {
  const marker = {
    getAttribute: (name: string) => (name === "data-express-construction" ? "set-in-sleeve" : null),
  };
  vi.stubGlobal("document", {
    querySelector: (sel: string) => (sel === "[data-express-construction]" ? marker : null),
    defaultView: { location: { pathname: "/patterns/set-in-sleeve/builder" } },
  });
}

function stubSetInSleevePatternPage(): void {
  vi.stubGlobal("document", {
    querySelector: () => null,
    defaultView: { location: { pathname: "/patterns/set-in-sleeve/pattern/" } },
  });
}

describe("Set-In Sleeve generated size lock", () => {
  beforeEach(() => {
    stubLocalStorage();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("locks only a generated or saved Set-In Sleeve pattern that already has a size", () => {
    expect(
      isSetInSleeveGeneratedSizeLocked({
        constructionIsSetIn: true,
        selectedSize: "8",
        sizeLockFlag: false,
        savedProject: false,
      }),
    ).toBe(false);
    expect(
      isSetInSleeveGeneratedSizeLocked({
        constructionIsSetIn: true,
        selectedSize: "8",
        sizeLockFlag: true,
        savedProject: false,
      }),
    ).toBe(true);
    expect(
      isSetInSleeveGeneratedSizeLocked({
        constructionIsSetIn: true,
        selectedSize: "8",
        sizeLockFlag: false,
        savedProject: true,
      }),
    ).toBe(true);
    expect(
      isSetInSleeveGeneratedSizeLocked({
        constructionIsSetIn: true,
        selectedSize: "",
        sizeLockFlag: true,
        savedProject: true,
      }),
    ).toBe(false);
    expect(
      isSetInSleeveGeneratedSizeLocked({
        constructionIsSetIn: false,
        selectedSize: "8",
        sizeLockFlag: true,
        savedProject: true,
      }),
    ).toBe(false);
    expect(setInSleeveLockedSizeChangeAllowed("8", "8")).toBe(true);
    expect(setInSleeveLockedSizeChangeAllowed("8", "10")).toBe(false);
    expect(expressWhoForSetInSleeveChart("misses")).toBe("women");
    expect(expressWhoForSetInSleeveChart("plus")).toBe("plus");
    expect(expressWhoForSetInSleeveChart("men")).toBe("men");
  });

  it("does not lock a new Set-In Sleeve pattern before it is generated", () => {
    stubSetInSleeveBuilderPage();
    seedSetInSleeveDraft({ selectedSize: "8" });
    const values = { selectedSize: "10", who: "men" };

    expect(readSetInSleeveGeneratedSizeLockFromDraft().locked).toBe(false);
    expect(pinSetInSleeveWizardValuesToLockedSize(values)).toBe(false);
    expect(values).toEqual({ selectedSize: "10", who: "men" });
  });

  it("stamps the lock at generation without replacing measurements", () => {
    seedSetInSleeveDraft({
      selectedSize: "8",
      measurements: { bust: 36, upper_arm: 11.5, wrist: 6 },
    });

    expect(stampSetInSleeveGeneratedSizeLock()).toBe(true);

    const fit = getCurrentPattern().fit;
    expect(fit.setInSleeveSizeLocked).toBe(true);
    expect(fit.selectedSize).toBe("8");
    expect(fit.sizingChart).toBe("misses");
    expect(fit.selectedMeasurements).toEqual({ bust: 36, upper_arm: 11.5, wrist: 6 });
    expect(readSetInSleeveGeneratedSizeLockFromDraft().locked).toBe(true);
  });

  it("puts a reopened generated pattern back on its original size and chart", () => {
    stubSetInSleeveBuilderPage();
    seedSetInSleeveDraft({ selectedSize: "8", chart: "misses", locked: true });
    const values = { selectedSize: "12", who: "men" };

    expect(pinSetInSleeveWizardValuesToLockedSize(values)).toBe(true);
    expect(values).toEqual({ selectedSize: "8", who: "women" });
    expect(setInSleeveSizeLockNotice("8")).toBe(
      "This pattern keeps size 8. To choose a different size, start a new pattern.",
    );
  });

  it("locks a previously saved Set-In Sleeve pattern even before the flag is written", () => {
    stubSetInSleeveBuilderPage();
    seedSetInSleeveDraft({ selectedSize: "10", chart: "men" });
    writeActiveCustomPatternProjectId("saved-set-in");
    const values = { selectedSize: "12", who: "women" };

    expect(readSetInSleeveGeneratedSizeLockFromDraft().locked).toBe(true);
    expect(getCurrentPattern().fit.setInSleeveSizeLocked).toBeUndefined();
    expect(pinSetInSleeveWizardValuesToLockedSize(values)).toBe(true);
    expect(values).toEqual({ selectedSize: "10", who: "men" });
  });

  it("keeps the original size, chart, and measurements when an edit is saved", () => {
    stubSetInSleevePatternPage();
    seedSetInSleeveDraft({
      selectedSize: "8",
      chart: "plus",
      measurements: { bust: 42, upper_arm: 13 },
    });

    reassertSetInSleeveSizeLockOnEditSave();

    const pattern = getCurrentPattern();
    expect(pattern.fit.selectedSize).toBe("8");
    expect(pattern.fit.sizingChart).toBe("plus");
    expect(pattern.fit.setInSleeveSizeLocked).toBe(true);
    expect(pattern.fit.selectedMeasurements).toEqual({ bust: 42, upper_arm: 13 });
    expect(pattern.style.recipientCategory).toBe("plus");
    expect(getPatternData().fit).toMatchObject({
      selectedSize: "8",
      sizingChart: "plus",
      setInSleeveSizeLocked: true,
      selectedMeasurements: { bust: 42, upper_arm: 13 },
    });
  });

  it("does not stamp a sleeveless draft", () => {
    saveCurrentPattern({
      style: { construction: "sleeveless" },
      fit: { selectedSize: "8", selectedMeasurements: { bust: 34 } },
    });

    expect(stampSetInSleeveGeneratedSizeLock()).toBe(false);
    expect(getCurrentPattern().fit.setInSleeveSizeLocked).toBeUndefined();
    expect(getCurrentPattern().fit.selectedMeasurements).toEqual({ bust: 34 });
  });

  it("removes the Set-In Sleeve Quick Edits size control and leaves the other builders alone", () => {
    expect(setInSleevePatternAstro).not.toContain("data-sl-edit-size");
    expect(setInSleevePatternAstro).not.toContain("sl-edit-size");
    expect(setInSleevePatternAstro).not.toContain(
      "Changing the size updates the pattern measurements automatically.",
    );
    expect(setInSleevePatternAstro).toContain("Quick edits");
    expect(setInSleevePatternAstro).toContain('name="sl-edit-garment"');
    expect(sleevelessPatternAstro).toContain("data-sl-edit-size");
    expect(dropShoulderPatternAstro).toContain("data-sl-edit-size");
  });
});
