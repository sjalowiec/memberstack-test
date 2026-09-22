import fs from "fs";
import path from "path";

import { describe, expect, it } from "vitest";

describe("Watson vendors pages", () => {
  const listPage = fs.readFileSync(
    path.resolve("src/pages/watson/vendors/index.astro"),
    "utf8",
  );
  const newPage = fs.readFileSync(
    path.resolve("src/pages/watson/vendors/new.astro"),
    "utf8",
  );
  const detailPage = fs.readFileSync(
    path.resolve("src/pages/watson/vendors/[id].astro"),
    "utf8",
  );
  const editPage = fs.readFileSync(
    path.resolve("src/pages/watson/vendors/[id]/edit.astro"),
    "utf8",
  );
  const form = fs.readFileSync(
    path.resolve("src/components/watson/WatsonVendorForm.astro"),
    "utf8",
  );
  const shell = fs.readFileSync(
    path.resolve("src/components/watson/WatsonPageShell.astro"),
    "utf8",
  );

  it("defines a server-rendered vendor list with search, status filter, and add/edit actions", () => {
    expect(listPage).toContain('export const prerender = false');
    expect(listPage).toContain("WatsonPageShell");
    expect(listPage).toContain("listVendors");
    expect(listPage).toContain('action="/watson/vendors"');
    expect(listPage).toContain('name="q"');
    expect(listPage).toContain('value="active"');
    expect(listPage).toContain('value="inactive"');
    expect(listPage).toContain('value="all"');
    expect(listPage).toContain("Add vendor");
    expect(listPage).toContain("View");
    expect(listPage).toContain("Edit");
    expect(listPage).toContain("parseVendorStatusFilter");
    expect(listPage).not.toMatch(/delete vendor/i);
    expect(listPage).not.toContain("DELETE");
    expect(shell).toContain('<a href="/watson/vendors">Vendors</a>');
  });

  it("uses the same add and edit form with required company name and cancel", () => {
    expect(newPage).toContain("WatsonVendorForm");
    expect(newPage).toContain('mode="add"');
    expect(newPage).toContain("createVendor");
    expect(newPage).toContain("vendorFormValuesFromUnknown");
    expect(editPage).toContain("WatsonVendorForm");
    expect(editPage).toContain('mode="edit"');
    expect(editPage).toContain("updateVendor");
    expect(form).toContain("Company name");
    expect(form).toContain("Contact name");
    expect(form).toContain("Vendor type/category");
    expect(form).toContain("Account number");
    expect(form).toContain("Cancel");
    expect(form).toContain('name="companyName"');
    expect(form).toContain("required");
    expect(form).toContain('name="isActive"');
    expect(form).not.toMatch(/delete/i);
  });

  it("shows a vendor detail page with an Edit button and no delete action", () => {
    expect(detailPage).toContain("getVendorById");
    expect(detailPage).toContain("buildVendorOverviewFields");
    expect(detailPage).toContain("Edit");
    expect(detailPage).toContain("WatsonMemberOverview");
    expect(detailPage).not.toMatch(/delete/i);
  });
});
