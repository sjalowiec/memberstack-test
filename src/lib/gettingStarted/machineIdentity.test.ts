import { describe, expect, it } from "vitest";
import { getAllMachines } from "../machines/referenceCatalog";
import {
  BRAND_UNSURE_ID,
  BRAND_UNSURE_LABEL,
  MODEL_UNLISTED_ID,
  MODEL_UNLISTED_LABEL,
  brandOptions,
  buildMachineIdentityCatalog,
  filterIdentityOptions,
  isRealBrandId,
  matchingIdentityOption,
  modelOptions,
  parseMachineIdentityCatalog,
  reduceComboKey,
  shouldClearModelOnBrandChange,
  visibleIdentityOptions,
} from "./machineIdentity";

const catalog = buildMachineIdentityCatalog(getAllMachines());

describe("Getting Started machine catalog", () => {
  it("keeps each machine under the brand stored on that record", () => {
    const machines = getAllMachines().filter((machine) => machine.productType === "machine");
    expect(machines.length).toBeGreaterThan(0);

    for (const machine of machines) {
      const own = catalog.modelsByBrandId[machine.brand] ?? [];
      expect(own.some((option) => option.id === machine.slug)).toBe(true);

      for (const [brand, models] of Object.entries(catalog.modelsByBrandId)) {
        if (brand === machine.brand) continue;
        expect(models.some((option) => option.id === machine.slug)).toBe(false);
      }
    }
  });

  it("does not list accessories or empty brand records as models", () => {
    const machines = getAllMachines();
    const accessorySlugs = machines
      .filter((machine) => machine.productType !== "machine")
      .map((machine) => machine.slug);
    expect(accessorySlugs.length).toBeGreaterThan(0);

    const listed = Object.values(catalog.modelsByBrandId).flat().map((option) => option.id);
    for (const slug of accessorySlugs) {
      expect(listed).not.toContain(slug);
    }
  });

  it("offers I’m not sure first, and only the selected brand’s models", () => {
    const brands = brandOptions(catalog);
    expect(brands[0]).toEqual({ id: BRAND_UNSURE_ID, label: BRAND_UNSURE_LABEL });
    expect(brands.some((option) => option.label === "Brother")).toBe(true);
    expect(brands.some((option) => option.label === "Studio")).toBe(true);
    expect(catalog.brands.some((option) => option.id === BRAND_UNSURE_ID)).toBe(false);

    expect(modelOptions(catalog, "")).toEqual([]);
    expect(modelOptions(catalog, BRAND_UNSURE_ID)).toEqual([]);

    const brother = modelOptions(catalog, "Brother");
    const studio = modelOptions(catalog, "Studio");
    expect(brother[0]).toEqual({ id: MODEL_UNLISTED_ID, label: MODEL_UNLISTED_LABEL });
    expect(brother.length).toBeGreaterThan(10);
    expect(studio.length).toBeGreaterThan(10);

    const brotherIds = new Set(brother.map((option) => option.id));
    for (const option of studio) {
      if (option.id === MODEL_UNLISTED_ID) continue;
      expect(brotherIds.has(option.id)).toBe(false);
    }
  });

  it("clears the model when the brand changes and keeps it when the brand does not", () => {
    expect(shouldClearModelOnBrandChange("Brother", "Studio")).toBe(true);
    expect(shouldClearModelOnBrandChange("Brother", BRAND_UNSURE_ID)).toBe(true);
    expect(shouldClearModelOnBrandChange("Brother", "")).toBe(true);
    expect(shouldClearModelOnBrandChange("Brother", "Brother")).toBe(false);
    expect(isRealBrandId("Brother")).toBe(true);
    expect(isRealBrandId(BRAND_UNSURE_ID)).toBe(false);
    expect(isRealBrandId("")).toBe(false);
  });

  it("filters long lists without dropping an apostrophe mismatch", () => {
    const brands = brandOptions(catalog);
    const brother = filterIdentityOptions(brands, "bro");
    expect(brother.some((option) => option.id === "Brother")).toBe(true);
    expect(brother.some((option) => option.id === "Studio")).toBe(false);

    const unsure = filterIdentityOptions(brands, "i'm not");
    expect(unsure).toEqual([{ id: BRAND_UNSURE_ID, label: BRAND_UNSURE_LABEL }]);

    const models = modelOptions(catalog, "Brother");
    const narrowed = filterIdentityOptions(models, "kh9");
    expect(narrowed.length).toBeGreaterThan(0);
    expect(narrowed.every((option) => option.label.toLowerCase().includes("kh9"))).toBe(true);
  });

  it("shows every choice again while the field still displays the selected label", () => {
    const brands = brandOptions(catalog);
    expect(visibleIdentityOptions(brands, "Brother", "Brother")).toHaveLength(brands.length);
    expect(visibleIdentityOptions(brands, "stu", "Brother").map((option) => option.id)).toEqual([
      "Studio",
      "Studio/Singer",
    ]);
    expect(matchingIdentityOption(brands, "brother")).toEqual({
      id: "Brother",
      label: "Brother",
    });
    expect(matchingIdentityOption(brands, "br")).toBeNull();
  });

  it("moves, selects, and dismisses with the keyboard", () => {
    const closed = { open: false, activeIndex: -1, optionCount: 4, selectedIndex: 2 };
    expect(reduceComboKey({ ...closed, key: "ArrowDown" })).toMatchObject({
      open: true,
      activeIndex: 2,
      commit: false,
    });
    expect(
      reduceComboKey({ key: "ArrowDown", open: true, activeIndex: 2, optionCount: 4, selectedIndex: 2 }),
    ).toMatchObject({ open: true, activeIndex: 3 });
    expect(
      reduceComboKey({ key: "ArrowDown", open: true, activeIndex: 3, optionCount: 4, selectedIndex: 0 }),
    ).toMatchObject({ activeIndex: 3 });
    expect(
      reduceComboKey({ key: "Enter", open: true, activeIndex: 1, optionCount: 4, selectedIndex: 0 }),
    ).toMatchObject({ commit: true, open: false, activeIndex: 1 });
    expect(
      reduceComboKey({ key: "Escape", open: true, activeIndex: 1, optionCount: 4, selectedIndex: 0 }),
    ).toMatchObject({ open: false, revert: true });
    expect(
      reduceComboKey({ key: "Home", open: true, activeIndex: 3, optionCount: 4, selectedIndex: 0 }),
    ).toMatchObject({ activeIndex: 0 });
    expect(
      reduceComboKey({ key: "End", open: true, activeIndex: 0, optionCount: 4, selectedIndex: 0 }),
    ).toMatchObject({ activeIndex: 3 });
    expect(
      reduceComboKey({ key: "ArrowUp", open: false, activeIndex: -1, optionCount: 4, selectedIndex: -1 }),
    ).toMatchObject({ open: true, activeIndex: 3 });
  });

  it("rejects a catalog payload that is not the machine list", () => {
    expect(parseMachineIdentityCatalog(catalog)).toEqual(catalog);
    expect(parseMachineIdentityCatalog(null)).toBeNull();
    expect(parseMachineIdentityCatalog({ brands: [{ id: "", label: "Brother" }], modelsByBrandId: {} })).toBeNull();
  });
});
