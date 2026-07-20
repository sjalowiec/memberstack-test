import { describe, expect, it } from "vitest";
import {
  normalizeMachineForSave,
  normalizeProductType,
} from "./machineAdminFields";
import {
  getAccessoriesForSale,
  getMachinesForSale,
  getShopProductsForSale,
  shopCatalogBackLink,
} from "./referenceCatalog";

describe("normalizeProductType", () => {
  it("defaults missing and unknown values to machine", () => {
    expect(normalizeProductType(undefined)).toBe("machine");
    expect(normalizeProductType(null)).toBe("machine");
    expect(normalizeProductType("")).toBe("machine");
    expect(normalizeProductType("widget")).toBe("machine");
    expect(normalizeProductType("Machine")).toBe("machine");
  });

  it("accepts accessory (case-insensitive)", () => {
    expect(normalizeProductType("accessory")).toBe("accessory");
    expect(normalizeProductType("Accessory")).toBe("accessory");
  });
});

describe("normalizeMachineForSave productType", () => {
  it("defaults missing productType to machine on save", () => {
    const result = normalizeMachineForSave(
      {
        machineId: 9001,
        brand: "Test Brand",
        model: "T-1",
      },
      0
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.machine.productType).toBe("machine");
  });

  it("preserves accessory productType on save", () => {
    const result = normalizeMachineForSave(
      {
        machineId: 9002,
        brand: "Test Brand",
        model: "A-1",
        productType: "accessory",
        notes: "keep me",
        customLegacyField: "preserved",
      },
      0
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.machine.productType).toBe("accessory");
    expect(result.machine.notes).toBe("keep me");
    expect(result.machine.customLegacyField).toBe("preserved");
  });
});

describe("shop catalog productType filters", () => {
  it("machine shop excludes accessories", () => {
    const machines = getMachinesForSale();
    expect(machines.every((m) => m.productType === "machine")).toBe(true);
    expect(machines.some((m) => m.model === "SRP 60N")).toBe(false);
    expect(machines.some((m) => m.model === "TA-8200")).toBe(false);
  });

  it("accessories page excludes machines", () => {
    const accessories = getAccessoriesForSale();
    expect(accessories.length).toBeGreaterThan(0);
    expect(accessories.every((m) => m.productType === "accessory")).toBe(true);
    expect(accessories.every((m) => m.sale?.forSale === true)).toBe(true);
    expect(accessories.some((m) => m.model === "SRP 60N")).toBe(true);
    expect(accessories.some((m) => m.model === "TA-8200")).toBe(true);
    expect(accessories.some((m) => m.model === "SK280")).toBe(false);
  });

  it("shop product detail paths still include both types", () => {
    const all = getShopProductsForSale();
    expect(all.some((m) => m.productType === "machine")).toBe(true);
    expect(all.some((m) => m.model === "SRP 60N")).toBe(true);
    expect(all.some((m) => m.model === "TA-8200")).toBe(true);
  });
});

describe("shopCatalogBackLink", () => {
  it("uses Accessories back link for accessory products", () => {
    const link = shopCatalogBackLink("accessory");
    expect(link.href).toBe("/shop/accessories");
    expect(link.label).toContain("Back to Accessories");
  });

  it("uses Machines back link for machine products", () => {
    const link = shopCatalogBackLink("machine");
    expect(link.href).toBe("/shop/machines");
    expect(link.label).toContain("Back to Machines");
  });
});
