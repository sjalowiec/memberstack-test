import { beforeEach, describe, expect, it } from "vitest";
import {
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
});
