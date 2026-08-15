import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const catalog = readFileSync(resolve("src/pages/patterns/index.astro"), "utf8");
const hatBuilder = readFileSync(resolve("src/pages/patterns/hat/builder.astro"), "utf8");

describe("pattern catalog Hat card", () => {
  it("lists Hat as an available card using the production builder photo and route", () => {
    expect(catalog).toContain("title: 'Hat'");
    expect(catalog).toContain("href: '/patterns/hat/builder'");
    expect(catalog).toContain("image: '/images/patterns/Hat_builder.png'");
    expect(catalog).toContain(
      "copy: 'Knit a hat that actually fits with brim choices, custom sizing, and machine-friendly instructions.'",
    );
    expect(catalog).toContain("button: 'Create your hat'");
    expect(catalog).not.toContain("title: 'Hat Pattern Builder'");
    expect(catalog).not.toContain("/images/patterns/basic-hat.webp");
    expect(catalog).not.toContain("Hat Pattern Builder — POSTPONED");
    expect(catalog).toContain("Choose a pattern to get started");
    expect(catalog).not.toContain("Pick a sweater builder");
  });

  it("stays public so a logged-out visitor can see and open the free Hat builder", () => {
    expect(catalog).not.toContain("SleevelessPatternMemberGate");
    expect(hatBuilder).toMatch(/Free\s*\/\s*ungated/i);
    expect(hatBuilder).not.toContain("SleevelessPatternMemberGate");
  });

  it("leaves existing sweater catalog cards unchanged", () => {
    expect(catalog).toContain("title: 'Sleeveless Sweater'");
    expect(catalog).toContain("href: '/patterns/sleeveless/builder?new=1'");
    expect(catalog).toContain(
      "image: '/images/patterns/sleeveless/people/sleeveless-woman-pullover-round-neck.webp'",
    );
    expect(catalog).toContain("button: 'Create sleeveless sweater'");

    expect(catalog).toContain("title: 'Drop Shoulder Sweater'");
    expect(catalog).toContain("href: '/patterns/drop-shoulder/builder?new=1'");
    expect(catalog).toContain(
      "image: '/images/patterns/drop-shoulder/drop-man-pullover-round.webp'",
    );
    expect(catalog).toContain("button: 'Create drop shoulder sweater'");
  });
});
