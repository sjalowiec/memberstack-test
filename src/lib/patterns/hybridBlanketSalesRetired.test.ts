import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "../../..");

describe("Hybrid Blanket individual pattern sale retired", () => {
  it("redirects /patterns/hybrid-blanket/sales to the public Patterns about page", () => {
    const sales = readFileSync(
      resolve(root, "src/pages/patterns/hybrid-blanket/sales.astro"),
      "utf8",
    );
    expect(sales).toMatch(/Astro\.redirect\(\s*["']\/patterns\/about["']/);
    expect(sales).toMatch(/301/);
  });

  it("netlify.toml also redirects the obsolete sales route", () => {
    const toml = readFileSync(resolve(root, "netlify.toml"), "utf8");
    expect(toml).toMatch(/from\s*=\s*"\/patterns\/hybrid-blanket\/sales"/);
    expect(toml).toMatch(/to\s*=\s*"\/patterns\/about"/);
  });

  it("no live Stripe $13 individual-pattern purchase link remains in the sales route", () => {
    const sales = readFileSync(
      resolve(root, "src/pages/patterns/hybrid-blanket/sales.astro"),
      "utf8",
    );
    expect(sales).not.toMatch(/buy\.stripe\.com/i);
    expect(sales).not.toMatch(/\$13/);
    expect(sales).not.toMatch(/Buy the pattern/i);
    expect(sales).not.toMatch(/Get the Pattern/i);
    expect(sales).not.toMatch(/28E14m25EcCL8TsgcO0oM05/);
  });
});
