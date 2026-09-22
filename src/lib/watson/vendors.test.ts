import fs from "fs";
import path from "path";

import { describe, expect, it, vi } from "vitest";

import {
  buildVendorDisplay,
  createVendor,
  getVendorById,
  listVendors,
  parseVendorStatusFilter,
  updateVendor,
  validateVendorEmail,
  validateVendorWebsite,
  validateVendorWriteInput,
  VENDOR_BY_ID_SQL,
  VENDOR_LIST_SQL,
  vendorFormValuesFromUnknown,
} from "./vendors";

const baseRow = {
  id: "vendor-1",
  company_name: "Silver Reed",
  contact_name: "Pat Lee",
  email: "pat@example.com",
  phone: "503-555-0100",
  website: "https://example.com/",
  vendor_type: "Machines",
  address_line1: "123 Knit St",
  address_line2: null,
  city: "Portland",
  state: "OR",
  postal_code: "97201",
  country: "USA",
  account_number: "SR-100",
  notes: "Preferred machine vendor",
  is_active: true,
  created_at: "2026-09-22T12:00:00.000Z",
  updated_at: "2026-09-22T12:00:00.000Z",
};

const writeInput = {
  companyName: " Silver Reed ",
  contactName: " Pat Lee ",
  email: " pat@example.com ",
  phone: " 503-555-0100 ",
  website: "example.com",
  vendorType: " Machines ",
  addressLine1: " 123 Knit St ",
  addressLine2: "  ",
  city: " Portland ",
  state: " OR ",
  postalCode: " 97201 ",
  country: " USA ",
  accountNumber: " SR-100 ",
  notes: " Preferred machine vendor ",
  isActive: true,
};

describe("vendors validation", () => {
  it("requires a company name", () => {
    expect(validateVendorWriteInput({ companyName: "  " }).ok).toBe(false);
    expect(validateVendorWriteInput({ companyName: "" })).toEqual({
      ok: false,
      error: "Company name is required.",
    });
    expect(validateVendorWriteInput({ companyName: "  Knit Supply  " })).toEqual({
      ok: true,
      value: expect.objectContaining({ companyName: "Knit Supply", isActive: true }),
    });
  });

  it("validates email format without requiring email", () => {
    expect(validateVendorEmail("")).toEqual({ ok: true, value: null });
    expect(validateVendorEmail("   ")).toEqual({ ok: true, value: null });
    expect(validateVendorEmail("pat@example.com")).toEqual({
      ok: true,
      value: "pat@example.com",
    });
    expect(validateVendorEmail("not-an-email")).toEqual({
      ok: false,
      error: "Email must be a valid email address.",
    });
  });

  it("validates website format without requiring a website", () => {
    expect(validateVendorWebsite("")).toEqual({ ok: true, value: null });
    expect(validateVendorWebsite("example.com")).toEqual({
      ok: true,
      value: "https://example.com/",
    });
    expect(validateVendorWebsite("https://vendor.example")).toEqual({
      ok: true,
      value: "https://vendor.example/",
    });
    expect(validateVendorWebsite("javascript:alert(1)")).toEqual({
      ok: false,
      error: "Website must be a valid URL (http:// or https://).",
    });
    expect(validateVendorWebsite("not a url")).toEqual({
      ok: false,
      error: "Website must be a valid URL (http:// or https://).",
    });
  });

  it("preserves entered form values after a validation failure", () => {
    const values = vendorFormValuesFromUnknown({
      companyName: "",
      contactName: "Pat",
      email: "not-an-email",
      website: "nope",
      isActive: "false",
    });
    expect(values.companyName).toBe("");
    expect(values.contactName).toBe("Pat");
    expect(values.email).toBe("not-an-email");
    expect(values.website).toBe("nope");
    expect(values.isActive).toBe(false);
    expect(validateVendorWriteInput(values).ok).toBe(false);
  });
});

