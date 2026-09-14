import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  KNIT_ABLES_CANONICAL_URL,
  KNIT_ABLES_LOGO,
  KNIT_ABLES_PATH,
} from "./knitAblesLanding";

const landingSource = readFileSync(
  resolve("src/pages/knit-ables/index.astro"),
  "utf8",
);
const inspirationSource = readFileSync(
  resolve("src/pages/knit-ables/teenage-kicks-socks.astro"),
  "utf8",
);
const headerSource = readFileSync(resolve("src/components/Header.astro"), "utf8");

describe("Knit-ables landing page logo", () => {
  it("is the public /knit-ables landing page", () => {
    expect(KNIT_ABLES_PATH).toBe("/knit-ables");
    expect(KNIT_ABLES_CANONICAL_URL).toBe("https://knititnow.com/knit-ables");
    expect(landingSource).toContain("export const prerender = true");
    expect(landingSource).toContain("KNIT_ABLES_LOGO");
    expect(landingSource).toContain('id="knit-ables-heading"');
  });

  it("uses the supplied Machine Knit-ables logo with CLS-safe sizing", () => {
    expect(KNIT_ABLES_LOGO.src).toBe("/images/knit-ables/machine-knit-ables-logo.png");
    expect(KNIT_ABLES_LOGO.alt).toBe("Machine Knit-ables knitted puzzle pieces");
    expect(KNIT_ABLES_LOGO.width).toBe(1200);
    expect(KNIT_ABLES_LOGO.height).toBe(1200);
    expect(existsSync(resolve("public/images/knit-ables/machine-knit-ables-logo.png"))).toBe(
      true,
    );
    expect(landingSource).toContain("src={logo.src}");
    expect(landingSource).toContain("alt={logo.alt}");
    expect(landingSource).toContain("width={logo.width}");
    expect(landingSource).toContain("height={logo.height}");
    expect(landingSource).toContain("width: min(100%, 160px)");
    expect(landingSource).toContain("width: min(100%, 220px)");
    expect(landingSource).toContain("align-items: start");
    expect(landingSource).toContain("object-fit: contain");
    expect(landingSource).toContain("overflow-x: hidden");
    expect(landingSource).not.toMatch(/\.knit-ables-logo[\s\S]*box-shadow/);
    expect(landingSource).not.toMatch(/\.knit-ables-logo[\s\S]*border:/);
    expect(landingSource).not.toMatch(/\.knit-ables-logo[\s\S]*background/);
  });

  it("does not add the logo to the site Header", () => {
    expect(headerSource).not.toContain("machine-knit-ables-logo.png");
    expect(inspirationSource).toContain("KnitAblePageHeader");
  });
});
