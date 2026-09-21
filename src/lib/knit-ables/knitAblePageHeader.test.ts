import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  KNIT_ABLES_LOGO,
  KNIT_ABLES_PAGE_LOGO_ALT,
  KNIT_ABLES_PATH,
} from "./knitAblesLanding";

const headerSource = readFileSync(
  resolve("src/components/knit-ables/KnitAblePageHeader.astro"),
  "utf8",
);
const pageSource = readFileSync(
  resolve("src/pages/knit-ables/teenage-kicks-socks.astro"),
  "utf8",
);
const worstedPageSource = readFileSync(
  resolve("src/pages/knit-ables/worsted-color-block-socks.astro"),
  "utf8",
);

describe("KnitAblePageHeader", () => {
  it("shows the Knit-able eyebrow, logo, and title", () => {
    expect(headerSource).toContain('eyebrow = "Knit-able Inspiration"');
    expect(headerSource).toContain("KNIT_ABLES_LOGO.src");
    expect(headerSource).toContain("KNIT_ABLES_PAGE_LOGO_ALT");
    expect(headerSource).toContain("{title}");
    expect(headerSource).toContain("id={headingId}");
    expect(KNIT_ABLES_PAGE_LOGO_ALT).toBe("Machine Knit-ables");
    expect(KNIT_ABLES_LOGO.src).toBe("/images/knit-ables/machine-knit-ables-logo.png");
    expect(existsSync(resolve("public/images/knit-ables/machine-knit-ables-logo.png"))).toBe(
      true,
    );
  });

  it("links the logo to the Knit-ables landing page", () => {
    expect(headerSource).toContain("href={KNIT_ABLES_PATH}");
    expect(headerSource).toContain("aria-label={KNIT_ABLES_PAGE_LOGO_ALT}");
    expect(KNIT_ABLES_PATH).toBe("/knit-ables");
    expect(headerSource).not.toContain('target="_blank"');
  });

  it("sizes the logo at about 80px on mobile and 125px on desktop", () => {
    expect(headerSource).toContain("max-width: 80px");
    expect(headerSource).toContain("width: min(100%, 80px)");
    expect(headerSource).toContain("max-width: 125px");
    expect(headerSource).toContain("width: min(100%, 125px)");
    expect(headerSource).toContain("object-fit: contain");
    expect(headerSource).toContain("align-items: center");
    expect(headerSource).toContain("height: auto");
  });

  it("is used by the Teenage Kicks Socks page", () => {
    expect(pageSource).toContain("KnitAblePageHeader");
    expect(pageSource).toContain('title="Colorful Self-Striping Socks"');
    expect(pageSource).toContain('headingId="knit-able-hero-heading"');
    expect(pageSource).not.toContain("<h1 id=\"knit-able-hero-heading\">");
  });

  it("is used by the Worsted Color-Block Socks page", () => {
    expect(worstedPageSource).toContain("KnitAblePageHeader");
    expect(worstedPageSource).toContain("WORSTED_COLOR_BLOCK_SOCKS_TITLE");
    expect(worstedPageSource).toContain('headingId="knit-able-hero-heading"');
  });
});
