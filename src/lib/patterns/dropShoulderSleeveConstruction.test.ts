import { beforeEach, describe, expect, it } from "vitest";
import {
  DROP_SHOULDER_SLEEVE_CONSTRUCTION_CHOICE_TIP_ID,
  dropShoulderSleeveConstructionChoiceQuickTipBodyHtml,
  dropShoulderSleeveConstructionChoiceQuickTipInnerHtml,
  dropShoulderSleeveConstructionStorageKey,
  readDropShoulderSleeveConstruction,
  writeDropShoulderSleeveConstruction,
} from "./dropShoulderSleeveConstruction";
import { stubLocalStorage } from "./test/stubLocalStorage";

describe("dropShoulderSleeveConstruction", () => {
  beforeEach(() => {
    stubLocalStorage();
    localStorage.clear();
  });

  it("defaults to bottom-up (cuff-up)", () => {
    expect(readDropShoulderSleeveConstruction("pattern-1")).toBe("cuff-up");
  });

  it("persists per pattern id in localStorage", () => {
    writeDropShoulderSleeveConstruction("pattern-1", "top-down");
    expect(localStorage.getItem(dropShoulderSleeveConstructionStorageKey("pattern-1"))).toBe("top-down");
    expect(readDropShoulderSleeveConstruction("pattern-1")).toBe("top-down");
    expect(readDropShoulderSleeveConstruction("pattern-2")).toBe("cuff-up");
  });

  it("builds a collapsible quick tip for sleeve construction choice", () => {
    const inner = dropShoulderSleeveConstructionChoiceQuickTipInnerHtml();
    const body = dropShoulderSleeveConstructionChoiceQuickTipBodyHtml();
    expect(inner).toContain("pattern-quick-tip__details");
    expect(inner).toContain("Sleeve construction choice");
    expect(body).toContain("drop-shoulder-sleeve-construction-tip-body__columns");
    expect(body).toContain("Top-Down Sleeve:");
    expect(body).toContain("Bottom-Up Sleeve:");
    expect(body).toContain("drop-shoulder-sleeve-construction-tip-body__summary");
    expect(body).toContain("Both methods produce the same finished sweater.");
    expect(DROP_SHOULDER_SLEEVE_CONSTRUCTION_CHOICE_TIP_ID).toBe("drop-shoulder-sleeve-construction-choice");
  });
});
