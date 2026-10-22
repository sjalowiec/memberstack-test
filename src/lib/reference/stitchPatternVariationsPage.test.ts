import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const pageSource = readFileSync(
  resolve("src/pages/reference/stitch-pattern-variations.astro"),
  "utf8",
);
const referenceIndexSource = readFileSync(resolve("src/pages/reference/index.astro"), "utf8");
const favoriteCatalogSource = readFileSync(
  resolve("src/lib/favorites/referenceFavoriteCatalog.ts"),
  "utf8",
);

describe("stitch pattern variations reference page", () => {
  it("is a public prerendered reference page with SEO metadata", () => {
    expect(pageSource).toContain("export const prerender = true");
    expect(pageSource).toContain(
      'const CANONICAL_URL = "https://knititnow.com/reference/stitch-pattern-variations"',
    );
    expect(pageSource).toContain("href={CANONICAL_URL}");
    expect(pageSource).toContain('const PAGE_H1 = "Stitch Pattern Variations"');
    expect(pageSource).toContain(
      "Get more from a stitch pattern by changing its direction, proportions, or needle selection.",
    );
    expect(pageSource).not.toContain("noindex");
  });

  it("uses the reference shell, one title, and the catalog video gate", () => {
    expect(pageSource).toContain('title={PAGE_H1}');
    expect(pageSource).toContain('backHref="/reference"');
    expect(pageSource).toContain("Back to References");
    expect(pageSource).toContain('slug === "brother-970-stitch-pattern-variations"');
    expect(pageSource).toContain("<GatedVimeoEmbed");
    expect(pageSource).not.toContain("player.vimeo.com");
    expect(pageSource).toContain("Watch: Stitch Pattern Variations on the Brother 970");
    expect(pageSource).toContain(
      "This video demonstrates Brother 970/CB1 controls, while this guide explains broader",
    );
  });

  it("does not link an unconfirmed course lesson", () => {
    expect(pageSource).not.toContain("/courses/87/lesson/4268");
    expect(pageSource).not.toContain("Related lesson");
    expect(pageSource).not.toContain("card_lock_lever");
    expect(pageSource).not.toContain("Card Lock Lever");
  });

  it("states machine limits without X marks", () => {
    expect(pageSource).toContain("Not generally a built-in control.");
    expect(pageSource).toContain("Available on supported models; check your manual.");
    expect(pageSource).toContain("Where supported");
    expect(pageSource).toContain("Where supported on the Brother 970/CB1");
    expect(pageSource).toContain("changing, reversing, or");
    expect(pageSource).toContain("repunching the card, depending on the machine and pattern.");
    expect(pageSource).toContain("Stitch structure and gauge affect");
    expect(pageSource).not.toMatch(/[✗×✘]|❌/);
  });

  it("shows an original motif and an example for each variation", () => {
    expect(pageSource).toContain('id="stitch-variation-original">Original');
    expect(pageSource).toContain("These drawings illustrate the effect. They are not replicas of machine buttons.");
    expect(pageSource).toContain("<th scope=\"col\">Example</th>");
    expect(pageSource).toContain('exampleCaption: "Flipped left to right."');
    expect(pageSource).toContain('exampleCaption: "Original beside its horizontal reflection."');
    expect(pageSource).toContain('exampleCaption: "Flipped top to bottom."');
    expect(pageSource).toContain('exampleCaption: "Original above its vertical reflection."');
    expect(pageSource).toContain('exampleCaption: "Stretched to twice the width."');
    expect(pageSource).toContain('exampleCaption: "Stretched to twice the height."');
    expect(pageSource).toContain('exampleCaption: "Rotated 90° as an example."');
    expect(pageSource).toContain(
      'exampleCaption: "White elephant on a dark background, beside the original."',
    );
    expect(pageSource).toContain('const ELEPHANT_SRC = "/images/reference/elephant.svg"');
    expect(pageSource).toContain("elephant silhouette");
    expect(pageSource).not.toContain("M 16 46");
    expect(pageSource).toContain('example: "text"');
    expect(pageSource).toContain('exampleCaption: "See the description."');
    expect(pageSource).toContain("<svg");
    expect(pageSource).toContain("width: calc(7.5rem * var(--stitch-units, 1))");
    expect(pageSource).toContain("max-width: none");
    expect(pageSource).toContain("scene(width * 2, height, [{ transform: \"scale(2 1)\"");
    expect(pageSource).toContain("scene(width, height * 2, [{ transform: \"scale(1 2)\"");
    expect(pageSource).not.toContain("min(100%, 16rem)");
    expect(pageSource).not.toMatch(/duck/i);
  });

  it("is listed on the References catalog and favorite catalog", () => {
    expect(referenceIndexSource).toContain('title: "Stitch Pattern Variations"');
    expect(referenceIndexSource).toContain('href: "/reference/stitch-pattern-variations"');
    expect(favoriteCatalogSource).toContain('href: "/reference/stitch-pattern-variations"');
    expect(favoriteCatalogSource).toContain('title: "Stitch Pattern Variations"');
  });
});
