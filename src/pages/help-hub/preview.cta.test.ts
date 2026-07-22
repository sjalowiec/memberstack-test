import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const previewSource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "preview.astro"),
  "utf8",
);

describe("Help Hub preview membership CTA", () => {
  it("sends View membership to the canonical /membership page", () => {
    expect(previewSource).toMatch(
      /<a class="hh-preview__link" href="\/membership">\s*View membership\s*<\/a>/,
    );
    expect(previewSource).not.toMatch(
      /<a class="hh-preview__link" href="\/join">\s*View membership\s*<\/a>/,
    );
  });
});