describe("vendors queries", () => {
  it("creates a vendor and stores trimmed values", async () => {
    const queryFn = vi.fn().mockResolvedValueOnce([baseRow]);
    const result = await createVendor(writeInput, queryFn);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.companyName).toBe("Silver Reed");
      expect(result.value.href).toBe("/watson/vendors/vendor-1");
      expect(result.value.editHref).toBe("/watson/vendors/vendor-1/edit");
    }

    expect(queryFn.mock.calls[0]?.[0]).toContain("INSERT INTO watson_vendors");
    expect(queryFn.mock.calls[0]?.[0]).not.toMatch(/\bDELETE\b/i);
    expect(queryFn.mock.calls[0]?.[1]).toEqual([
      "Silver Reed",
      "Pat Lee",
      "pat@example.com",
      "503-555-0100",
      "https://example.com/",
      "Machines",
      "123 Knit St",
      null,
      "Portland",
      "OR",
      "97201",
      "USA",
      "SR-100",
      "Preferred machine vendor",
      true,
    ]);
  });

  it("edits a vendor, including marking it inactive", async () => {
    const updatedRow = { ...baseRow, is_active: false, notes: "On hold" };
    const queryFn = vi.fn().mockResolvedValueOnce([updatedRow]);
    const result = await updateVendor(
      "vendor-1",
      { ...writeInput, notes: "On hold", isActive: false },
      queryFn,
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.isActive).toBe(false);
      expect(result.value.statusLabel).toBe("Inactive");
      expect(result.value.notes).toBe("On hold");
    }
    expect(queryFn.mock.calls[0]?.[0]).toContain("UPDATE watson_vendors");
    expect(queryFn.mock.calls[0]?.[0]).toContain("is_active = $16");
    expect(queryFn.mock.calls[0]?.[0]).not.toMatch(/\bDELETE\b/i);
    expect(queryFn.mock.calls[0]?.[1]?.[0]).toBe("vendor-1");
    expect(queryFn.mock.calls[0]?.[1]?.[14]).toBe("On hold");
    expect(queryFn.mock.calls[0]?.[1]?.[15]).toBe(false);
  });

  it("searches vendors by company, contact, email, phone, category, or account number", async () => {
    const queryFn = vi.fn().mockResolvedValueOnce([baseRow]);
    const vendors = await listVendors({ q: "Silver", status: "all" }, queryFn);

    expect(vendors).toHaveLength(1);
    expect(queryFn).toHaveBeenCalledWith(VENDOR_LIST_SQL, ["Silver", "%Silver%", "all"]);
    expect(VENDOR_LIST_SQL).toContain("company_name ILIKE $2");
    expect(VENDOR_LIST_SQL).toContain("contact_name");
    expect(VENDOR_LIST_SQL).toContain("email");
    expect(VENDOR_LIST_SQL).toContain("phone");
    expect(VENDOR_LIST_SQL).toContain("vendor_type");
    expect(VENDOR_LIST_SQL).toContain("account_number");
    expect(VENDOR_LIST_SQL).toContain("ORDER BY LOWER(company_name) ASC");
  });

  it("defaults to active vendors and can filter inactive or all", () => {
    expect(parseVendorStatusFilter(null)).toBe("active");
    expect(parseVendorStatusFilter(undefined)).toBe("active");
    expect(parseVendorStatusFilter("inactive")).toBe("inactive");
    expect(parseVendorStatusFilter("all")).toBe("all");
    expect(parseVendorStatusFilter("nope")).toBe("active");
    expect(VENDOR_LIST_SQL).toContain("$3 = 'active' AND is_active = TRUE");
    expect(VENDOR_LIST_SQL).toContain("$3 = 'inactive' AND is_active = FALSE");
  });

  it("loads a vendor by id", async () => {
    const queryFn = vi.fn().mockResolvedValueOnce([baseRow]);
    const vendor = await getVendorById("vendor-1", queryFn);
    expect(queryFn).toHaveBeenCalledWith(VENDOR_BY_ID_SQL, ["vendor-1"]);
    expect(vendor?.companyName).toBe("Silver Reed");
    expect(buildVendorDisplay(baseRow).statusLabel).toBe("Active");
  });

  it("does not permanently delete vendors", () => {
    const source = fs.readFileSync(path.resolve("src/lib/watson/vendors.ts"), "utf8");
    expect(source).not.toMatch(/DELETE FROM watson_vendors/i);
    expect(source).not.toContain("export async function deleteVendor");
    expect(source).toContain("is_active");
  });
});
