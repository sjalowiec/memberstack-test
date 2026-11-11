import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const pageSource = readFileSync(
  resolve("src/pages/reference/how-difficult-is-it-to-learn.astro"),
  "utf8",
);
const referenceIndexSource = readFileSync(resolve("src/pages/reference/index.astro"), "utf8");
const favoriteCatalogSource = readFileSync(
  resolve("src/lib/favorites/referenceFavoriteCatalog.ts"),
  "utf8",
);

describe("how difficult is it to learn reference page", () => {
  it("is a public prerendered reference page", () => {
    expect(pageSource).toContain("export const prerender = true");
    expect(pageSource).toContain(
      'const CANONICAL_URL = "https://knititnow.com/reference/how-difficult-is-it-to-learn"',
    );
    expect(pageSource).toContain("href={CANONICAL_URL}");
    expect(pageSource).toContain('const PAGE_H1 = "How Difficult Is It to Learn?"');
    expect(pageSource).toContain('title={PAGE_H1}');
    expect(pageSource).toContain(
      "Curious about machine knitting? Find out what to practice first and how to work up to your first project.",
    );
    expect(pageSource).toContain('backHref="/reference"');
    expect(pageSource).toContain("Back to References");
    expect(pageSource).not.toContain("noindex");
  });

  it("keeps the learning copy and links to the getting started guide", () => {
    expect(pageSource).toContain("There’s a learning curve, but you can knit your first piece of fabric");
    expect(pageSource).toContain("What should I try first?");
    expect(pageSource).toContain("Do I need to know how to hand knit?");
    expect(pageSource).toContain("When can I make something I’ll actually wear?");
    expect(pageSource).toContain('const GETTING_STARTED_HREF = "/getting-started-guide/"');
    expect(pageSource).toContain("href={GETTING_STARTED_HREF}>Getting Started Guide</a>");
    expect(pageSource).toContain("will help you check it over and knit your first practice swatch.");
  });

  it("is listed on the References catalog and favorite catalog", () => {
    const newToStart = referenceIndexSource.indexOf("const newToMkCards");
    const newToBlock = referenceIndexSource.slice(
      newToStart,
      referenceIndexSource.indexOf("];", newToStart),
    );
    expect(newToBlock).toContain('title: "How Difficult Is It to Learn?"');
    expect(newToBlock).toContain('href: "/reference/how-difficult-is-it-to-learn/"');
    expect(newToBlock).toContain(
      "Curious about machine knitting? Find out what to practice first and how to work up to your first project.",
    );
    expect(favoriteCatalogSource).toContain('title: "How Difficult Is It to Learn?"');
    expect(favoriteCatalogSource).toContain('href: "/reference/how-difficult-is-it-to-learn"');
  });
});
