import { describe, expect, it } from "vitest";
import {
  currentGlossaryPath,
  parseLegacyGlossaryHref,
  resolveLegacyGlossaryHref,
} from "./legacyGlossaryHrefs";

const catalog = [
  { glossaryId: 249, slug: "ravel-cord" },
  { glossaryId: 283, slug: "cast-on-comb" },
];

describe("parseLegacyGlossaryHref", () => {
  it("parses the production /glossary/{id}/{slug}/term format", () => {
    expect(parseLegacyGlossaryHref("/glossary/283/cast-on-comb/term")).toEqual({
      id: 283,
      slug: "cast-on-comb",
    });
    expect(
      parseLegacyGlossaryHref("https://www.knititnow.com/glossary/249/ravel-cord/term"),
    ).toEqual({ id: 249, slug: "ravel-cord" });
    expect(parseLegacyGlossaryHref("https://knititnow.com/glossary/249/ravel-cord/term")).toEqual({
      id: 249,
      slug: "ravel-cord",
    });
  });

  it("allows a missing /term suffix and a trailing slash", () => {
    expect(parseLegacyGlossaryHref("/glossary/283/cast-on-comb")).toEqual({
      id: 283,
      slug: "cast-on-comb",
    });
    expect(parseLegacyGlossaryHref("/glossary/283/cast-on-comb/term/")).toEqual({
      id: 283,
      slug: "cast-on-comb",
    });
  });

  it("ignores current-site glossary slugs and unrelated paths", () => {
    expect(parseLegacyGlossaryHref("/glossary/gauge/")).toBeNull();
    expect(parseLegacyGlossaryHref("/glossary/point-cams/")).toBeNull();
    expect(parseLegacyGlossaryHref("/glossary/modal/ravel-cord/")).toBeNull();
    expect(parseLegacyGlossaryHref("/images/glossary/yarn_separator1.png")).toBeNull();
    expect(parseLegacyGlossaryHref("#glossary-283")).toBeNull();
  });
});

describe("resolveLegacyGlossaryHref", () => {
  it("maps a catalog id onto the in-player glossary modal hash", () => {
    expect(resolveLegacyGlossaryHref("/glossary/283/cast-on-comb/term", catalog)).toEqual({
      href: "#glossary-283",
      glossaryId: 283,
      slug: "cast-on-comb",
      modal: true,
    });
  });

  it("falls back to the current /glossary/{slug}/ page when the id is unknown", () => {
    expect(resolveLegacyGlossaryHref("/glossary/999/some-term/term", catalog)).toEqual({
      href: "/glossary/some-term/",
      glossaryId: 999,
      slug: "some-term",
      modal: false,
    });
  });
});

describe("currentGlossaryPath", () => {
  it("builds the DEV glossary term path", () => {
    expect(currentGlossaryPath("ravel-cord")).toBe("/glossary/ravel-cord/");
    expect(currentGlossaryPath("cast-on-comb/")).toBe("/glossary/cast-on-comb/");
  });
});
